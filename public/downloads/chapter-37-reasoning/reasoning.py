"""Small, deterministic reasoning models. Python 3.10+, standard library only."""
import argparse
import json
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
DEFAULTS = dict(minutes=100, offline='yes', evidence='liked', prior=50, penalty=4)
CHOICES = dict(minutes=[80, 100, 120], offline=['yes', 'no'], evidence=['unknown', 'liked', 'disliked'], prior=[20, 50, 80], penalty=[1, 4, 10])

def normalize(config=None):
    if config is None:
        config = {}
    if type(config) is not dict or set(config) - set(DEFAULTS):
        raise ValueError('Expected known configuration keys')
    result = dict(DEFAULTS, **config)
    for key, value in result.items():
        if type(value) is not type(DEFAULTS[key]) or value not in CHOICES[key]:
            raise ValueError('Invalid ' + key)
    return result

def search(strategy):
    """Finite fixture graph: keep best path costs and skip stale queue entries."""
    if strategy not in ('bfs', 'ucs', 'astar'):
        raise ValueError('Unknown search strategy')
    frontier = [dict(node='Start', cost=0, path=['Start'], order=0)]
    best, expanded, order = {'Start': 0}, [], 0
    while frontier:
        def priority(entry):
            value = len(entry['path']) - 1 if strategy == 'bfs' else entry['cost'] + (DATA['heuristic'][entry['node']] if strategy == 'astar' else 0)
            return value, entry['order']
        frontier.sort(key=priority)
        current = frontier.pop(0)
        if strategy != 'bfs' and current['cost'] != best[current['node']]:
            continue
        expanded.append(current['node'])
        if current['node'] == 'Ready':
            return dict(strategy=strategy, path=current['path'], cost=current['cost'], expanded=expanded)
        for node, cost in DATA['graph'][current['node']]:
            total = current['cost'] + cost
            if node in best and (strategy == 'bfs' or total >= best[node]):
                continue
            best[node] = total
            order += 1
            frontier.append(dict(node=node, cost=total, path=current['path'] + [node], order=order))
    return dict(strategy=strategy, path=[], cost=None, expanded=expanded)

def evaluate(config=None):
    config = normalize(config)
    prior = config['prior'] / 100
    yes = no = 1.0
    if config['evidence'] == 'liked':
        yes, no = DATA['trailer']['liked_if_scifi'], DATA['trailer']['liked_if_other']
    elif config['evidence'] == 'disliked':
        yes, no = 1 - DATA['trailer']['liked_if_scifi'], 1 - DATA['trailer']['liked_if_other']
    evidence_probability = prior * yes + (1 - prior) * no
    posterior = prior * yes / evidence_probability
    rows = []
    for movie in DATA['movies']:
        reasons = []
        if movie['minutes'] > config['minutes']:
            reasons.append('Too long')
        if config['offline'] == 'yes' and not movie['downloaded']:
            reasons.append('Not downloaded')
        enjoyment = posterior * movie['enjoy_if_scifi'] + (1 - posterior) * movie['enjoy_if_other']
        rows.append(dict(movie, eligible=not reasons, reasons=reasons, enjoyment=round(enjoyment, 6), utility=round(5 * enjoyment - config['penalty'] * (1 - enjoyment), 6)))
    chosen, best_utility = None, 0
    for row in rows:
        if row['eligible'] and row['utility'] > best_utility:
            chosen, best_utility = row['id'], row['utility']
    eligible = sum(row['eligible'] for row in rows)
    decision = 'recommend' if chosen else 'abstain' if eligible else 'no_feasible_movie'
    return dict(config=config, posterior=round(posterior, 6), evidenceProbability=round(evidence_probability, 6), eligible=eligible, chosen=chosen, decision=decision, bestUtility=best_utility, rows=rows, searches=[search(s) for s in ('bfs', 'ucs', 'astar')])

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for key, values in CHOICES.items():
        parser.add_argument('--' + key, choices=values, type=type(DEFAULTS[key]), default=DEFAULTS[key])
    print(json.dumps(evaluate(vars(parser.parse_args())), indent=2))
