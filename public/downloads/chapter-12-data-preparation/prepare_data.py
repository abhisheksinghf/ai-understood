"""Chapter 12. Audit, split, fit preprocessing on training data, transform all splits.

Python 3.10+, standard library only. Synthetic data; no model training or network.
"""
import argparse
import csv
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COLUMNS = ['event_id', 'viewer_id', 'movie_id', 'runtime_minutes', 'genre', 'liked', 'review_after']
ROLES = ['train', 'validation', 'test']


def read_csv(path):
    with Path(path).open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != COLUMNS:
            raise ValueError('CSV header must match the seven documented columns in order.')
        return list(reader)


def normalize(row):
    if not isinstance(row, dict) or set(row) != set(COLUMNS) or not all(isinstance(row[k], str) for k in COLUMNS):
        raise ValueError('Expected seven text columns.')
    r = {k: row[k].strip() for k in COLUMNS}
    if not re.fullmatch(r'E[0-9]{2}', r['event_id']) or not re.fullmatch(r'U[0-9]{2}', r['viewer_id']) or not re.fullmatch(r'M[0-9]{3}', r['movie_id']):
        raise ValueError('Invalid event, viewer, or movie ID.')
    r['genre'] = r['genre'].lower()
    if r['genre'] == 'sci fi':
        r['genre'] = 'sci-fi'
    if not re.fullmatch(r'[a-z]+(?:-[a-z]+)*', r['genre']):
        raise ValueError('Invalid genre.')
    raw_runtime = r['runtime_minutes']
    if raw_runtime and (not re.fullmatch(r'[0-9]+', raw_runtime) or not 1 <= int(raw_runtime) <= 600):
        raise ValueError('Runtime must be blank or whole minutes from 1 to 600.')
    r['runtime_minutes'] = int(raw_runtime) if raw_runtime else None
    if r['liked'] not in ('', '0', '1'):
        raise ValueError('Label must be blank, 0, or 1.')
    r['liked'] = int(r['liked']) if r['liked'] else None
    return r


def clean_rows(input_rows):
    if not isinstance(input_rows, list) or len(input_rows) > 10000:
        raise ValueError('Supply at most 10000 raw rows.')
    groups, quarantined, unlabeled, rows = {}, [], [], []
    duplicates = 0
    for i, raw in enumerate(input_rows, 1):
        try:
            row = normalize(raw)
            groups.setdefault(row['event_id'], []).append({'row_number': i, 'row': row})
        except ValueError as error:
            quarantined.append({'row_number': i, 'event_id': str(raw.get('event_id', '')) if isinstance(raw, dict) else '', 'reason': str(error)})
    for eid, group in groups.items():
        if len({json.dumps(item['row'], sort_keys=True) for item in group}) > 1:
            quarantined.extend({'row_number': item['row_number'], 'event_id': eid, 'reason': 'Conflicting records for one event ID.'} for item in group)
            continue
        duplicates += len(group) - 1
        first = group[0]
        if first['row']['liked'] is None:
            unlabeled.append({'row_number': first['row_number'], 'event_id': eid})
        else:
            rows.append(first['row'])
    rows.sort(key=lambda r: r['event_id'])
    quarantined.sort(key=lambda r: r['row_number'])
    return {'rows': rows, 'audit': {'raw_rows': len(input_rows), 'kept_rows': len(rows), 'duplicate_rows': duplicates, 'quarantined': quarantined, 'unlabeled': unlabeled}}


def split_rows(rows, plan):
    if not isinstance(plan, dict) or set(plan) != set(ROLES):
        raise ValueError('Plan needs train, validation, and test viewer lists.')
    used = set()
    for role in ROLES:
        if not isinstance(plan[role], list):
            raise ValueError('Each split needs a viewer list.')
        for uid in plan[role]:
            if not isinstance(uid, str) or not re.fullmatch(r'U[0-9]{2}', uid) or uid in used:
                raise ValueError('Viewer groups must be valid, distinct, and disjoint.')
            used.add(uid)
    splits = {role: [] for role in ROLES}
    for row in rows:
        role = next((role for role in ROLES if row['viewer_id'] in plan[role]), None)
        if role is None:
            raise ValueError('A kept viewer is missing from the split plan.')
        splits[role].append(row)
    return splits


def fit_preprocessor(rows, strategy='median'):
    if strategy not in ('mean', 'median'):
        raise ValueError('Choose mean or median.')
    if not rows:
        raise ValueError('No rows to fit.')
    known = sorted(r['runtime_minutes'] for r in rows if r['runtime_minutes'] is not None)
    if not known:
        raise ValueError('No observed training runtime; choose an explicit alternative.')
    mid = len(known) // 2
    fill_value = sum(known)/len(known) if strategy == 'mean' else (known[mid] if len(known) % 2 else (known[mid-1]+known[mid])/2)
    values = [fill_value if r['runtime_minutes'] is None else r['runtime_minutes'] for r in rows]
    runtime_mean = sum(values)/len(values)
    runtime_std = math.sqrt(sum((x-runtime_mean)**2 for x in values)/len(values))
    genres = sorted({r['genre'] for r in rows})
    return {'strategy': strategy, 'fill_value': fill_value, 'runtime_mean': runtime_mean, 'runtime_std': runtime_std, 'runtime_scale': runtime_std or 1, 'genres': genres, 'feature_names': ['runtime_z', 'runtime_missing', *['genre='+g for g in genres], 'genre=__unknown__']}


def transform_rows(rows, state):
    features = []
    for row in rows:
        runtime = state['fill_value'] if row['runtime_minutes'] is None else row['runtime_minutes']
        features.append([(runtime-state['runtime_mean'])/state['runtime_scale'], int(row['runtime_minutes'] is None), *[int(row['genre'] == g) for g in state['genres']], int(row['genre'] not in state['genres'])])
    return {'event_ids': [r['event_id'] for r in rows], 'viewer_ids': [r['viewer_id'] for r in rows], 'X': features, 'y': [r['liked'] for r in rows]}


def prepare_data(input_rows, plan, strategy='median', scope='train'):
    if scope not in ('train', 'all'):
        raise ValueError('Choose train or all scope.')
    cleaned = clean_rows(input_rows)
    splits = split_rows(cleaned['rows'], plan)
    fit_rows = splits['train'] if scope == 'train' else [r for role in ROLES for r in splits[role]]
    state = fit_preprocessor(fit_rows, strategy)
    return {'pipeline_version': 'movie-preparation-v1', 'split_plan': plan, 'fit_scope': scope, 'leakage_demo': scope == 'all', 'audit': cleaned['audit'], 'state': state, 'splits': splits, 'prepared': {role: transform_rows(splits[role], state) for role in ROLES}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT/'raw_watch_events.csv')
    parser.add_argument('--plan', type=Path, default=ROOT/'split_plan.json')
    parser.add_argument('--strategy', choices=['median', 'mean'], default='median')
    parser.add_argument('--leaky-demo', action='store_true', help='deliberately fit on all splits; teaching comparison only')
    args = parser.parse_args()
    try:
        plan = json.loads(args.plan.read_text(encoding='utf-8'))
        result = prepare_data(read_csv(args.input), plan, args.strategy, 'all' if args.leaky_demo else 'train')
    except (ValueError, OSError, UnicodeError, csv.Error) as error:
        print(json.dumps({'status': 'invalid_input', 'detail': str(error)}))
        return 2
    print(json.dumps(result, indent=2, allow_nan=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
