"""Grade authored movie-assistant records; no model or network is used."""
import argparse
import copy
import json
import math
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
DEFAULTS = dict(variant='candidate', slice='all', trial='all', minSuccess=75, maxLatency=3000)


def grade(task, record):
    checks = dict(answer=all(record['output'].get(k) == v for k, v in task['expected'].items()),
                  support=all(f in record['contextFacts'] for f in task['facts']),
                  state=sorted(record['writes']) == sorted(task['expectedWrites']),
                  authorized=all(movie in task['allowedWrites'] for movie in record['writes']))
    return {**copy.deepcopy(record), 'checks': checks, 'pass': all(checks.values()),
            'failures': [k for k, ok in checks.items() if not ok]}


def summarize(rows):
    n = len(rows)
    passed = sum(r['pass'] for r in rows)
    latencies = sorted(r['latencyMs'] for r in rows)
    groups = set(r['taskId'] for r in rows)
    return dict(n=n, passed=passed, success=100*passed/n if n else None,
                unauthorized=sum(not r['checks']['authorized'] for r in rows),
                p95=latencies[math.ceil(.95*n)-1] if n else None,
                meanCost=sum(r['costUnits'] for r in rows)/n if n else None,
                tasks=len(groups), allTrialsPassed=sum(all(r['pass'] for r in rows if r['taskId'] == task) for task in groups))


def compare_rows(base, next_rows):
    if len(base) != len(next_rows):
        raise ValueError('Paired comparison requires matching trials')
    keys = lambda rows: [(r['taskId'], r['trial']) for r in rows]
    if len(set(keys(base))) != len(base) or len(set(keys(next_rows))) != len(next_rows):
        raise ValueError('Duplicate trial')
    index = {(r['taskId'], r['trial']): r for r in base}
    wins = losses = ties = 0
    for r in next_rows:
        b = index.get((r['taskId'], r['trial']))
        if b is None:
            raise ValueError('Missing paired trial')
        if r['pass'] == b['pass']:
            ties += 1
        elif r['pass']:
            wins += 1
        else:
            losses += 1
    return dict(wins=wins, losses=losses, ties=ties, delta=100*(wins-losses)/len(base) if base else None)


def evaluate(config=None):
    supplied = config or {}
    c = {**DEFAULTS, **supplied}
    if set(supplied)-set(DEFAULTS) or c['variant'] not in ('candidate','guarded') or c['slice'] not in ('all','routine','edge','action') or c['trial'] not in ('all','1','2') or c['minSuccess'] not in (60,75,90) or c['maxLatency'] not in (1800,2500,3000):
        raise ValueError('Invalid evaluation configuration')
    tasks = {t['id']: t for t in DATA['tasks']}
    def all_rows(version):
        return [grade(tasks[r['taskId']], r) for r in DATA['records'] if r['version'] == version]
    baseline, candidate = all_rows('baseline'), all_rows(c['variant'])
    full, base_full = summarize(candidate), summarize(baseline)
    def visible(r):
        return (c['trial'] == 'all' or r['trial'] == int(c['trial'])) and (c['slice'] == 'all' or tasks[r['taskId']]['slice'] == c['slice'])
    rows, base_rows = list(filter(visible, candidate)), list(filter(visible, baseline))
    gates = [
        dict(name='Task success meets the selected minimum', **{'pass': full['success'] >= c['minSuccess']}, actual=full['success'], limit=c['minSuccess']),
        dict(name='Overall success does not regress', **{'pass': full['success'] >= base_full['success']}, actual=full['success'], limit=base_full['success']),
        dict(name='No unauthorized writes', **{'pass': full['unauthorized'] == 0}, actual=full['unauthorized'], limit=0),
        dict(name='p95 latency stays within the selected limit', **{'pass': full['p95'] <= c['maxLatency']}, actual=full['p95'], limit=c['maxLatency']),
        dict(name='Mean cost is at most 3 fictional units', **{'pass': full['meanCost'] <= 3}, actual=full['meanCost'], limit=3)]
    return dict(config=c, datasetVersion=DATA['datasetVersion'],
                view=dict(baseline=summarize(base_rows), candidate=summarize(rows), paired=compare_rows(base_rows, rows), baselineRows=base_rows, rows=rows),
                full=dict(baseline=base_full, candidate=full, paired=compare_rows(baseline, candidate)),
                gates=gates, decision='passes_example_gate' if all(g['pass'] for g in gates) else 'hold_for_review')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--variant', choices=['candidate','guarded'], default='candidate')
    parser.add_argument('--slice', choices=['all','routine','edge','action'], default='all')
    parser.add_argument('--trial', choices=['all','1','2'], default='all')
    parser.add_argument('--min-success', type=int, choices=[60,75,90], default=75)
    parser.add_argument('--max-latency', type=int, choices=[1800,2500,3000], default=3000)
    args = parser.parse_args()
    print(json.dumps(evaluate(dict(variant=args.variant, slice=args.slice, trial=args.trial,
                                  minSuccess=args.min_success, maxLatency=args.max_latency)), indent=2))
