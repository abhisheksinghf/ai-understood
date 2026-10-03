"""Chapter 42: deterministic, offline movie-assistant reference implementation."""
import argparse
import json
import re
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
DEFAULTS = {'constraints': True, 'aliases': True, 'tool': 'online'}


def configuration(options=None):
    if options is not None and not isinstance(options, dict):
        raise ValueError('Invalid configuration')
    config = {**DEFAULTS, **(options or {})}
    if set(config) != set(DEFAULTS) or type(config['constraints']) is not bool or type(config['aliases']) is not bool or config['tool'] not in ('online', 'timeout'):
        raise ValueError('Invalid configuration')
    return config


def valid(request):
    if not isinstance(request, dict) or not isinstance(request.get('intent'), str):
        return False
    intent = request['intent']
    allowed = {'intent', 'query', 'max_minutes', 'seen'} if intent == 'recommend' else {'intent', 'movie_id', 'region'} if intent == 'availability' else {'intent', 'movie_id'}
    if set(request) - allowed:
        return False
    if intent == 'recommend':
        return (isinstance(request.get('query'), str) and len(request['query']) <= 200
                and bool(re.search(r'[a-z0-9]', request['query'], re.I))
                and type(request.get('max_minutes')) in (int, float) and 0 < request['max_minutes'] <= 600 and request['max_minutes'] % 1 == 0
                and isinstance(request.get('seen'), list) and all(isinstance(x, str) for x in request['seen']))
    return isinstance(request.get('movie_id'), str) and (intent != 'availability' or isinstance(request.get('region'), str) and bool(re.fullmatch(r'[A-Z]{2}', request['region'])))


def run(request, options=None):
    config = configuration(options)
    trace, candidates = [], []

    def finish(status, answer, movie=None, value=None, sources=None):
        return {'status': status, 'answer': answer, 'movie_id': movie['id'] if movie else None,
                'value': value, 'sources': sources or [], 'trace': trace, 'candidates': candidates}

    if not valid(request):
        return finish('invalid_input', 'Supply a valid structured request.')
    intent = request['intent']
    trace.append('Validated request; route: ' + intent + '.')
    if intent not in ('recommend', 'runtime', 'availability'):
        return finish('unsupported_question', 'This assistant supports recommendations, runtimes, and fixture availability.')
    if intent == 'recommend':
        raw = re.findall(r'[a-z0-9]+', request['query'].lower())
        tokens = list(dict.fromkeys(DATA['aliases'].get(t, t) if config['aliases'] else t for t in raw))
        trace.append('Query tokens: ' + ', '.join(tokens) + '.')
        for movie in DATA['movies']:
            score = sum(t in movie['tags'] for t in tokens)
            reasons = []
            if movie['minutes'] > request['max_minutes']:
                reasons.append('over runtime limit')
            if movie['id'] in request['seen']:
                reasons.append('already seen')
            candidates.append({'id': movie['id'], 'title': movie['title'], 'minutes': movie['minutes'],
                               'score': score, 'eligible': not config['constraints'] or not reasons, 'reasons': reasons})
        ranked = sorted((c for c in candidates if c['eligible'] and c['score'] > 0), key=lambda c: -c['score'])
        trace.append('Applied runtime and seen filters before ranking.' if config['constraints'] else 'DEMO: hard constraints bypassed.')
        trace.append('Ranked by tag overlap; ties keep catalog order.')
        if not ranked:
            return finish('no_match', 'No matching movie meets this search configuration.')
        movie = next(m for m in DATA['movies'] if m['id'] == ranked[0]['id'])
        matches = ', '.join(t for t in tokens if t in movie['tags'])
        return finish('ok', f"{movie['title']} ({movie['minutes']} minutes) matches {matches}.", movie, movie['minutes'], [movie['source']])
    movie = next((m for m in DATA['movies'] if m['id'] == request['movie_id']), None)
    if not movie:
        return finish('not_found', 'That movie ID is not in this catalog.')
    if intent == 'runtime':
        trace.append('Read minutes directly from the versioned catalog card.')
        return finish('ok', f"{movie['title']} runs for {movie['minutes']} minutes.", movie, movie['minutes'], [movie['source']])
    trace.append(f"Called read-only availability fixture for {movie['id']} / {request['region']}.")
    if config['tool'] == 'timeout':
        return finish('tool_unavailable', 'Availability lookup timed out; no availability claim can be made.')
    record = next((a for a in DATA['availability'] if a['movie_id'] == movie['id'] and a['region'] == request['region']), None)
    if not record:
        return finish('unknown_availability', 'No availability record for this movie and region.')
    return finish('ok', f"Fixture only: {movie['title']} is listed on {record['service']} in {record['region']}, as of {record['as_of']}.", movie, record['service'], [record['source']])


def evaluate(options=None):
    config = configuration(options)
    rows = []
    for case in DATA['cases']:
        request = case['request']
        result = run(request, config)
        movie = next((m for m in DATA['movies'] if m['id'] == result['movie_id']), None)
        constraints_ok = request['intent'] != 'recommend' or not movie or (movie['minutes'] <= request['max_minutes'] and movie['id'] not in request['seen'])
        record = next((a for a in DATA['availability'] if a['movie_id'] == result['movie_id'] and a['region'] == request.get('region')), None)
        evidence_ok = result['status'] != 'ok' or (bool(record) and result['value'] == record['service'] and result['sources'] == [record['source']] if request['intent'] == 'availability' else bool(movie) and result['value'] == movie['minutes'] and result['sources'] == [movie['source']])
        matched = all(result[k] == v for k, v in case['expected'].items())
        rows.append({'id': case['id'], 'label': case['label'], 'slice': case['slice'], 'expected': case['expected'],
                     'result': result, 'constraintsOk': bool(constraints_ok), 'evidenceOk': bool(evidence_ok), 'passed': bool(matched and constraints_ok and evidence_ok)})
    passed = sum(r['passed'] for r in rows)
    violations = sum(not r['constraintsOk'] for r in rows)
    tool_failures = sum(r['result']['status'] == 'tool_unavailable' for r in rows)
    evidence_failures = sum(not r['evidenceOk'] for r in rows)
    gate = 'Passes demo gate' if passed == len(rows) and violations == tool_failures == evidence_failures == 0 else 'Needs work'
    return {'version': DATA['version'], 'config': config, 'passed': passed, 'total': len(rows), 'rate': passed / len(rows),
            'violations': violations, 'toolFailures': tool_failures, 'evidenceFailures': evidence_failures, 'gate': gate, 'rows': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--case', choices=[c['id'] for c in DATA['cases']])
    parser.add_argument('--request', type=Path, help='Read your own structured JSON request')
    parser.add_argument('--constraints', choices=['on', 'off'], default='on', help='off is an intentionally flawed demo')
    parser.add_argument('--aliases', choices=['on', 'off'], default='on')
    parser.add_argument('--tool', choices=['online', 'timeout'], default='online', help='Both settings use a local fixture')
    args = parser.parse_args()
    if args.case and args.request:
        parser.error('Choose --case or --request, not both')
    config = {'constraints': args.constraints == 'on', 'aliases': args.aliases == 'on', 'tool': args.tool}
    if args.request:
        try:
            request = json.loads(args.request.read_text(encoding='utf-8-sig'))
        except (OSError, ValueError) as exc:
            parser.error(str(exc))
        report = run(request, config)
    elif args.case:
        report = run(next(c['request'] for c in DATA['cases'] if c['id'] == args.case), config)
    else:
        report = evaluate(config)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
