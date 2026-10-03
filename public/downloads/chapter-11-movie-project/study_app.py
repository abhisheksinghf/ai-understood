"""Chapter 11 note project. Python 3.10+, standard library, offline by default."""
import argparse
import json
from pathlib import Path
from llm_core import load_json, run_recommender, FixtureProvider

TOPICS = ['any', 'learning', 'data', 'search', 'math', 'optimization']
DEFAULT = {'topic': 'learning', 'max_minutes': 30, 'prefer_introductory': True, 'completed_ids': []}
ROOT = Path(__file__).resolve().parent


def exact(value, keys):
    return isinstance(value, dict) and set(value) == set(keys)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def validate_catalog(data):
    import re
    if not exact(data, ['version', 'notes']) or not nonempty(data['version']) or not isinstance(data['notes'], list) or len(data['notes']) > 100:
        raise ValueError('Catalog needs a version and at most 100 note records.')
    ids = set()
    for m in data['notes']:
        if not exact(m, ['id', 'title', 'topics', 'level', 'estimated_minutes', 'exam_date', 'text']) or not isinstance(m['id'], str) or not re.fullmatch(r'N[0-9]{2}', m['id']) or m['id'] in ids or (not nonempty(m['title']) or not nonempty(m['text'])):
            raise ValueError('Note fields, IDs, or title are invalid.')
        gs = m['topics']
        if not isinstance(gs, list) or not gs or not all(isinstance(g, str) and g in TOPICS[1:] for g in gs) or len(set(gs)) != len(gs):
            raise ValueError('Note topics must be distinct known topics.')
        minutes = m['estimated_minutes']
        if m['level'] not in ['introductory', 'advanced'] or not (minutes is None or (type(minutes) is int and 0 < minutes <= 600)) or not (m['exam_date'] is None or nonempty(m['exam_date'])):
            raise ValueError('Note level, study-time estimate, or exam date is invalid.')
        ids.add(m['id'])


def validate_preferences(p, data):
    if not exact(p, ['topic', 'max_minutes', 'prefer_introductory', 'completed_ids']):
        raise ValueError('Expected exactly the four preference fields.')
    seen = p['completed_ids']
    known = {m['id'] for m in data['notes']}
    if p['topic'] not in TOPICS or type(p['max_minutes']) is not int or not 5 <= p['max_minutes'] <= 120 or type(p['prefer_introductory']) is not bool or not isinstance(seen, list) or not all(isinstance(s, str) and s in known for s in seen) or len(set(seen)) != len(seen):
        raise ValueError('Choose a known topic, whole minutes from 5 to 120, an introductory-level preference, and distinct known completed IDs.')


def recommend(preferences, catalog):
    validate_catalog(catalog)
    validate_preferences(preferences, catalog)
    p = preferences
    decisions, eligible = [], []
    for m in catalog['notes']:
        reasons = []
        if p['topic'] != 'any' and p['topic'] not in m['topics']:
            reasons.append('Topic does not match')
        if m['estimated_minutes'] is None:
            reasons.append('Study-time estimate unknown')
        elif m['estimated_minutes'] > p['max_minutes']:
            reasons.append('Over time limit')
        if m['id'] in p['completed_ids']:
            reasons.append('Already completed')
        score = int(p['prefer_introductory'] and m['level'] == 'introductory') if not reasons else None
        decisions.append({'note_id': m['id'], 'title': m['title'], 'eligible': not reasons, 'reasons': reasons, 'score': score})
        if not reasons:
            eligible.append(m)
    eligible.sort(key=lambda m: (-int(p['prefer_introductory'] and m['level'] == 'introductory'), m['estimated_minutes'], m['id']))
    card = None
    if eligible:
        m = eligible[0]
        card = {'note_id': m['id'], 'title': m['title'], 'topics': m['topics'], 'level': m['level'], 'estimated_minutes': m['estimated_minutes'], 'exam_date': m['exam_date'], 'text': m['text'],
                'reason': f"{m['title']} has an estimated study time of {m['estimated_minutes']} minutes, within your {p['max_minutes']}-minute limit. Topic: {', '.join(m['topics'])}. Level: {m['level']}. Selected by the stated ranking rule; learning benefit is not guaranteed."}
    return {'status': 'ok' if card else 'no_match', 'catalog_version': catalog['version'], 'request': p, 'recommendation': card, 'eligible_ids': [m['id'] for m in eligible], 'decisions': decisions}


def build_sources(result):
    if result['recommendation'] is None:
        raise ValueError('Do not request an explanation when no note matches.')
    m = result['recommendation']
    return [
        {'id': 'S1', 'text': 'Learner preferences: ' + json.dumps(result['request'])},
        {'id': 'S2', 'text': 'Selected authored note from ' + result['catalog_version'] + ': ' + json.dumps({k: m[k] for k in ['note_id', 'title', 'topics', 'level', 'estimated_minutes', 'text']})},
        {'id': 'S3', 'text': 'Exam date in this authored study pack: ' + json.dumps(m['exam_date']) + '. Null means unknown, not proof that no exam exists.'},
    ]


def template_provider(result, unsupported=False):
    """An authored template response for exercising the LLM boundary, not a model."""
    m = result['recommendation']
    candidate = {'recommendation': m['reason'] + ' [S1, S2]', 'exam_date': m['exam_date'], 'evidence_ids': ['S1', 'S2', 'S3'], 'open_questions': [] if m['exam_date'] else ['When is the exam for this topic?']}
    if unsupported:
        candidate['exam_date'] = '2026-12-01 [S1]'
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
