"""Graph propagation, standardization, and annotation selection; no dependencies."""
import argparse
import json
import math
from pathlib import Path

DATA=json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
DEFAULTS=dict(steps=1,topology='chain',allocation='unbalanced',targetHigh=.5,strategy='uncertain',budget=2)
CHOICES=dict(steps=[0,1,3],topology=['chain','shortcut'],allocation=['unbalanced','balanced'],targetHigh=[.25,.5,.75],strategy=['uncertain','confident'],budget=[1,2])
def rounded(x): return math.floor(x*1e6+.5)/1e6
def normalize(config=None):
    if config is None: config={}
    if not isinstance(config,dict): raise ValueError('Expected a configuration object')
    if set(config)-set(DEFAULTS): raise ValueError('Unknown option')
    c={**DEFAULTS,**config}
    for key,value in c.items():
        if isinstance(value,bool) or value not in CHOICES[key]: raise ValueError('Invalid '+key)
    return c

def propagate(steps,topology,graph=None):
    graph=DATA['graph'] if graph is None else graph
    edges=graph['edges']+[graph['shortcut']] if topology=='shortcut' else graph['edges'][:]
    neighbors={n['id']:[] for n in graph['nodes']}
    for a,b in edges:
        neighbors[a].append(b)
        neighbors[b].append(a)
    values={n['id']:n['value'] for n in graph['nodes']}
    history=[dict(step=0,values=values.copy())]
    updates=[]
    for step in range(1,steps+1):
        next_values={}
        for n in graph['nodes']:
            key=n['id']
            ids=neighbors[key]
            old=values[key]
            mean=sum(values[i] for i in ids)/len(ids) if ids else None
            next_values[key]=old if mean is None else .5*old+.5*mean
            updates.append(dict(step=step,id=key,neighbors=ids[:],old=rounded(old),neighborMean=None if mean is None else rounded(mean),updated=rounded(next_values[key])))
        values=next_values
        history.append(dict(step=step,values={k:rounded(v) for k,v in values.items()}))
    return dict(edges=edges,rows=[{**n,'neighbors':neighbors[n['id']],'final':rounded(values[n['id']])} for n in graph['nodes']],history=history,updates=updates)

def standardize(allocation,target_high,tables=None):
    tables=DATA['causal'] if tables is None else tables
    rows=[{**r,'weight':target_high if i==0 else 1-target_high,'withRate':r['withY']/r['withN'],'withoutRate':r['withoutY']/r['withoutN']} for i,r in enumerate(tables[allocation])]
    crude_with=sum(r['withY'] for r in rows)/sum(r['withN'] for r in rows)
    crude_without=sum(r['withoutY'] for r in rows)/sum(r['withoutN'] for r in rows)
    adjusted_with=sum(r['weight']*r['withRate'] for r in rows)
    adjusted_without=sum(r['weight']*r['withoutRate'] for r in rows)
    return dict(rows=[{**r,'withRate':rounded(r['withRate']),'withoutRate':rounded(r['withoutRate']),'difference':rounded(r['withRate']-r['withoutRate'])} for r in rows],crudeWith=rounded(crude_with),crudeWithout=rounded(crude_without),crudeDifference=rounded(crude_with-crude_without),adjustedWith=rounded(adjusted_with),adjustedWithout=rounded(adjusted_without),adjustedDifference=rounded(adjusted_with-adjusted_without))

def entropy(p): return 0 if p in (0,1) else -p*math.log2(p)-(1-p)*math.log2(1-p)
def query_reviews(strategy,budget,reviews=None):
    reviews=DATA['reviews'] if reviews is None else reviews
    scored=[dict(id=r['id'],text=r['text'],p=r['p'],entropy=rounded(entropy(r['p']))) for r in reviews]
    scored.sort(key=lambda r:(-r['entropy'] if strategy=='uncertain' else r['entropy'],r['id']))
    selected=[r['id'] for r in scored[:budget]]
    rows=[{**r,'selected':r['id'] in selected,'annotation':next(x['label'] for x in reviews if x['id']==r['id']) if r['id'] in selected else None} for r in scored]
    return dict(rows=rows,selected=selected,labelsRequested=len(selected),meanEntropy=rounded(sum(r['entropy'] for r in rows if r['selected'])/len(selected)))

def evaluate(config=None):
    c=normalize(config)
    return dict(config=c,graph=propagate(c['steps'],c['topology']),causal=standardize(c['allocation'],c['targetHigh']),active=query_reviews(c['strategy'],c['budget']))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for key,values in CHOICES.items():
        parser.add_argument('--'+key,type=int if key in ('steps','budget') else float if key=='targetHigh' else str,choices=values,default=DEFAULTS[key])
    print(json.dumps(evaluate(vars(parser.parse_args())),indent=2))
