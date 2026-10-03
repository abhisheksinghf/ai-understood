"""Vector search over authored geometry fixtures. No trained encoder or network."""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import re


def dot(a,b): return sum(x*y for x,y in zip(a,b))
def norm(v): return math.sqrt(dot(v,v))
def unit(v): return [x/norm(v) for x in v]
def cosine(a,b): return max(-1,min(1,dot(a,b)/(norm(a)*norm(b))))
def distance(a,b): return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))
def tokens(text): return re.findall(r'[a-z0-9]+',text.lower())


def validate_snapshot(data):
    if not isinstance(data,dict) or data.get('version')!='movie-vectors-v1' or data.get('dimensions')!=3 or not isinstance(data.get('space_id'),str) or not data['space_id'].strip() or not isinstance(data.get('provenance'),str) or not isinstance(data.get('movies'),list) or not data['movies'] or not isinstance(data.get('queries'),list) or not data['queries'] or not isinstance(data.get('centroids'),list) or len(data['centroids'])!=3:
        raise ValueError('Invalid vector snapshot.')
    for group in [data['movies'],data['queries'],data['centroids']]:
        ids=set()
        for r in group:
            if not isinstance(r,dict) or not isinstance(r.get('id'),str) or not r['id'].strip() or r['id'] in ids or r.get('space_id')!=data['space_id'] or not isinstance(r.get('vector'),list) or len(r['vector'])!=3 or any(type(x) not in (int,float) or not math.isfinite(x) or abs(x)>1e6 for x in r['vector']) or norm(r['vector'])<1e-12:
                raise ValueError('Invalid ID, vector, or embedding-space contract.')
            ids.add(r['id'])
    movie_ids={d['id'] for d in data['movies']}
    for d in data['movies']:
        if not re.fullmatch(r'M\d{3}',d['id']) or not isinstance(d.get('title'),str) or not d['title'].strip() or not isinstance(d.get('summary'),str) or not tokens(d['summary']) or 'runtime_minutes' not in d or not (d['runtime_minutes'] is None or (type(d['runtime_minutes']) is int and d['runtime_minutes']>0)):
            raise ValueError('Invalid movie metadata.')
    query_keys=set()
    for q in data['queries']:
        if not isinstance(q.get('query'),str) or not tokens(q['query']) or not isinstance(q.get('intent'),str) or not q['intent'].strip() or not isinstance(q.get('relevant'),list) or any(not isinstance(i,str) or i not in movie_ids for i in q['relevant']) or len(set(q['relevant']))!=len(q['relevant']):
            raise ValueError('Invalid query judgments.')
        key=tuple(sorted(set(tokens(q['query']))))
        if key in query_keys: raise ValueError('Duplicate query.')
        query_keys.add(key)


def ranking_metrics(ids,relevant,k):
    hits=[i for i,doc_id in enumerate(ids[:k],1) if doc_id in relevant]
    return {'relevant_total':len(relevant),'relevant_retrieved':len(hits),'precision_at_k':len(hits)/k,'recall_at_k':len(hits)/len(relevant) if relevant else None,'reciprocal_rank_at_k':1/hits[0] if hits else 0}


def bm25(movies,query,limit,k):
    counts=[Counter(tokens(d['summary'])) for d in movies]
    n=len(movies);average=sum(sum(c.values()) for c in counts)/n
    terms=list(dict.fromkeys(tokens(query)))
    df={t:sum(t in c for c in counts) for t in terms}
    rows=[]
    for d,c in zip(movies,counts):
        if limit!='all' and (d['runtime_minutes'] is None or d['runtime_minutes']>=120):continue
        if not any(t in c for t in terms):continue
        value=sum(math.log(1+(n-df[t]+.5)/(df[t]+.5))*c[t]*2.2/(c[t]+1.2*(.25+.75*sum(c.values())/average)) for t in terms if c[t])
        rows.append({'id':d['id'],'title':d['title'],'score':value})
    return sorted(rows,key=lambda d:(-d['score'],d['id']))[:k]


def experiment(data,query_id='space',metric='cosine',normalization='raw',mode='exact',limit='all',k=3):
    validate_snapshot(data)
    if metric not in ('cosine','dot','euclidean') or normalization not in ('raw','unit') or mode not in ('exact','probe1','probe2','probe3') or limit not in ('all','under120') or type(k) is not int or not 1<=k<=8 or (mode!='exact' and metric!='cosine'):
        raise ValueError('Invalid vector-search settings. Coarse search uses cosine.')
    q=next((q for q in data['queries'] if q['id']==query_id),None)
    if q is None:raise ValueError('Unknown preset query.')
    transform=unit if normalization=='unit' else list
    query_vector=transform(q['vector'])
    cells=[{'id':c['id'],'vector':c['vector'],'query_similarity':cosine(q['vector'],c['vector']),'members':[]} for c in data['centroids']]
    documents=[]
    for d in data['movies']:
        nearest=sorted(data['centroids'],key=lambda c:(-cosine(d['vector'],c['vector']),c['id']))[0]
        next(c for c in cells if c['id']==nearest['id'])['members'].append(d['id'])
        documents.append({**d,'active_vector':transform(d['vector']),'cell':nearest['id'],'eligible':limit=='all' or (d['runtime_minutes'] is not None and d['runtime_minutes']<120)})
    visited=[c['id'] for c in cells] if mode=='exact' else [c['id'] for c in sorted(cells,key=lambda c:(-c['query_similarity'],c['id']))[:int(mode[-1])]]
    score={'cosine':cosine,'dot':dot,'euclidean':distance}[metric]
    eligible=[d for d in documents if d['eligible']]
    def rank(rows):
        scored=[{**d,'value':score(query_vector,d['active_vector'])} for d in rows]
        return sorted(scored,key=lambda d:(d['value'] if metric=='euclidean' else -d['value'],d['id']))
    candidates=rank([d for d in eligible if d['cell'] in visited])
    reference=rank(eligible)
    results=candidates[:k];exact_ids=[d['id'] for d in reference[:k]]
    relevant=[i for i in q['relevant'] if any(d['id']==i for d in eligible)]
    lexical=bm25(data['movies'],q['query'],limit,k)
    return {'version':data['version'],'space_id':data['space_id'],'provenance':data['provenance'],'configuration':{'query_id':query_id,'metric':metric,'normalization':normalization,'mode':mode,'limit':limit,'k':k},'query':{'text':q['query'],'intent':q['intent'],'vector':q['vector'],'active_vector':query_vector},'index':{'cells':[{**c,'visited':c['id'] in visited} for c in cells],'eligible':len(eligible),'searched_candidates':len(candidates)},'documents':documents,'results':results,'evaluation':ranking_metrics([d['id'] for d in results],relevant,k),'audit':{'exact_ids':exact_ids,'neighbor_recall_at_k':sum(d['id'] in exact_ids for d in results)/len(exact_ids) if exact_ids else None,'explanation':'Exact reference scan is computed separately for teaching; candidate count is not a latency benchmark.'},'lexical':{'results':lexical,'evaluation':ranking_metrics([d['id'] for d in lexical],relevant,k)}}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--query',choices=['space','funny','quiet'],default='space')
    parser.add_argument('--metric',choices=['cosine','dot','euclidean'],default='cosine')
    parser.add_argument('--normalization',choices=['raw','unit'],default='raw')
    parser.add_argument('--mode',choices=['exact','probe1','probe2','probe3'],default='exact')
    parser.add_argument('--limit',choices=['all','under120'],default='all')
    parser.add_argument('--k',type=int,default=3)
    parser.add_argument('--input',type=Path,default=Path(__file__).with_name('vectors.json'))
    a=parser.parse_args()
    try:
        data=json.loads(a.input.read_text(encoding='utf-8'))
        result=experiment(data,a.query,a.metric,a.normalization,a.mode,a.limit,a.k)
    except (OSError,ValueError) as error:
        print(json.dumps({'status':'invalid_input','message':str(error)}));return 2
    print(json.dumps(result,indent=2,allow_nan=False));return 0


if __name__=='__main__':raise SystemExit(main())
