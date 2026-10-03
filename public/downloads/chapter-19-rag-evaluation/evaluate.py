"""Evaluate a fictional RAG development set. Python 3.10+, standard library only."""
import argparse
import json
from pathlib import Path
import sys
import rag

def ratio(n, d):
    return n / d if d else None

def mean(values):
    xs = [v for v in values if v is not None]
    return sum(xs) / len(xs) if xs else None

def validate(data):
    if not isinstance(data, dict) or data.get('version') != 'rag-evaluation-v1' or not isinstance(data.get('cases'), list) or not data['cases'] or not isinstance(data.get('facts'), list) or not isinstance(data.get('configurations'), list) or not data['configurations'] or not isinstance(data.get('audit'), dict):
        raise ValueError('Invalid benchmark.')
    rag.validate(data['source'])
    facts, cases, configs = set(), set(), set()
    for f in data['facts']:
        m = next((m for m in data['source']['movies'] if m['id'] == f.get('movie_id')), None)
        if not m or not isinstance(f.get('id'), str) or f['id'] in facts or f.get('text') not in [m['summary']] + ([] if m['runtime_minutes'] is None else [f"Runtime: {m['runtime_minutes']} minutes."]):
            raise ValueError('Invalid reference fact.')
        facts.add(f['id'])
    for q in data['cases']:
        if not isinstance(q.get('id'), str) or q['id'] in cases or not isinstance(q.get('question'), str) or not q['question'].strip() or not isinstance(q.get('search'), str) or not q['search'].strip() or q.get('field') not in ('summary','runtime','streaming') or not isinstance(q.get('gold'), list) or len(set(q['gold'])) != len(q['gold']) or not all(x in facts for x in q['gold']):
            raise ValueError('Invalid evaluation case.')
        cases.add(q['id'])
    for c in data['configurations']:
        if not isinstance(c.get('id'), str) or c['id'] in configs or not isinstance(c.get('label'), str) or type(c.get('k')) is not int or not 1 <= c['k'] <= 8 or type(c.get('budget')) is not int or not 0 <= c['budget'] <= 1000:
            raise ValueError('Invalid configuration.')
        configs.add(c['id'])
    a=data['audit']
    if not isinstance(a.get('sources'), list) or not a['sources'] or not isinstance(a.get('required'), list) or not a['required'] or len(set(a['required'])) != len(a['required']) or not isinstance(a.get('fixtures'), list) or not a['fixtures']:
        raise ValueError('Invalid audit.')
    ids={s['id'] for s in a['sources']}
    if len(ids) != len(a['sources']) or any(not isinstance(s['id'], str) or not isinstance(s.get('text'), str) for s in a['sources']):
        raise ValueError('Invalid audit sources.')
    fixtures=set()
    for f in a['fixtures']:
        if not isinstance(f.get('id'), str) or f['id'] in fixtures or not isinstance(f.get('claims'), list):
            raise ValueError('Invalid audit fixture.')
        fixtures.add(f['id'])
        for c in f['claims']:
            if not isinstance(c.get('text'), str) or not isinstance(c.get('citations'), list) or not all(isinstance(x,str) for x in c['citations']) or len(set(c['citations'])) != len(c['citations']) or not isinstance(c.get('supported_by'), list) or not all(x in ids for x in c['supported_by']) or not isinstance(c.get('covers'), list) or not all(x in a['required'] for x in c['covers']):
                raise ValueError('Invalid claim labels.')
    return data

def run_case(data, query_id='Q1', config_id='wide'):
    validate(data)
    q=next((q for q in data['cases'] if q['id']==query_id),None)
    cfg=next((c for c in data['configurations'] if c['id']==config_id),None)
    if q is None or cfg is None:
        raise ValueError('Unknown case or configuration.')
    # Keep reference labels out of generation and retrieval.
    source=dict(data['source'], queries=[{k:q[k] for k in ('id','question','search','field')} for q in data['cases']])
    trace=rag.experiment(source, q['id'], 'section', cfg['k'], cfg['budget'])
    references=[f for f in data['facts'] if f['id'] in q['gold']]
    def found(chunks,f):
        return any(c['movie_id']==f['movie_id'] and f['text'] in c['text'] for c in chunks)
    retrieved=[f['id'] for f in references if found(trace['candidates'],f)]
    packed=[f['id'] for f in references if found(trace['context']['selected'],f)]
    claims=[dict(e, fact_ids=[f['id'] for f in data['facts'] if f['movie_id']==e['movie_id'] and f['text']==e['quote']], supported=any(c['id']==e['source_id'] and e['quote'] in c['text'] for c in trace['context']['selected'])) for e in trace['validation']['evidence']]
    covered=list(dict.fromkeys(fid for c in claims for fid in c['fact_ids'] if fid in q['gold']))
    answered,answerable=bool(claims),bool(q['gold'])
    correct=answered and answerable and len(covered)==len(q['gold']) and all(any(fid in q['gold'] for fid in c['fact_ids']) for c in claims)
    success=correct if answerable else not answered
    if not answerable:diagnosis='Answered despite missing requested fact' if answered else 'Correct abstention'
    elif len(retrieved)<len(q['gold']):diagnosis='Retrieval gap'
    elif len(packed)<len(q['gold']):diagnosis='Context packing gap'
    elif not answered:diagnosis='Answer step omitted evidence'
    elif not correct:diagnosis='Wrong fact selected'
    else:diagnosis='Required evidence answered'
    return dict(id=q['id'],question=q['question'],answerable=answerable,gold=q['gold'],configuration=cfg['id'],retrieved_facts=retrieved,packed_facts=packed,covered_facts=covered,retrieval_recall=ratio(len(retrieved),len(q['gold'])),context_recall=ratio(len(packed),len(q['gold'])),answered=answered,correct_answer=correct,success=success,diagnosis=diagnosis,claims=claims,trace=trace)

def summarize(rows):
    answerable=[r for r in rows if r['answerable']]
    missing=[r for r in rows if not r['answerable']]
    answered=[r for r in rows if r['answered']]
    claims=[c for r in rows for c in r['claims']]
    correct=sum(r['correct_answer'] for r in rows)
    successes=sum(r['success'] for r in rows)
    return dict(queries=len(rows),answerable=len(answerable),missing=len(missing),answered=len(answered),correct_answers=correct,successes=successes,task_success=ratio(successes,len(rows)),answer_coverage=ratio(len(answered),len(rows)),answered_accuracy=ratio(sum(r['correct_answer'] for r in answered),len(answered)),false_answer_rate=ratio(sum(r['answered'] for r in missing),len(missing)),retrieval_recall=mean([r['retrieval_recall'] for r in answerable]),context_recall=mean([r['context_recall'] for r in answerable]),quote_support=ratio(sum(c['supported'] for c in claims),len(claims)),mean_evidence_units=mean([r['trace']['context']['used'] for r in rows]))

def compare(data, config_id='wide', slice_name='all'):
    validate(data)
    if slice_name not in ('all','answerable','missing'):
        raise ValueError('Invalid slice.')
    if not any(c['id']==config_id for c in data['configurations']):
        raise ValueError('Unknown configuration.')
    ids=[q['id'] for q in data['cases'] if slice_name=='all' or (bool(q['gold']) if slice_name=='answerable' else not q['gold'])]
    baseline=[run_case(data,i,'narrow') for i in ids]
    candidate=[run_case(data,i,config_id) for i in ids]
    pairs=[dict(id=c['id'],baseline_success=b['success'],candidate_success=c['success'],outcome='tie' if c['success']==b['success'] else 'win' if c['success'] else 'loss') for b,c in zip(baseline,candidate)]
    a,b=summarize(baseline),summarize(candidate)
    delta=None if a['task_success'] is None or b['task_success'] is None else b['task_success']-a['task_success']
    return dict(version=data['version'],provenance=data['provenance'],configuration=config_id,slice=slice_name,baseline=a,candidate=b,paired=dict(wins=sum(p['outcome']=='win' for p in pairs),losses=sum(p['outcome']=='loss' for p in pairs),ties=sum(p['outcome']=='tie' for p in pairs),delta=delta,pairs=pairs),rows=candidate)

def audit(data, fixture_id='complete'):
    validate(data)
    a=data['audit'];f=next((f for f in a['fixtures'] if f['id']==fixture_id),None)
    if f is None:raise ValueError('Unknown audit fixture.')
    context={s['id'] for s in a['sources']};covered=set();claims=[]
    for c in f['claims']:
        supported=any(i in context for i in c['supported_by'])
        if supported:covered.update(c['covers'])
        claims.append(dict(c,supported=supported,valid_links=sum(i in context for i in c['citations']),supporting_links=sum(i in context and i in c['supported_by'] for i in c['citations'])))
    links=sum(len(c['citations']) for c in claims)
    metrics=dict(context_support=ratio(sum(c['supported'] for c in claims),len(claims)),valid_citation_ids=ratio(sum(c['valid_links'] for c in claims),links),citation_precision=ratio(sum(c['supporting_links'] for c in claims),links),citation_coverage=ratio(sum(c['supporting_links']>0 for c in claims),len(claims)),required_fact_coverage=ratio(sum(i in covered for i in a['required']),len(a['required'])))
    return dict(id=f['id'],label=f['label'],note=f['note'],question=a['question'],sources=a['sources'],required=a['required'],claims=claims,metrics=metrics,annotation='Support and required-fact labels are authored judgments. Arithmetic is computed; no semantic judge model is running.')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input',type=Path,default=Path(__file__).with_name('benchmark.json'))
    p.add_argument('--config',choices=['narrow','wide','tight'],default='wide')
    p.add_argument('--slice',choices=['all','answerable','missing'],default='all')
    p.add_argument('--case',help='Inspect one case, Q1 through Q8.')
    p.add_argument('--audit',help='Inspect complete, partial, wrong_citation, uncited, wrong_movie, or fabricated.')
    args=p.parse_args()
    try:
        if args.case and args.audit:raise ValueError('Choose a case or a citation audit.')
        data=json.loads(args.input.read_text(encoding='utf-8-sig'))
        result=audit(data,args.audit) if args.audit else run_case(data,args.case,args.config) if args.case else compare(data,args.config,args.slice)
        print(json.dumps(result,indent=2))
        return 0
    except (ValueError,OSError,TypeError,KeyError,AttributeError) as exc:
        print(json.dumps(dict(status='invalid_input',error=str(exc))))
        return 2

if __name__=='__main__':sys.exit(main())
