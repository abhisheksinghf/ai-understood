"""Fit small movie-rating and thumbs-up models; standard library only."""
import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STRENGTHS = (0, .1, 1)
LOGISTIC_STEPS = 2000
LEARNING_RATE = .3


def mean(values):
    return sum(values)/len(values)


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def validate_dataset(data):
    if not isinstance(data, dict) or set(data) != {'version', 'rows'} or data['version'] != 'movie-supervised-v1' or not isinstance(data['rows'], list) or len(data['rows']) > 5000:
        raise ValueError('Expected the versioned movie dataset, at most 5000 rows.')
    splits = {'train': [], 'validation': [], 'test': []}
    ids, viewers = set(), {}
    import re
    for r in data['rows']:
        if not isinstance(r, dict) or set(r) != {'event_id', 'viewer_id', 'split', 'history_like_fraction', 'rating', 'liked'}:
            raise ValueError('Invalid fields.')
        if not isinstance(r['event_id'], str) or not re.fullmatch(r'S[0-9]{2}', r['event_id']) or not isinstance(r['viewer_id'], str) or not re.fullmatch(r'V[0-9]{2}', r['viewer_id']) or r['split'] not in splits or r['event_id'] in ids:
            raise ValueError('Invalid IDs, split, or duplicate event.')
        if not finite(r['history_like_fraction']) or not 0 <= r['history_like_fraction'] <= 1 or not finite(r['rating']) or not 1 <= r['rating'] <= 5 or not finite(r['liked']) or r['liked'] not in (0, 1):
            raise ValueError('History must be 0-1, rating 1-5, and liked 0 or 1.')
        if r['viewer_id'] in viewers and viewers[r['viewer_id']] != r['split']:
            raise ValueError('A viewer cannot cross split boundaries.')
        ids.add(r['event_id'])
        viewers[r['viewer_id']] = r['split']
        splits[r['split']].append(r)
    if len(splits['train']) < 2 or not splits['validation'] or not splits['test'] or len({r['liked'] for r in splits['train']}) != 2:
        raise ValueError('Need training examples of both classes and nonempty held-out splits.')
    return splits


def feature(history):
    return 2*history-1


def sigmoid(z):
    if z >= 0:
        return 1/(1+math.exp(-z))
    t = math.exp(z)
    return t/(1+t)


def logistic_loss(z, y):
    return max(z, 0)-y*z+math.log1p(math.exp(-abs(z)))


def fit_model(rows, task='regression', strength=0):
    if task not in ('regression', 'classification') or type(strength) not in (int, float) or strength not in STRENGTHS or len(rows) < 2:
        raise ValueError('Choose a supported task, strength, and at least two training rows.')
    xs = [feature(r['history_like_fraction']) for r in rows]
    if task == 'regression':
        ys = [r['rating'] for r in rows]
        mx, my = mean(xs), mean(ys)
        variance = mean([(x-mx)**2 for x in xs])
        if variance == 0 and strength == 0:
            raise ValueError('Constant feature: use a constant baseline or positive regularization.')
        w = mean([(x-mx)*(y-my) for x, y in zip(xs, ys)])/(variance+strength)
        return {'task': task, 'strength': strength, 'w': w, 'b': my-w*mx, 'solver': 'closed_form', 'steps': 0}
    if len({r['liked'] for r in rows}) != 2:
        raise ValueError('Logistic training needs both classes in this workbook.')
    w = b = 0
    for _ in range(LOGISTIC_STEPS):
        errors = [sigmoid(w*x+b)-r['liked'] for x, r in zip(xs, rows)]
        dw = mean([e*x for e, x in zip(errors, xs)])+strength*w
        db = mean(errors)
        w -= LEARNING_RATE*dw
        b -= LEARNING_RATE*db
    return {'task': task, 'strength': strength, 'w': w, 'b': b, 'solver': 'batch_gradient_descent', 'steps': LOGISTIC_STEPS}


def predict(model, history):
    z = model['w']*feature(history)+model['b']
    return z if model['task'] == 'regression' else sigmoid(z)


def decide(probability, threshold):
    return int(probability >= threshold)


def metrics(rows, model, threshold=.5):
    predictions = [predict(model, r['history_like_fraction']) for r in rows]
    if model['task'] == 'regression':
        errors = [p-r['rating'] for p, r in zip(predictions, rows)]
        mse = mean([e*e for e in errors])
        return {'mse': mse, 'rmse': math.sqrt(mse), 'mae': mean([abs(e) for e in errors])}
    tp = fp = tn = fn = 0
    for p, r in zip(predictions, rows):
        label, y = decide(p, threshold), r['liked']
        if label and y:
            tp += 1
        elif label:
            fp += 1
        elif y:
            fn += 1
        else:
            tn += 1
    return {'log_loss': mean([logistic_loss(model['w']*feature(r['history_like_fraction'])+model['b'], r['liked']) for r in rows]), 'accuracy': (tp+tn)/len(rows), 'tp': tp, 'fp': fp, 'tn': tn, 'fn': fn}


def experiment(data, task='regression', strength=0, history=.75, threshold=.5, evaluate_test=False):
    if not finite(history) or not 0 <= history <= 1 or not finite(threshold) or not 0 <= threshold <= 1 or type(evaluate_test) is not bool:
        raise ValueError('History and threshold must be finite numbers in 0-1.')
    splits = validate_dataset(data)
    model = fit_model(splits['train'], task, strength)
    p = mean([r['liked'] for r in splits['train']])
    baseline = {'task': task, 'strength': 0, 'w': 0, 'b': mean([r['rating'] for r in splits['train']]) if task == 'regression' else math.log(p/(1-p)), 'solver': 'constant_training_target', 'steps': 0}
    roles = ('train', 'validation', 'test') if evaluate_test else ('train', 'validation')
    reports = {role: {'model': metrics(splits[role], model, threshold), 'baseline': metrics(splits[role], baseline, threshold)} for role in roles}
    prediction = predict(model, history)
    return {'dataset_version': data['version'], 'feature_transform': 'x = 2 * history_like_fraction - 1', 'model': model, 'baseline': baseline, 'threshold': threshold if task == 'classification' else None, 'query': {'history_like_fraction': history, 'prediction': prediction, 'predicted_class': decide(prediction, threshold) if task == 'classification' else None}, 'split_counts': {k: len(v) for k, v in splits.items()}, 'reports': reports}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT/'movie_learning.json')
    parser.add_argument('--task', choices=['regression', 'classification'], default='regression')
    parser.add_argument('--strength', type=float, choices=STRENGTHS, default=0)
    parser.add_argument('--history', type=float, default=.75)
    parser.add_argument('--threshold', type=float, default=.5)
    parser.add_argument('--evaluate-test', action='store_true', help='inspect test only after fixing your choices')
    args = parser.parse_args()
    try:
        data = json.loads(args.input.read_text(encoding='utf-8'))
        result = experiment(data, args.task, args.strength, args.history, args.threshold, args.evaluate_test)
    except (ValueError, TypeError, OSError, UnicodeError) as error:
        print(json.dumps({'status': 'invalid_input', 'detail': str(error)}))
        return 2
    print(json.dumps(result, indent=2, allow_nan=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
