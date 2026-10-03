"""Chapter 11 movie project. Python 3.10+, standard library, offline by default."""
import argparse
import json
from pathlib import Path
from llm_core import load_json, run_recommender, FixtureProvider

GENRES = ['any', 'adventure', 'comedy', 'action', 'drama', 'sci-fi']
DEFAULT = {'genre': 'adventure', 'max_minutes': 120, 'prefer_light': True, 'seen_ids': []}
ROOT = Path(__file__).resolve().parent


def exact(value, keys):
    return isinstance(value, dict) and set(value) == set(keys)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def validate_catalog(data):
    import re
    if not exact(data, ['version', 'movies']) or not nonempty(data['version']) or not isinstance(data['movies'], list) or len(data['movies']) > 100:
        raise ValueError('Catalog needs a version and at most 100 movie records.')
    ids = set()
    for m in data['movies']:
        if not exact(m, ['id', 'title', 'genres', 'tone', 'runtime_minutes', 'streaming_service']) or not isinstance(m['id'], str) or not re.fullmatch(r'M[0-9]{3}', m['id']) or m['id'] in ids or not nonempty(m['title']):
            raise ValueError('Movie fields, IDs, or title are invalid.')
        gs = m['genres']
        if not isinstance(gs, list) or not gs or not all(isinstance(g, str) and g in GENRES[1:] for g in gs) or len(set(gs)) != len(gs):
            raise ValueError('Movie genres must be distinct known genres.')
        minutes = m['runtime_minutes']
        if m['tone'] not in ['light', 'serious'] or not (minutes is None or (type(minutes) is int and 0 < minutes <= 600)) or not (m['streaming_service'] is None or nonempty(m['streaming_service'])):
            raise ValueError('Movie tone, runtime, or service is invalid.')
        ids.add(m['id'])


def validate_preferences(p, data):
    if not exact(p, ['genre', 'max_minutes', 'prefer_light', 'seen_ids']):
        raise ValueError('Expected exactly the four preference fields.')
    seen = p['seen_ids']
    known = {m['id'] for m in data['movies']}
    if p['genre'] not in GENRES or type(p['max_minutes']) is not int or not 30 <= p['max_minutes'] <= 240 or type(p['prefer_light']) is not bool or not isinstance(seen, list) or not all(isinstance(s, str) and s in known for s in seen) or len(set(seen)) != len(seen):
        raise ValueError('Choose a known genre, whole minutes from 30 to 240, a light-tone preference, and distinct known seen IDs.')


def recommend(preferences, catalog):
    validate_catalog(catalog)
    validate_preferences(preferences, catalog)
    p = preferences
    decisions, eligible = [], []
    for m in catalog['movies']:
        reasons = []
        if p['genre'] != 'any' and p['genre'] not in m['genres']:
            reasons.append('Genre does not match')
        if m['runtime_minutes'] is None:
            reasons.append('Runtime unknown')
        elif m['runtime_minutes'] > p['max_minutes']:
            reasons.append('Over time limit')
        if m['id'] in p['seen_ids']:
            reasons.append('Already seen')
        score = int(p['prefer_light'] and m['tone'] == 'light') if not reasons else None
        decisions.append({'movie_id': m['id'], 'title': m['title'], 'eligible': not reasons, 'reasons': reasons, 'score': score})
        if not reasons:
            eligible.append(m)
    eligible.sort(key=lambda m: (-int(p['prefer_light'] and m['tone'] == 'light'), m['runtime_minutes'], m['id']))
    card = None
    if eligible:
        m = eligible[0]
        card = {'movie_id': m['id'], 'title': m['title'], 'genres': m['genres'], 'tone': m['tone'], 'runtime_minutes': m['runtime_minutes'], 'streaming_service': m['streaming_service'],
                'reason': f"{m['title']} is {m['runtime_minutes']} minutes, within your {p['max_minutes']}-minute limit. Genre: {', '.join(m['genres'])}. Tone: {m['tone']}. Selected by the stated ranking rule; enjoyment is not guaranteed."}
    return {'status': 'ok' if card else 'no_match', 'catalog_version': catalog['version'], 'request': p, 'recommendation': card, 'eligible_ids': [m['id'] for m in eligible], 'decisions': decisions}


def build_sources(result):
    if result['recommendation'] is None:
        raise ValueError('Do not request an explanation when no movie matches.')
    m = result['recommendation']
    return [
        {'id': 'S1', 'text': 'Viewer preferences: ' + json.dumps(result['request'])},
        {'id': 'S2', 'text': 'Selected fictional movie from ' + result['catalog_version'] + ': ' + json.dumps({k: m[k] for k in ['movie_id', 'title', 'genres', 'tone', 'runtime_minutes']})},
        {'id': 'S3', 'text': 'Streaming service in this fictional catalog: ' + json.dumps(m['streaming_service']) + '. Null means unknown, not unavailable.'},
    ]


def template_provider(result, unsupported=False):
    """An authored template response for exercising the LLM boundary, not a model."""
    m = result['recommendation']
    candidate = {'recommendation': m['reason'] + ' [S1, S2]', 'streaming_service': m['streaming_service'], 'evidence_ids': ['S1', 'S2', 'S3'], 'open_questions': [] if m['streaming_service'] else ['Where can this movie be streamed?']}
    if unsupported:
        candidate['streaming_service'] = 'ExampleFlix [S1]'
    envelope = {'status': 'completed', 'output': [{'type': 'message', 'role': 'assistant', 'status': 'completed', 'content': [{'type': 'output_text', 'text': json.dumps(candidate)}]}]}
    return FixtureProvider([{'response': envelope}])


def add_draft(result, provider):
    """Keep trusted-by-construction catalog fields separate from unreviewed prose."""
    if result['recommendation'] is None:
        return {**result, 'draft': {'status': 'not_requested', 'attempts': 0, 'candidate': None}}
    return {**result, 'draft': run_recommender(build_sources(result), provider, max_attempts=1)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preferences', type=Path, default=ROOT/'preferences.json')
    parser.add_argument('--catalog', type=Path, default=ROOT/'catalog.json')
    parser.add_argument('--draft', choices=['none', 'template', 'unsupported', 'live'], default='none')
    args = parser.parse_args()
    try:
        p = load_json(args.preferences.read_text(encoding='utf-8'))
        data = load_json(args.catalog.read_text(encoding='utf-8'))
        result = recommend(p, data)
        result['mode'] = 'offline rules and template; no LLM'
        if args.draft != 'none' and result['recommendation']:
            if args.draft == 'live':
                from provider import OpenAIProvider
                provider = OpenAIProvider.from_environment()
                result['mode'] = 'live LLM explanation; review draft separately'
            else:
                provider = template_provider(result, unsupported=args.draft == 'unsupported')
            result = add_draft(result, provider)
        elif args.draft != 'none':
            result['draft'] = {'status': 'not_requested', 'attempts': 0, 'candidate': None}
    except (ValueError, OSError, UnicodeError) as error:
        print(json.dumps({'status': 'invalid_input_or_setup', 'detail': str(error)}))
        return 2
    print(json.dumps(result, indent=2, ensure_ascii=False))
    # No match is a valid product outcome. A requested but failed draft exits 1.
    draft = result.get('draft', {})
    return 1 if draft.get('status') not in (None, 'review_required', 'not_requested') else 0


if __name__ == '__main__':
    raise SystemExit(main())
