"""Deterministic rollout simulation; no network, model calls, sleeps or deployment."""
import argparse
import json
import math
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
DEFAULTS = dict(scenario='bad_release', share=20, retries=1, deadline=2400, rollback='automatic')
CHOICES = dict(scenario=['healthy', 'bad_release', 'provider_fault'], share=[0, 20, 60, 100],
               retries=[0, 1], deadline=[1200, 2400], rollback=['automatic', 'observe'])

def normalize(config=None):
    if config is None:
        config = {}
    if not isinstance(config, dict) or set(config) - set(CHOICES):
        raise ValueError('Unknown configuration')
    result = {**DEFAULTS, **config}
    for key, choices in CHOICES.items():
        if not any(type(result[key]) is type(v) and result[key] == v for v in choices):
            raise ValueError('Invalid ' + key)
    return result

def run_request(request, version, config):
    if version not in DATA['versions']:
        raise ValueError('Unknown version')
    spec = DATA['versions'][version]
    attempts = []
    elapsed, cost, status, quality, reason = 0, 0, 503, False, 'provider_error'
    for attempt in range(1, config['retries'] + 2):
        if attempt > 1:
            if elapsed + DATA['backoffMs'] >= config['deadline']:
                reason = 'retry_budget_exhausted'
                break
            elapsed += DATA['backoffMs']
        fault = config['scenario'] == 'provider_fault' and (request['slot'] == 3 or (request['slot'] == 1 and attempt == 1))
        duration = DATA['faultDurationMs'] if fault else spec['durationMs']
        units = DATA['faultCostUnits'] if fault else spec['costUnits']
        remaining = config['deadline'] - elapsed
        used, timed_out = min(duration, remaining), duration > remaining
        elapsed += used
        cost += units
        status = 504 if timed_out else 503 if fault else 200
        quality = status == 200 and not (config['scenario'] == 'bad_release' and version == 'candidate' and request['slot'] in (1, 3))
        reason = 'deadline_exceeded' if timed_out else 'provider_error' if status == 503 else 'good' if quality else 'wrong_recommendation'
        attempts.append(dict(attempt=attempt, status=status, durationMs=used, costUnits=units, quality=quality))
        if status != 503:
            break
    return dict(id=request['id'], window=request['window'], slot=request['slot'], version=version, status=status,
                quality=quality, good=status == 200 and quality and elapsed <= config['deadline'],
                elapsedMs=elapsed, costUnits=cost, reason=reason, attempts=attempts)

def summarize(rows):
    n, good = len(rows), sum(r['good'] for r in rows)
    times = sorted(r['elapsedMs'] for r in rows)
    return dict(n=n, good=good, bad=n-good, goodPercent=100*good/n if n else None,
                httpOk=sum(r['status'] == 200 for r in rows), candidate=sum(r['version'] == 'candidate' for r in rows),
                attempts=sum(len(r['attempts']) for r in rows), costUnits=sum(r['costUnits'] for r in rows),
                p95=times[math.ceil(.95*n)-1] if n else None)

def evaluate(config=None):
    config = normalize(config)
    rows, windows, rolled_back, rollback_after = [], [], False, None
    for window in range(1, 5):
        batch = [run_request(r, 'candidate' if not rolled_back and r['slot'] <= config['share']/20 else 'baseline', config)
                 for r in DATA['requests'] if r['window'] == window]
        rows += batch
        canary = [r for r in batch if r['version'] == 'candidate']
        failed = any(not r['good'] for r in canary)
        action = ('rollback_next_window' if config['rollback'] == 'automatic' else 'review_needed') if failed else 'observe' if canary else 'baseline_only'
        if failed and config['rollback'] == 'automatic' and not rolled_back:
            rolled_back, rollback_after = True, window
        windows.append(dict(window=window, **summarize(batch), candidateBad=sum(not r['good'] for r in canary), action=action))
    totals = summarize(rows)
    allowed = totals['n']*(100-DATA['sloPercent'])/100
    decision = 'rolled_back' if rolled_back else 'review_needed' if any(w['action'] == 'review_needed' for w in windows) else 'baseline_only' if config['share'] == 0 else 'observe_more'
    return dict(config=config, totals=totals, allowedBad=allowed, budgetRemaining=allowed-totals['bad'],
                sloMet=totals['goodPercent'] >= DATA['sloPercent'], rollbackAfter=rollback_after,
                decision=decision, windows=windows, rows=rows)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for key, choices in CHOICES.items():
        parser.add_argument('--' + key, type=type(DEFAULTS[key]), choices=choices, default=DEFAULTS[key])
    print(json.dumps(evaluate(vars(parser.parse_args())), indent=2))
