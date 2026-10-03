"""Audit authored research results; no training, network, or external dependencies."""
import argparse
import json
import math
from pathlib import Path
DATA=json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
DEFAULTS=dict(scope='all',overlap='keep',sample=25,protocol='matched',remove='retrieval')
CHOICES=dict(scope=['all','facts','preferences','tools'],overlap=['keep','exclude'],sample=[25,100,400],protocol=['matched','unequal'],remove=['retrieval','reranker','both'])
def rounded(x): return math.floor(x*1e6+.5)/1e6
def normalize(config=None):
    if config is None: config={}
    if not isinstance(config,dict) or set(config)-set(DEFAULTS): raise ValueError('Invalid configuration')
    c={**DEFAULTS,**config}
    for key,value in c.items():
        if isinstance(value,bool) or value not in CHOICES[key]: raise ValueError('Invalid '+key)
    return c
def audit(scope,overlap,cases=None):
    cases=DATA['cases'] if cases is None else cases
    rows=[{**r,'included':overlap=='keep' or not r['overlap']} for r in cases if scope=='all' or r['task']==scope]
    included=[r for r in rows if r['included']]
    n=len(included)
    baseline=sum(r['baseline'] for r in included)
    candidate=sum(r['candidate'] for r in included)
    wins=sum(r['candidate']>r['baseline'] for r in included)
    losses=sum(r['candidate']<r['baseline'] for r in included)
    return dict(rows=rows,n=n,excluded=len(rows)-n,baseline=baseline,candidate=candidate,baselineRate=rounded(baseline/n) if n else None,candidateRate=rounded(candidate/n) if n else None,difference=rounded((candidate-baseline)/n) if n else None,wins=wins,losses=losses,ties=n-wins-losses)
def wilson(passed,n):
    if type(n) is not int or type(passed) is not int or n<0 or passed<0 or passed>n: raise ValueError('Invalid counts')
    if not n: return dict(rate=None,low=None,high=None,width=None)
    p=passed/n
    z=1.96
    z2=z*z
    den=1+z2/n
    center=(p+z2/(2*n))/den
    half=z*math.sqrt(p*(1-p)/n+z2/(4*n*n))/den
    low,high=max(0,center-half),min(1,center+half)
    return dict(rate=rounded(p),low=rounded(low),high=rounded(high),width=rounded(high-low))
def uncertainty(sample):
    rows=[{**s,**wilson(s['passed'],s['n']),'selected':s['n']==sample} for s in DATA['samples']]
    return dict(rows=rows,selected=next(s for s in rows if s['selected']))
def ablate(protocol,remove,variants=None):
    variants=DATA['ablations'] if variants is None else variants
    target=dict(retrieval='reranker',reranker='retrieval',both='neither')[remove]
    rows=[]
    for r in variants:
        v={**r,'passed':90,'budget':3000} if protocol=='unequal' and r['id']=='full' else r.copy()
        rows.append({**v,'rate':rounded(v['passed']/v['n']),'selected':v['id'] in ('full',target)})
    full=next(r for r in rows if r['id']=='full')
    ablated=next(r for r in rows if r['id']==target)
    rates={r['id']:r['rate'] for r in rows}
    interaction=rounded(rates['full']-rates['retrieval']-rates['reranker']+rates['neither']) if protocol=='matched' else None
    return dict(rows=rows,full=full,ablated=ablated,matched=full['budget']==ablated['budget'],contrast=rounded(full['rate']-ablated['rate']),interaction=interaction)
def evaluate(config=None):
    c=normalize(config)
    return dict(config=c,audit=audit(c['scope'],c['overlap']),uncertainty=uncertainty(c['sample']),ablation=ablate(c['protocol'],c['remove']))
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for key,values in CHOICES.items(): parser.add_argument('--'+key,type=int if key=='sample' else str,choices=values,default=DEFAULTS[key])
    print(json.dumps(evaluate(vars(parser.parse_args())),indent=2))
