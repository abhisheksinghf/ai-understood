"""Transparent lexical movie search. Python standard library only."""
import argparse
import json
import math
import re
from pathlib import Path


def tokenize(text):
    if not isinstance(text, str):
        raise ValueError('Text must be a string.')
    return re.findall(r'[a-z0-9]+', text.lower())


def query_key(text):
    return ' '.join(sorted(set(tokenize(text))))


def validate_dataset(data):
    if not isinstance(data, dict) or data.get('version') != 'movie-search-v1' or not isinstance(data.get('movies'), list) or not data['movies'] or not isinstance(data.get('queries'), list):
        raise ValueError('Invalid catalog.')
    ids, queries = set(), set()
    for d in data['movies']:
        if not isinstance(d, dict) or not isinstance(d.get('id'), str) or not re.fullmatch(r'M\d{3}', d['id']) or d['id'] in ids or not isinstance(d.get('title'), str) or not d['title'].strip() or not isinstance(d.get('summary'), str) or not tokenize(d['summary']) or 'runtime_minutes' not in d or not (d['runtime_minutes'] is None or (type(d['runtime_minutes']) is int and d['runtime_minutes'] > 0)):
            raise ValueError('Invalid movie.')
        ids.add(d['id'])
    for q in data['queries']:
        if not isinstance(q, dict) or not isinstance(q.get('query'), str) or not query_key(q['query']) or query_key(q['query']) in queries or not isinstance(q.get('intent'), str) or not q['intent'].strip() or not isinstance(q.get('relevant'), list) or any(not isinstance(i, str) or i not in ids for i in q['relevant']) or len(set(q['relevant'])) != len(q['relevant']):
            raise ValueError('Invalid query judgments.')
        queries.add(query_key(q['query']))


def build_index(data):
    validate_dataset(data)
    postings, documents = {}, []
    for movie in data['movies']:
        tokens = tokenize(movie['summary'])
        for position, term in enumerate(tokens):
            postings.setdefault(term, {}).setdefault(movie['id'], []).append(position)
        documents.append({**movie, 'length': len(tokens)})
    return {'documents': documents, 'postings': postings, 'n': len(documents), 'average_length': sum(d['length'] for d in documents) / len(documents)}


def term_weight(method, tf, df, n, length, average, k1=1.2, b=.75):
    if not tf or not df:
        return 0
    if method == 'overlap':
        return 1
    if method == 'tfidf':
        return (1 + math.log(tf)) * math.log(n / df)
    if method == 'bm25':
        return math.log(1 + (n - df + .5) / (df + .5)) * tf * (k1 + 1) / (tf + k1 * (1 - b + b * length / average))
    raise ValueError('Unknown ranking method.')


def ranking_metrics(ids, relevant, k):
    hits = [rank for rank, doc_id in enumerate(ids[:k], 1) if doc_id in relevant]
    return {'relevant_total': len(relevant), 'relevant_retrieved': len(hits), 'precision_at_k': len(hits) / k, 'recall_at_k': len(hits) / len(relevant) if relevant else None, 'reciprocal_rank_at_k': 1 / hits[0] if hits else 0}


def search(data, query='space rescue', method='bm25', mode='any', limit='all', k=3, k1=1.2, b=.75):
    if not isinstance(query, str) or len(query) > 200:
        raise ValueError('Query must be text with at most 200 characters.')
    if method not in ('overlap', 'tfidf', 'bm25') or mode not in ('any', 'all') or limit not in ('all', 'under120') or type(k) is not int or not 1 <= k <= 10 or type(k1) not in (int, float) or not math.isfinite(k1) or not 0 <= k1 <= 3 or type(b) not in (int, float) or not math.isfinite(b) or not 0 <= b <= 1:
        raise ValueError('Invalid search settings.')
    index = build_index(data)
    tokens = list(dict.fromkeys(tokenize(query)))
    terms = [{'term': t, 'df': len(index['postings'].get(t, {})), 'postings': [{'id': doc_id, 'tf': len(positions), 'positions': positions} for doc_id, positions in index['postings'].get(t, {}).items()]} for t in tokens]
    eligible = [d for d in index['documents'] if limit == 'all' or (d['runtime_minutes'] is not None and d['runtime_minutes'] < 120)]
    matches = [set(p['id'] for p in t['postings']) for t in terms]
    candidates = (set.union(*matches) if mode == 'any' else set.intersection(*matches)) if matches else set()
    ranked = []
    for d in eligible:
        if d['id'] not in candidates:
            continue
        contributions = []
        for t in terms:
            tf = len(index['postings'].get(t['term'], {}).get(d['id'], []))
            contributions.append({'term': t['term'], 'tf': tf, 'df': t['df'], 'weight': term_weight(method, tf, t['df'], index['n'], d['length'], index['average_length'], k1, b)})
        ranked.append({**d, 'score': sum(t['weight'] for t in contributions), 'contributions': contributions})
    ranked.sort(key=lambda d: (-d['score'], d['id']))
    results = ranked[:k]
    judgment = next((q for q in data['queries'] if query_key(q['query']) == query_key(query)), None)
    evaluation = None
    if judgment:
        relevant = [i for i in judgment['relevant'] if any(d['id'] == i for d in eligible)]
        evaluation = {'intent': judgment['intent'], 'judgments': 'Authored binary judgments for all eight movies; eligibility changes with the runtime filter.', **ranking_metrics([d['id'] for d in results], relevant, k)}
    return {'version': data['version'], 'configuration': {'query': query, 'method': method, 'mode': mode, 'limit': limit, 'k': k, 'k1': k1, 'b': b}, 'tokens': tokens, 'statistics': {'documents': index['n'], 'average_length': index['average_length'], 'eligible': len(eligible), 'candidates': len(ranked)}, 'terms': terms, 'results': results, 'evaluation': evaluation}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--query', default='space rescue')
    parser.add_argument('--method', choices=['overlap', 'tfidf', 'bm25'], default='bm25')
    parser.add_argument('--mode', choices=['any', 'all'], default='any')
    parser.add_argument('--limit', choices=['all', 'under120'], default='all')
    parser.add_argument('--k', type=int, default=3)
    parser.add_argument('--k1', type=float, default=1.2)
    parser.add_argument('--b', type=float, default=.75)
    parser.add_argument('--input', type=Path, default=Path(__file__).with_name('movies.json'))
    args = parser.parse_args()
    try:
        data = json.loads(args.input.read_text(encoding='utf-8'))
        result = search(data, args.query, args.method, args.mode, args.limit, args.k, args.k1, args.b)
    except (OSError, ValueError) as error:
        print(json.dumps({'status': 'invalid_input', 'message': str(error)}))
        return 2
    print(json.dumps(result, indent=2, allow_nan=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
