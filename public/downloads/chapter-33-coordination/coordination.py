"""Deterministic coordination teaching model; no live agents or MCP transport."""
import argparse
import copy
import json
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
DEFAULTS = dict(scenario='normal', pattern='manager', schedule='parallel', budget=3, validate=True)


def availability_report(scenario):
    return dict(worker='availability', status='timeout' if scenario == 'missing' else 'ok',
                region='US' if scenario == 'wrong_region' else DATA['region'],
                version='catalog-v1' if scenario == 'stale' else DATA['version'],
                source='availability-fixture',
                records=[] if scenario == 'missing' else [dict(movie_id='M001', available=False), dict(movie_id='M003', available=True)] + ([dict(movie_id='M003', available=False)] if scenario == 'conflict' else []))


def verify_availability(report, movie_id):
    if not report or report.get('status') != 'ok':
        return dict(ok=False, reason='Availability is missing; unknown is not unavailable.')
    if report.get('region') != DATA['region']:
        return dict(ok=False, reason='Availability region does not match IN.')
    if report.get('version') != DATA['version']:
        return dict(ok=False, reason='Availability snapshot does not match catalog-v2.')
    rows = report.get('records')
    if report.get('source') != 'availability-fixture' or not isinstance(rows, list) or any(not isinstance(r, dict) or r.get('movie_id') not in [m['id'] for m in DATA['movies']] or type(r.get('available')) is not bool for r in rows):
        return dict(ok=False, reason='Availability records fail the result contract.')
    matching = [r for r in rows if r['movie_id'] == movie_id]
    if not matching:
        return dict(ok=False, reason='No availability record for this movie.')
    if len({r['available'] for r in matching}) > 1:
        return dict(ok=False, reason='Matching records disagree; resolve the conflict.')
    available = matching[0]['available']
    return dict(ok=available, reason='Matching evidence verifies availability.' if available else 'Movie is unavailable in this snapshot.')


def run_coordination(config=None):
    supplied = config or {}
    c = {**DEFAULTS, **supplied}
    if set(supplied) - set(DEFAULTS) or c['scenario'] not in [s['id'] for s in DATA['scenarios']] or c['pattern'] not in ('manager', 'handoff') or c['schedule'] not in ('parallel', 'sequential') or type(c['budget']) is not int or c['budget'] not in (1, 2, 3) or type(c['validate']) is not bool:
        raise ValueError('Invalid experiment configuration')
    owner = 'Manager' if c['pattern'] == 'manager' else 'Movie specialist'
    jobs = [dict(worker='catalog', start=0, end=2, owner='Manager')]
    reports = dict(catalog=dict(worker='catalog', status='ok', version=DATA['version'], movies=copy.deepcopy(DATA['movies'])))
    if c['budget'] >= 2:
        jobs.append(dict(worker='availability', start=2, end=5, owner=owner))
        reports['availability'] = availability_report(c['scenario'])
    if c['budget'] >= 3:
        start = 2 if c['schedule'] == 'parallel' else 5
        jobs.append(dict(worker='taste', start=start, end=start+2, owner=owner))
        reports['taste'] = dict(worker='taste', status='ok', version=DATA['version'], ranking=copy.deepcopy(DATA['ranking']), source='taste-fixture', reason='Harbor Lights has the gentler pace in our fictional review notes.')
    notes = []
    suggested = reports['taste']['ranking'][0] if 'taste' in reports else None
    chosen, status = None, 'incomplete'
    if 'taste' not in reports:
        notes.append('Taste report was not scheduled: specialist-job budget reached.')
    if 'availability' not in reports:
        notes.append('Availability report was not scheduled: specialist-job budget reached.')
    if suggested:
        check = verify_availability(reports.get('availability'), suggested)
        if c['validate']:
            if check['ok']:
                chosen, status = suggested, 'verified'
            else:
                status = 'insufficient_evidence'
                notes.append(check['reason'])
        else:
            chosen = suggested
            status = 'accepted_unchecked' if check['ok'] else 'unsupported'
            notes.append('Checks bypassed: the coordinator trusts the taste suggestion without verifying availability.')
            if not check['ok']:
                notes.append(check['reason'])
    elapsed = max(j['end'] for j in jobs) + DATA['durations']['final']
    movie = next((m for m in DATA['movies'] if m['id'] == chosen), None)
    answer = (f"{movie['title']}, {movie['minutes']} minutes, for India. " + ('Availability verified in the fixture.' if c['validate'] else 'This unchecked answer may lack supporting evidence.')) if movie else 'No recommendation finalized. Complete or repair the missing evidence first.'
    return dict(config=c, owner=owner, status=status, chosen=chosen, answer=answer, jobs=jobs, reports=reports, notes=notes, elapsed=elapsed, jobCount=len(jobs), workUnits=sum(j['end']-j['start'] for j in jobs)+1, handoffs=1 if c['pattern'] == 'handoff' else 0)


def protocol_transcript():
    tool = dict(name='check_availability', description='Read fictional regional availability.', inputSchema=dict(type='object', properties=dict(movie_id=dict(type='string'), region=dict(type='string')), required=['movie_id', 'region'], additionalProperties=False))
    return [
        dict(jsonrpc='2.0', id=1, method='initialize', params=dict(protocolVersion='2025-11-25', capabilities={}, clientInfo=dict(name='movie-host', version='1.0.0'))),
        dict(jsonrpc='2.0', id=1, result=dict(protocolVersion='2025-11-25', capabilities=dict(tools={}), serverInfo=dict(name='movie-server', version='1.0.0'))),
        dict(jsonrpc='2.0', method='notifications/initialized'),
        dict(jsonrpc='2.0', id=2, method='tools/list', params={}),
        dict(jsonrpc='2.0', id=2, result=dict(tools=[tool])),
        dict(jsonrpc='2.0', id=3, method='tools/call', params=dict(name='check_availability', arguments=dict(movie_id='M003', region='IN'))),
        dict(jsonrpc='2.0', id=3, result=dict(content=[dict(type='text', text='M003 is available in IN in this fictional snapshot.')], isError=False))
    ]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scenario', choices=[s['id'] for s in DATA['scenarios']], default='normal')
    parser.add_argument('--pattern', choices=['manager', 'handoff'], default='manager')
    parser.add_argument('--schedule', choices=['parallel', 'sequential'], default='parallel')
    parser.add_argument('--budget', type=int, choices=[1, 2, 3], default=3)
    parser.add_argument('--no-validation', action='store_true')
    parser.add_argument('--protocol', action='store_true')
    args = parser.parse_args()
    output = protocol_transcript() if args.protocol else run_coordination(dict(scenario=args.scenario, pattern=args.pattern, schedule=args.schedule, budget=args.budget, validate=not args.no_validation))
    print(json.dumps(output, indent=2))
