"""Scripted tool proposals and a small explicit workflow. Python 3.9+, no packages."""
import argparse
import json
from pathlib import Path

DATA = json.loads((Path(__file__).with_name('data.json')).read_text(encoding='utf-8'))
DEFAULTS = dict(scenario='happy', retries=1, budget=4, canWrite=True, authorized=True, deduplicate=True)


def compact(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False)


class ToolError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def validate_call(name, raw):
    import re
    fields = {'lookup_movie': {'movie_id', 'region'}, 'add_to_watchlist': {'movie_id'}}
    if name not in fields:
        raise ToolError('unknown_tool', 'Tool is outside the allowlist.')
    try:
        if not isinstance(raw, str):
            raise ValueError()
        args = json.loads(raw)
    except (ValueError, TypeError):
        raise ToolError('invalid_json', 'Arguments must be a JSON string encoding an object.') from None
    if not isinstance(args, dict) or set(args) != fields[name]:
        raise ToolError('invalid_schema', 'Arguments must contain exactly the required fields.')
    if (not isinstance(args['movie_id'], str) or not re.fullmatch(r'M[0-9]{3}', args['movie_id'])
            or (name == 'lookup_movie' and args['region'] not in ('IN', 'GB'))):
        raise ToolError('invalid_schema', 'Movie ID or region has the wrong type or value.')
    return args


class WatchlistStore:
    """One process, in memory; not a durable or concurrent production service."""
    def __init__(self):
        self.rows = []
        self.receipts = {}

    def save(self, user, movie, key, deduplicate=True):
        if (not isinstance(user, str) or not user or not isinstance(key, str) or not key
                or not any(m['movie_id'] == movie for m in DATA['movies'])):
            raise ToolError('invalid_write', 'Invalid server-side write context.')
        scoped = (user, key)
        fingerprint = compact({'movie_id': movie})
        if deduplicate and scoped in self.receipts:
            prior = self.receipts[scoped]
            if prior['fingerprint'] != fingerprint:
                raise ToolError('key_conflict', 'This operation key already belongs to different arguments.')
            return dict(prior['receipt'], replayed=True)
        self.rows.append({'user': user, 'movie_id': movie})
        receipt = {'receipt_id': f'R{len(self.rows)}', 'movie_id': movie, 'saved': True}
        if deduplicate:
            self.receipts[scoped] = {'fingerprint': fingerprint, 'receipt': receipt}
        return dict(receipt, replayed=False)


def run_workflow(options=None):
    if options is None:
        options = {}
    if not isinstance(options, dict) or set(options) - set(DEFAULTS):
        raise ValueError('Invalid workflow configuration.')
    c = dict(DEFAULTS, **options)
    if (c['scenario'] not in [s['id'] for s in DATA['scenarios']]
            or type(c['retries']) is not int or c['retries'] not in (0, 1, 2)
            or type(c['budget']) is not int or c['budget'] not in (1, 2, 3, 4)
            or any(type(c[k]) is not bool for k in ('canWrite', 'authorized', 'deduplicate'))):
        raise ValueError('Invalid workflow configuration.')
    trace, store = [], WatchlistStore()
    user, movie, region, key = 'viewer-1', 'M002' if c['scenario'] == 'unavailable' else 'M001', 'IN', 'request-31-save'
    attempts, ambiguous = 0, False

    def event(state, call_id, code, detail):
        trace.append(dict(step=len(trace)+1, state=state, call_id=call_id, code=code, detail=detail))

    def finish(status, answer):
        return dict(config=c, status=status, answer=answer, attempts=attempts,
                    backendRows=[dict(r) for r in store.rows], trace=trace)

    def invoke(name, args, call_id):
        nonlocal attempts, ambiguous
        event('proposed', call_id, name, args)
        try:
            parsed = validate_call(name, args)
        except ToolError as exc:
            event('blocked', call_id, exc.code, str(exc))
            return dict(stop='blocked', message=str(exc))
        event('validated', call_id, 'schema_ok', 'Arguments satisfy the local contract.')
        if not any(m['movie_id'] == parsed['movie_id'] for m in DATA['movies']):
            event('blocked', call_id, 'unknown_movie', 'Movie ID does not exist.')
            return dict(stop='blocked', message='Movie ID does not exist.')
        if name == 'add_to_watchlist':
            if not c['canWrite']:
                event('blocked', call_id, 'permission_denied', 'Authenticated account lacks write permission.')
                return dict(stop='blocked', message='Write permission is missing. Nothing was saved.')
            if not c['authorized'] or parsed['movie_id'] != movie:
                event('blocked', call_id, 'intent_mismatch', 'User authorization does not cover this exact movie.')
                return dict(stop='blocked', message='This movie action is not authorized. Nothing was saved.')
            event('authorized', call_id, 'write_allowed', 'Account permission and exact movie intent match.')
        for attempt in range(c['retries']+1):
            if attempts >= c['budget']:
                event('stopped', call_id, 'budget_exhausted', 'No execution attempts remain.')
                return dict(stop='needs_reconciliation' if ambiguous else 'budget_exhausted',
                            message='Save outcome is unknown. Check the operation receipt before trying again.' if ambiguous else 'Attempt budget reached. Nothing was saved.')
            attempts += 1
            event('executing', call_id, 'attempt', f'Attempt {attempt+1}; total {attempts}.')
            if name == 'lookup_movie':
                if c['scenario'] == 'read_timeout' and attempt == 0:
                    event('error', call_id, 'read_timeout', 'No lookup result arrived.')
                else:
                    row = next(m for m in DATA['movies'] if m['movie_id'] == parsed['movie_id'])
                    result = dict(movie_id='M002' if c['scenario'] == 'bad_result' else row['movie_id'],
                                  title=row['title'], available=parsed['region'] in row['regions'], region=parsed['region'])
                    if result['movie_id'] != parsed['movie_id']:
                        event('blocked', call_id, 'invalid_result', 'Returned movie does not match the requested movie.')
                        return dict(stop='failed', message='Lookup returned inconsistent evidence. Nothing was saved.')
                    event('result', call_id, 'lookup_ok', compact(result))
                    return dict(result=result)
            else:
                receipt = store.save(user, parsed['movie_id'], key, c['deduplicate'])
                if c['scenario'] == 'lost_receipt' and attempt == 0:
                    ambiguous = True
                    event('error', call_id, 'write_timeout', 'No save receipt arrived; commit status is unknown to the caller.')
                else:
                    ambiguous = False
                    event('result', call_id, 'receipt_replayed' if receipt['replayed'] else 'save_ok', compact(receipt))
                    return dict(result=receipt)
            if attempt < c['retries']:
                event('retry', call_id, 'retry_scheduled', f'Simulated backoff {2**attempt} s; reuse the same operation key.')
        return dict(stop='needs_reconciliation' if ambiguous else 'failed',
                    message='Save outcome is unknown. Check the operation receipt before trying again.' if ambiguous else 'Lookup failed after the allowed attempts. Nothing was saved.')

    lookup_name, lookup_args = 'lookup_movie', compact(dict(movie_id=movie, region=region))
    if c['scenario'] == 'bad_json':
        lookup_args = '{"movie_id":'
    elif c['scenario'] == 'extra_field':
        lookup_args = compact(dict(movie_id=movie, region=region, user='someone-else'))
    elif c['scenario'] == 'unknown_tool':
        lookup_name = 'delete_account'
    elif c['scenario'] == 'unknown_movie':
        lookup_args = compact(dict(movie_id='M999', region=region))
    lookup = invoke(lookup_name, lookup_args, 'call-lookup')
    if 'stop' in lookup:
        return finish(lookup['stop'], lookup['message'])
    if not lookup['result']['available']:
        event('stopped', 'call-lookup', 'not_available', 'Regional availability condition is false.')
        return finish('not_available', 'Neon Chase is unavailable in the IN teaching catalog. Nothing was saved.')
    saved = invoke('add_to_watchlist', compact(dict(movie_id='M002' if c['scenario'] == 'changed_movie' else movie)), 'call-save')
    if 'stop' in saved:
        return finish(saved['stop'], saved['message'])
    event('completed', 'call-save', 'verified_receipt', 'Final message is based on the received save receipt.')
    return finish('completed', f"{lookup['result']['title']} was saved to your watchlist.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scenario', choices=[s['id'] for s in DATA['scenarios']], default='happy')
    parser.add_argument('--retries', type=int, choices=(0, 1, 2), default=1)
    parser.add_argument('--budget', type=int, choices=(1, 2, 3, 4), default=4)
    parser.add_argument('--deny-write', action='store_true')
    parser.add_argument('--no-authorization', action='store_true')
    parser.add_argument('--no-deduplicate', action='store_true')
    args = parser.parse_args()
    print(json.dumps(run_workflow(dict(scenario=args.scenario, retries=args.retries, budget=args.budget,
                                     canWrite=not args.deny_write, authorized=not args.no_authorization,
                                     deduplicate=not args.no_deduplicate)), indent=2))


if __name__ == '__main__':
    main()
