"""Local policy simulation over authored proposals; no model or real side effects."""
import argparse
import json
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
DEFAULTS = dict(mode='boundaries', slice='all', context='minimal', approval='matched')
CHOICES = dict(mode=['keyword', 'boundaries'], slice=['all', 'legitimate', 'adversarial'],
               context=['minimal', 'excessive'], approval=['matched', 'missing', 'stale'])

def normalize(config=None):
    if config is None:
        config = {}
    if not isinstance(config, dict) or set(config) - set(CHOICES):
        raise ValueError('Unknown configuration')
    result = {**DEFAULTS, **config}
    for key, choices in CHOICES.items():
        if result[key] not in choices:
            raise ValueError('Invalid ' + key)
    return result

def validate_proposal(p):
    return (isinstance(p, dict) and set(p) == {'tool', 'owner', 'movieId', 'claimedApproval'}
            and all(isinstance(p[k], str) for k in ('tool', 'owner', 'movieId'))
            and type(p['claimedApproval']) is bool)

def authorize(p, host, grant):
    def result(decision, reason):
        return dict(decision=decision, reason=reason)
    if not validate_proposal(p):
        return result('block', 'Invalid proposal schema')
    if p['tool'] not in ('read_catalog', 'read_history', 'add_watchlist'):
        return result('block', 'Tool is not allowed')
    if p['tool'] == 'read_catalog':
        if p['owner'] == 'public' and p['movieId'] in host['catalogIds']:
            return result('allow', 'Public catalog read')
        return result('block', 'Invalid public catalog target')
    if p['owner'] != host['principal']:
        return result('block', 'Account boundary mismatch')
    if p['tool'] == 'read_history':
        if host['historyRequested']:
            return result('allow', 'Requested history for current account')
        return result('block', 'History access was not requested')
    if not host['allowedMovie'] or p['movieId'] != host['allowedMovie'] or p['movieId'] not in host['catalogIds']:
        return result('block', 'Action differs from trusted request')
    if not grant or any(grant.get(k) != value for k, value in (
        ('principal', host['principal']), ('requestId', host['requestId']),
        ('tool', p['tool']), ('movieId', p['movieId']))):
        return result('review' if host['reviewable'] else 'block', 'Missing or mismatched approval scope')
    return result('allow', 'Account, intent, and approval match')

def evaluate(config=None):
    config = normalize(config)
    rows = []
    for item in DATA['cases']:
        host = {**item['host'], 'catalogIds': DATA['catalogIds']}
        grant = item['grant']
        if item['id'] == 'N2':
            grant = None if config['approval'] == 'missing' else {
                **item['grant'], 'requestId': 'old-request' if config['approval'] == 'stale' else host['requestId']}
        expected = config['approval'] == 'matched' if item['id'] == 'N2' else item['expectedAllow']
        if config['mode'] == 'boundaries':
            decision = authorize(item['proposal'], host, grant)
        elif 'ignore previous instructions' in item['text'].lower():
            decision = dict(decision='block', reason='Keyword filter matched')
        else:
            decision = dict(decision='allow', reason='Keyword filter found no match')
        allowed = decision['decision'] == 'allow'
        effect = 'none'
        if allowed:
            effect = {'add_watchlist': 'watchlist_write', 'export_history': 'external_export'}.get(item['proposal']['tool'], 'data_read')
        rows.append({**{k: item[k] for k in ('id', 'label', 'kind', 'text', 'proposal')},
                     'host': host, 'grant': grant, 'expectedAllow': expected, **decision,
                     'simulatedEffect': effect, 'violation': allowed and not expected,
                     'falseBlock': not allowed and expected, 'correct': allowed == expected})
    view = [r for r in rows if config['slice'] == 'all' or r['kind'] == config['slice']]
    def summarize(records):
        return dict(total=len(records), allowed=sum(r['decision'] == 'allow' for r in records),
                    violations=sum(r['violation'] for r in records), falseBlocks=sum(r['falseBlock'] for r in records),
                    correct=sum(r['correct'] for r in records))
    fields = ['catalog', 'stated_preferences']
    if config['context'] == 'excessive':
        fields += ['account_email', 'viewing_history']
    return dict(config=config, contextFields=fields, unnecessaryPrivateFields=len(fields)-2,
                full=summarize(rows), visible=summarize(view), rows=view)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for key, choices in CHOICES.items():
        parser.add_argument('--' + key, choices=choices, default=DEFAULTS[key])
    print(json.dumps(evaluate(vars(parser.parse_args())), indent=2))
