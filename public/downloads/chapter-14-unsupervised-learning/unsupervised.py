"""Inspect deterministic k-means and one-component 2D PCA on synthetic movies."""
import argparse
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
MAX_STEPS = 50


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def distance2(a,b):
    return (a[0]-b[0])**2+(a[1]-b[1])**2


def validate_dataset(data):
    if not isinstance(data,dict) or set(data)!={'version','movies'} or data['version']!='movie-structure-v1' or not isinstance(data['movies'],list) or not 3<=len(data['movies'])<=1000:
        raise ValueError('Expected 3-1000 movies in the versioned dataset.')
    ids=set()
    for m in data['movies']:
        if not isinstance(m,dict) or set(m)!={'id','title','action','humor'} or not isinstance(m['id'],str) or not re.fullmatch(r'M[0-9]{3}',m['id']) or m['id'] in ids or not isinstance(m['title'],str) or not m['title'].strip() or len(m['title'])>100 or not finite(m['action']) or not finite(m['humor']) or not 0<=m['action']<=10 or not 0<=m['humor']<=10:
            raise ValueError('Movies need unique IDs, titles, and finite 0-10 feature scores.')
        ids.add(m['id'])
    return data['movies']


def nearest(points,centers):
    return [min(range(len(centers)),key=lambda j:distance2(p,centers[j])) for p in points]


def snapshot(points,centers,step,converged):
    assignments=nearest(points,centers)
    return {'step':step,'centers':centers,'assignments':assignments,'inertia':sum(distance2(p,centers[j]) for p,j in zip(points,assignments)),'converged':converged,'clusters_found':len(set(assignments))}


def initial_state(points,k=3,start='spread'):
    if type(k) is not int or k not in (2,3) or len(points)<k or start not in ('spread','first'):
        raise ValueError('Choose k=2 or 3 and a supported start.')
    indices=list(range(k)) if start=='first' else ([0,len(points)-1] if k==2 else [0,len(points)//2,len(points)-1])
    return snapshot(points,[points[i][:] for i in indices],0,False)


def next_state(points,state):
    if state['converged'] or state['step']>=MAX_STEPS:
        return state
    centers=[]
    for j,old in enumerate(state['centers']):
        members=[p for p,a in zip(points,state['assignments']) if a==j]
        centers.append([sum(p[d] for p in members)/len(members) for d in (0,1)] if members else old[:])
    result=snapshot(points,centers,state['step']+1,False)
    result['converged']=result['assignments']==state['assignments']
    return result


def cluster_trace(points,k=3,start='spread',steps=MAX_STEPS):
    if type(steps) is not int or not 0<=steps<=MAX_STEPS:
        raise ValueError('Steps must be an integer from 0 to 50.')
    trace=[initial_state(points,k,start)]
    while len(trace)<=steps and not trace[-1]['converged']:
        trace.append(next_state(points,trace[-1]))
    return trace


def fit_pca(points):
    if len(points)<2:
        raise ValueError('PCA needs at least two points.')
    n=len(points)
    center=[sum(p[d] for p in points)/n for d in (0,1)]
    centered=[[p[d]-center[d] for d in (0,1)] for p in points]
    a=sum(p[0]**2 for p in centered)/n
    b=sum(p[0]*p[1] for p in centered)/n
    c=sum(p[1]**2 for p in centered)/n
    if a+c<=1e-14:
        raise ValueError('No varying feature: PCA variance ratio is undefined.')
    gap=math.hypot(a-c,2*b)
    angle=0 if gap<=1e-14 else .5*math.atan2(2*b,a-c)
    axis=[math.cos(angle),math.sin(angle)]
    eigenvalues=[(a+c+gap)/2,max(0,(a+c-gap)/2)]
    scores=[p[0]*axis[0]+p[1]*axis[1] for p in centered]
    reconstructed=[[center[d]+z*axis[d] for d in (0,1)] for z in scores]
    residuals=[distance2(p,r) for p,r in zip(points,reconstructed)]
    return {'center':center,'axis':axis,'eigenvalues':eigenvalues,'explained_ratio':eigenvalues[0]/(a+c),'scores':scores,'reconstructed':reconstructed,'residuals':residuals,'mean_squared_residual':sum(residuals)/n}


def experiment(data,mode='clusters',k=3,start='spread',humor_weight=1,steps=MAX_STEPS):
    if mode not in ('clusters','pca') or type(humor_weight) is not int or humor_weight not in (1,3):
        raise ValueError('Choose clusters/PCA and humor weight 1 or 3.')
    movies=validate_dataset(data)
    raw=[[m['action'],m['humor']] for m in movies]
    if mode=='pca':
        return {'dataset_version':data['version'],'mode':mode,'feature_order':['action','humor'],'fit_scope':'all nine demo movies (or the entire supplied snapshot)','model':fit_pca(raw),'movies':movies}
    points=[[p[0],p[1]*humor_weight] for p in raw]
    trace=cluster_trace(points,k,start,steps)
    return {'dataset_version':data['version'],'mode':mode,'feature_order':['action','humor'],'configuration':{'k':k,'start':start,'humor_weight':humor_weight},'fit_scope':'entire supplied snapshot; exploratory fit','state':trace[-1],'trace':trace,'movies':movies}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,default=ROOT/'movie_features.json')
    parser.add_argument('--mode',choices=['clusters','pca'],default='clusters')
    parser.add_argument('--k',type=int,choices=[2,3],default=3)
    parser.add_argument('--start',choices=['spread','first'],default='spread')
    parser.add_argument('--humor-weight',type=int,choices=[1,3],default=1)
    parser.add_argument('--steps',type=int,default=MAX_STEPS)
    args=parser.parse_args()
    try:
        if not 0<=args.steps<=MAX_STEPS:
            raise ValueError('Steps must be an integer from 0 to 50.')
        data=json.loads(args.input.read_text(encoding='utf-8'))
        result=experiment(data,args.mode,args.k,args.start,args.humor_weight,args.steps)
    except (ValueError,TypeError,OSError,UnicodeError) as error:
        print(json.dumps({'status':'invalid_input','detail':str(error)}))
        return 2
    print(json.dumps(result,indent=2,allow_nan=False))
    return 0


if __name__=='__main__':
    raise SystemExit(main())
