"""Small trigram softmax model: gradient training, loss masks, frozen generation."""
import argparse
import copy
import json
import math
from pathlib import Path

DATA=json.loads((Path(__file__).parent/'data.json').read_text(encoding='utf-8'))
V=len(DATA['vocabulary'])


def softmax(logits):
    maximum=max(logits)
    exps=[math.exp(x-maximum) for x in logits]
    total=sum(exps)
    return [x/total for x in exps]


def rows(tokens,start):
    sequence=['<bos>','<bos>',*tokens,'<eos>']
    return [{'context':' '.join(sequence[i:i+2]),'target':target,'id':DATA['vocabulary'].index(target),'selected':i>=start} for i,target in enumerate(sequence[2:])]


def examples(stage='pretrain',mask='reply'):
    if stage not in ('pretrain','sft') or mask not in ('reply','all'):
        raise ValueError('Invalid dataset or loss mask.')
    if stage=='pretrain': return [rows(s.split(),0) for s in DATA['pretraining']]
    return [rows(['<user>',d['genre'],'<assistant>',*d['reply'].split()],3 if mask=='reply' else 0) for d in DATA['demonstrations']]


def initial():
    keys=sorted({r['context'] for seq in examples()+examples('sft') for r in seq})
    return {key:[0.0]*V for key in keys}


def distribution(weights,context,temperature=1):
    return softmax([x/temperature for x in weights.get(context,[0.0]*V)])


def loss_gradient(weights,dataset):
    selected=[r for seq in dataset for r in seq if r['selected']]
    gradient={key:[0.0]*V for key in weights}
    total=0.0
    for row in selected:
        p=distribution(weights,row['context'])
        total-=math.log(p[row['id']])
        for j in range(V): gradient[row['context']][j]+=(p[j]-(1 if j==row['id'] else 0))/len(selected)
    return {'loss':total/len(selected),'targets':len(selected),'gradient':gradient}


def optimize(starting,dataset,steps):
    weights=copy.deepcopy(starting)
    history=[]
    for i in range(steps+1):
        state=loss_gradient(weights,dataset)
        history.append({'step':i,'loss':state['loss']})
        if i<steps:
            for key in weights:
                for j in range(V): weights[key][j]-=DATA['learning_rate']*state['gradient'][key][j]
    return {'weights':weights,'history':history}


def train(mask='reply',steps=80):
    if mask not in ('reply','all') or isinstance(steps,bool) or steps not in (0,20,80):
        raise ValueError('Use mask reply/all and 0, 20, or 80 SFT steps.')
    pre,sft,reply=examples(),examples('sft',mask),examples('sft','reply')
    start=initial()
    base=optimize(start,pre,DATA['pretrain_steps'])
    adapted=optimize(base['weights'],sft,steps)
    checkpoints={'initial':start,'pretrained':base['weights'],'adapted':adapted['weights']}
    stages=[{'name':name,'pretrain_loss':loss_gradient(w,pre)['loss'],'reply_loss':loss_gradient(w,reply)['loss']} for name,w in checkpoints.items()]
    demonstration=[{**r,'before':distribution(base['weights'],r['context'])[r['id']],'after':distribution(adapted['weights'],r['context'])[r['id']]} for r in sft[0]]
    return {'mask':mask,'steps':steps,'vocabulary':DATA['vocabulary'],'pretrain_steps':DATA['pretrain_steps'],'learning_rate':DATA['learning_rate'],'pretrain_targets':sum(map(len,pre)),'reply_targets':sum(r['selected'] for seq in reply for r in seq),'sft_targets':sum(r['selected'] for seq in sft for r in seq),'stages':stages,'demonstration':demonstration,'history':{'pretrain':base['history'],'sft':adapted['history']},'checkpoints':checkpoints}


def generate(weights,prompt='comedy',method='greedy',temperature=1,limit=8):
    if prompt not in DATA['prompts'] or method not in ('greedy','sample') or isinstance(temperature,bool) or temperature not in (.75,1,1.5) or isinstance(limit,bool) or limit not in (1,4,8):
        raise ValueError('Invalid generation configuration.')
    prefix=list(DATA['prompts'][prompt])
    sequence=list(prefix)
    trace=[]
    state=DATA['seed']
    stop='Token limit'
    for i in range(limit):
        context=' '.join(sequence[-2:])
        base,p=distribution(weights,context),distribution(weights,context,temperature)
        draw=None
        if method=='greedy': chosen=max(range(V),key=lambda j:p[j])
        else:
            state=(1664525*state+1013904223)%2**32
            draw=state/2**32
            cumulative=0
            chosen=V-1
            for j in range(V):
                cumulative+=p[j]
                if draw<cumulative:
                    chosen=j
                    break
        token=DATA['vocabulary'][chosen]
        trace.append({'step':i+1,'context':context,'known_context':context in weights,'token':token,'id':chosen,'draw':draw,'base':base,'probabilities':p})
        sequence.append(token)
        if token=='<eos>':
            stop='End token'
            break
    tokens=[r['token'] for r in trace]
    return {'prompt':prompt,'method':method,'temperature':temperature,'limit':limit,'seed':DATA['seed'],'prefix':prefix,'tokens':tokens,'text':' '.join(t for t in tokens if t!='<eos>').replace(' .','.'),'stop':stop,'trace':trace}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mask',choices=('reply','all'),default='reply')
    parser.add_argument('--steps',type=int,choices=(0,20,80),default=80)
    parser.add_argument('--checkpoint',choices=('initial','pretrained','adapted'),default='adapted')
    parser.add_argument('--prompt',choices=tuple(DATA['prompts']),default='comedy')
    parser.add_argument('--method',choices=('greedy','sample'),default='greedy')
    parser.add_argument('--temperature',type=float,choices=(.75,1,1.5),default=1)
    parser.add_argument('--limit',type=int,choices=(1,4,8),default=8)
    args=parser.parse_args()
    result=train(args.mask,args.steps)
    output={'training':result,'checkpoint':args.checkpoint,'generation':generate(result['checkpoints'][args.checkpoint],args.prompt,args.method,args.temperature,args.limit)}
    print(json.dumps(output,indent=2,allow_nan=False))
