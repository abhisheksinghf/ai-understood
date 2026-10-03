"""Evaluate authored movie predictions; select on validation before a final test."""
import argparse
import json
import math
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent
THRESHOLDS=[.4,.5,.6,.7,.85]
COSTS={'equal':{'fp':1,'fn':1},'misses':{'fp':1,'fn':3},'unwanted':{'fp':3,'fn':1}}
EPSILON=1e-15


def finite(value):
    return type(value) in (int,float) and math.isfinite(value)


def ratio(a,b):
    return None if b==0 else a/b


def validate_dataset(data):
    if not isinstance(data,dict) or set(data)!={'version','training_summary','rows'} or data['version']!='movie-evaluation-v1' or not isinstance(data['rows'],list) or len(data['rows'])>1000:
        raise ValueError('Expected a versioned evaluation snapshot with at most 1000 events.')
    s=data['training_summary']
    if not isinstance(s,dict) or set(s)!={'positive','total'} or type(s['total']) is not int or not 1<=s['total']<=100000 or type(s['positive']) is not int or not 0<=s['positive']<=s['total']:
        raise ValueError('Training summary needs integer counts with 0 <= positive <= total.')
    ids=set()
    viewers={}
    splits={'validation':[],'test':[],'baseline_probability':s['positive']/s['total']}
    for r in data['rows']:
        if not isinstance(r,dict) or set(r)!={'event_id','viewer_id','split','movie','prior_ratings','liked','a','b'} or not isinstance(r['event_id'],str) or not re.fullmatch(r'E[0-9]{3}',r['event_id']) or not isinstance(r['viewer_id'],str) or not re.fullmatch(r'V[0-9]{3}',r['viewer_id']) or r['event_id'] in ids or r['split'] not in ('validation','test') or not isinstance(r['movie'],str) or not r['movie'].strip() or len(r['movie'])>100 or type(r['prior_ratings']) is not int or not 0<=r['prior_ratings']<=10000 or not finite(r['liked']) or r['liked'] not in (0,1) or not all(finite(p) and 0<=p<=1 for p in (r['a'],r['b'])):
            raise ValueError('Invalid event, label, probability, history count, or duplicate ID.')
        if r['viewer_id'] in viewers and viewers[r['viewer_id']]!=r['split']:
            raise ValueError('A viewer cannot cross validation and test boundaries.')
        ids.add(r['event_id'])
        viewers[r['viewer_id']]=r['split']
        splits[r['split']].append(r)
    if not splits['validation'] or not splits['test']:
        raise ValueError('Validation and test splits must both contain events.')
    return splits


def roc_curve(labels,scores):
    positives=sum(labels)
    negatives=len(labels)-positives
    if not positives or not negatives:
        return None
    order=sorted(zip(scores,labels),key=lambda x:-x[0])
    points=[{'fpr':0,'tpr':0}]
    tp=fp=i=0
    while i<len(order):
        score=order[i][0]
        while i<len(order) and order[i][0]==score:
            if order[i][1]: tp+=1
            else: fp+=1
            i+=1
        points.append({'fpr':fp/negatives,'tpr':tp/positives})
    return points


def evaluate_rows(rows,candidate='a',threshold=.5,cost='misses',baseline_probability=.25):
    if not rows or candidate not in ('a','b','baseline') or not finite(threshold) or not 0<=threshold<=1 or cost not in COSTS or not finite(baseline_probability) or not 0<=baseline_probability<=1:
        raise ValueError('Choose a supported candidate, threshold, cost policy, and nonempty rows.')
    tp=fp=tn=fn=0
    loss=brier=0
    predictions=[]
    for r in rows:
        p=baseline_probability if candidate=='baseline' else r[candidate]
        decision=int(p>=threshold)
        outcome=('TP' if r['liked'] else 'FP') if decision else ('FN' if r['liked'] else 'TN')
        if outcome=='TP': tp+=1
        elif outcome=='FP': fp+=1
        elif outcome=='TN': tn+=1
        else: fn+=1
        clipped=min(1-EPSILON,max(EPSILON,p))
        loss+=-math.log(clipped) if r['liked'] else -math.log1p(-clipped)
        brier+=(p-r['liked'])**2
        predictions.append({'event_id':r['event_id'],'movie':r['movie'],'prior_ratings':r['prior_ratings'],'liked':r['liked'],'probability':p,'predicted':decision,'outcome':outcome})
    n=len(rows)
    recall=ratio(tp,tp+fn)
    specificity=ratio(tn,tn+fp)
    roc=roc_curve([r['liked'] for r in rows],[r['probability'] for r in predictions])
    auc=sum((p['fpr']-roc[i]['fpr'])*(p['tpr']+roc[i]['tpr'])/2 for i,p in enumerate(roc[1:])) if roc else None
    total_cost=fp*COSTS[cost]['fp']+fn*COSTS[cost]['fn']
    return {'n':n,'positives':tp+fn,'prevalence':(tp+fn)/n,'confusion':{'tp':tp,'fp':fp,'tn':tn,'fn':fn},'accuracy':(tp+tn)/n,'precision':ratio(tp,tp+fp),'recall':recall,'specificity':specificity,'fpr':ratio(fp,fp+tn),'f1':ratio(2*tp,2*tp+fp+fn),'balanced_accuracy':None if recall is None or specificity is None else (recall+specificity)/2,'total_cost':total_cost,'cost_per_event':total_cost/n,'log_loss':loss/n,'brier':brier/n,'auc':auc,'roc':roc,'rows':predictions}


def select_on_validation(rows,cost,baseline_probability):
    comparison=[]
    for candidate in ('a','b'):
        for threshold in THRESHOLDS:
            r=evaluate_rows(rows,candidate,threshold,cost,baseline_probability)
            comparison.append({'candidate':candidate,'threshold':threshold,'total_cost':r['total_cost'],'accuracy':r['accuracy'],'precision':r['precision'],'recall':r['recall']})
    winner=min(comparison,key=lambda r:r['total_cost'])
    return {'scope':'all validation events','objective':'minimum total weighted error cost','tie_break':'first in fixed order: candidate A then B; thresholds ascending','comparison':comparison,'winner':winner}


def experiment(data,candidate='a',threshold=.5,slice_name='all',cost='misses',evaluate_test=False):
    if slice_name not in ('all','short','long') or type(evaluate_test) is not bool:
        raise ValueError('Choose an all/short/long history slice and a boolean test flag.')
    splits=validate_dataset(data)
    rows=[r for r in splits['validation'] if slice_name=='all' or (r['prior_ratings']<5 if slice_name=='short' else r['prior_ratings']>=5)]
    validation=evaluate_rows(rows,candidate,threshold,cost,splits['baseline_probability'])
    selection=select_on_validation(splits['validation'],cost,splits['baseline_probability'])
    result={'dataset_version':data['version'],'provenance':'authored frozen predictions; no model is trained','configuration':{'candidate':candidate,'threshold':threshold,'slice':slice_name,'cost':cost,'costs':COSTS[cost]},'baseline_probability':splits['baseline_probability'],'validation':validation,'selection':selection}
    if evaluate_test:
        chosen=selection['winner']
        result['final_test']={'configuration':{'candidate':chosen['candidate'],'threshold':chosen['threshold'],'cost':cost},'report':evaluate_rows(splits['test'],chosen['candidate'],chosen['threshold'],cost,splits['baseline_probability'])}
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,default=ROOT/'movie_predictions.json')
    parser.add_argument('--candidate',choices=['a','b','baseline'],default='a')
    parser.add_argument('--threshold',type=float,default=.5)
    parser.add_argument('--slice',choices=['all','short','long'],default='all')
    parser.add_argument('--cost',choices=list(COSTS),default='misses')
    parser.add_argument('--evaluate-test',action='store_true',help='Evaluate only the validation-selected policy on all test events.')
    args=parser.parse_args()
    try:
        data=json.loads(args.input.read_text(encoding='utf-8'))
        result=experiment(data,args.candidate,args.threshold,args.slice,args.cost,args.evaluate_test)
    except (ValueError,TypeError,OSError,UnicodeError) as error:
        print(json.dumps({'status':'invalid_input','detail':str(error)}))
        return 2
    print(json.dumps(result,indent=2,allow_nan=False))
    return 0


if __name__=='__main__':
    raise SystemExit(main())
