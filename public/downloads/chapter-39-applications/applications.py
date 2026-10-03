"""Three small evaluators using authored cinema data; standard library only."""
import argparse
import json
import math
from pathlib import Path

DATA=json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
DEFAULTS=dict(threshold=.6,weight=.5,k=2,forecast='seasonal7')
CHOICES=dict(threshold=[.3,.6,.9],weight=[0,.5,1],k=[2,3],forecast=['last','mean3','seasonal7'])

def rounded(x):
    return math.floor(x*1e6+.5)/1e6

def normalize(config=None):
    if config is None: config={}
    if not isinstance(config,dict): raise ValueError('Expected a configuration object')
    if set(config)-set(DEFAULTS): raise ValueError('Unknown option')
    result={**DEFAULTS,**config}
    for key,value in result.items():
        if isinstance(value,bool) or value not in CHOICES[key]: raise ValueError('Invalid '+key)
    return result

def iou(a,b):
    intersection=max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
    union=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-intersection
    return intersection/union if union>0 else 0

def cosine(a,b):
    norm=math.sqrt(sum(x*x for x in a)*sum(x*x for x in b))
    return sum(x*y for x,y in zip(a,b))/norm if norm else 0

def detect(threshold,vision=None):
    vision=DATA['vision'] if vision is None else vision
    used=set()
    rows=[]
    for p in sorted((p for p in vision['predictions'] if p['score']>=threshold),key=lambda p:(-p['score'],p['id'])):
        candidates=sorted(({**g,'overlap':iou(p['box'],g['box'])} for g in vision['truth'] if g['frame']==p['frame']),key=lambda g:(-g['overlap'],g['id']))
        match=next((g for g in candidates if g['overlap']>=.5 and g['id'] not in used),None)
        best=candidates[0]['overlap'] if candidates else 0
        if match: used.add(match['id'])
        rows.append({**p,'iou':rounded(match['overlap'] if match else best),'match':match['id'] if match else None,'outcome':'TP' if match else 'FP: duplicate' if best>=.5 else 'FP: no match'})
    tp=len(used)
    return dict(rows=rows,tp=tp,fp=len(rows)-tp,fn=len(vision['truth'])-tp,precision=rounded(tp/len(rows)) if rows else None,recall=rounded(tp/len(vision['truth'])) if vision['truth'] else None,missed=[g['id'] for g in vision['truth'] if g['id'] not in used])

def recommend(weight,k,recs=None):
    recs=DATA['recommendations'] if recs is None else recs
    eligible=[m for m in recs['movies'] if not m['seen'] and m['available']]
    scored=[]
    for m in eligible:
        content=cosine(recs['profile'],m['features'])
        scored.append({**m,'content':content,'score':weight*content+(1-weight)*m['collaborative']})
    scored.sort(key=lambda m:(-m['score'],m['id']))
    selected=scored[:k]
    relevant=sum(m['relevant'] for m in eligible)
    hits=sum(m['relevant'] for m in selected)
    dcg=sum(1/math.log2(i+2) for i,m in enumerate(selected) if m['relevant'])
    ideal=sum(1/math.log2(i+2) for i in range(min(k,relevant)))
    rows=[dict(id=m['id'],title=m['title'],content=rounded(m['content']),collaborative=m['collaborative'],score=rounded(m['score']),relevant=m['relevant'],selected=i<k) for i,m in enumerate(scored)]
    return dict(rows=rows,excluded=[dict(id=m['id'],reason='already watched' if m['seen'] else 'unavailable') for m in recs['movies'] if m['seen'] or not m['available']],hits=hits,relevant=relevant,precision=rounded(hits/k),recall=rounded(hits/relevant) if relevant else None,ndcg=rounded(dcg/ideal) if ideal else None)

def backtest(method,series=None,start_day=None):
    series=DATA['demand'] if series is None else series
    start_day=DATA['evaluationStartDay'] if start_day is None else start_day
    if method not in CHOICES['forecast']: raise ValueError('Invalid forecast method')
    rows=[]
    for day in range(start_day,len(series)+1):
        origin=day-1
        sources=[origin] if method=='last' else [origin-2,origin-1,origin] if method=='mean3' else [day-7]
        if min(sources)<1: raise ValueError('Insufficient history')
        prediction=sum(series[d-1] for d in sources)/len(sources)
        actual=series[day-1]
        rows.append(dict(day=day,origin=origin,sourceDays=sources,prediction=prediction,actual=actual,error=actual-prediction))
    mae=sum(abs(r['error']) for r in rows)/len(rows)
    rmse=math.sqrt(sum(r['error']**2 for r in rows)/len(rows))
    return dict(rows=[{**r,'prediction':rounded(r['prediction']),'error':rounded(r['error'])} for r in rows],mae=rounded(mae),rmse=rounded(rmse),horizon=1)

def evaluate(config=None):
    c=normalize(config)
    return dict(config=c,vision=detect(c['threshold']),recommendations=recommend(c['weight'],c['k']),forecast=backtest(c['forecast']))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for key,values in CHOICES.items():
        parser.add_argument('--'+key,type=str if key=='forecast' else int if key=='k' else float,choices=values,default=DEFAULTS[key])
    print(json.dumps(evaluate(vars(parser.parse_args())),indent=2))
