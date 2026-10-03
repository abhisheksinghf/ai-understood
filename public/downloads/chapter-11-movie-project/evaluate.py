"""Evaluate prepared task cases. This does not call or evaluate a live LLM."""
import json
from movie_app import ROOT, load_json, recommend


def evaluate(catalog, cases):
    results = []
    for case in cases:
        result = recommend(case['preferences'], catalog)
        card = result['recommendation']
        actual = card['movie_id'] if card else None
        results.append({'case': case['name'], 'expected_id': case['expected_id'], 'actual_id': actual, 'passed': actual == case['expected_id']})
    passed = sum(row['passed'] for row in results)
    return {'passed': passed, 'total': len(results), 'cases': results,
            'scope': 'Prepared policy acceptance cases only; no viewer study and no live model evaluation.'}


if __name__ == '__main__':
    catalog = load_json((ROOT/'catalog.json').read_text(encoding='utf-8'))
    cases = load_json((ROOT/'eval_cases.json').read_text(encoding='utf-8'))
    report = evaluate(catalog, cases)
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report['passed'] == report['total'] else 1)
