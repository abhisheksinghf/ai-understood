"""Tabular Q-learning on fictional movie sessions. Python 3.10+, no packages."""
import argparse
import json
import math
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
DEFAULTS = dict(objective='satisfaction', epsilon=.3, gamma=.9, alpha=.5, episodes=200, seed=7)
CHOICES = dict(objective=['satisfaction', 'clicks'], epsilon=[0, .1, .3], gamma=[0, .5, .9], alpha=[.1, .5], episodes=[60, 200], seed=[7, 19])

def rounded(x):
    return math.floor(x * 1e6 + .5) / 1e6

def normalize(config=None):
    if config is None:
        config = {}
    if type(config) is not dict or set(config) - set(DEFAULTS):
        raise ValueError('Expected known configuration keys')
    result = dict(DEFAULTS, **config)
    for key, value in result.items():
        valid_type = type(value) is str if key == 'objective' else type(value) in (int, float)
        if not valid_type or value not in CHOICES[key]:
            raise ValueError('Invalid ' + key)
    result['episodes'], result['seed'] = int(result['episodes']), int(result['seed'])
    return result

def make_random(seed):
    state = seed & 0xffffffff
    def random():
        nonlocal state
        state = (1664525 * state + 1013904223) & 0xffffffff
        return state / 4294967296
    return random

def td_update(old, reward, next_max, alpha, gamma, terminal):
    target = reward + (0 if terminal else gamma * next_max)
    return dict(target=target, error=target-old, updated=old + alpha * (target-old))

def greedy(state, q):
    # max returns the first action on equal values, matching catalog-order ties.
    return max(DATA['states'][state], key=lambda a: q[state][a['id']])

def evaluate(config=None):
    config = normalize(config)
    rng = make_random(config['seed'])
    q = {s: {a['id']: 0 for a in actions} for s, actions in DATA['states'].items()}
    visits = {s: {a['id']: 0 for a in actions} for s, actions in DATA['states'].items()}
    history, updates, exploratory_steps, steps = [], [], 0, 0
    for episode in range(1, config['episodes'] + 1):
        state, total, discounted, satisfaction, t = 'start', 0, 0, 0, 0
        while state != 'terminal':
            explore = rng() < config['epsilon']
            actions = DATA['states'][state]
            action = actions[math.floor(rng() * len(actions))] if explore else greedy(state, q)
            reward, terminal = action[config['objective']], action['next'] == 'terminal'
            next_max = 0 if terminal else max(q[action['next']].values())
            old = q[state][action['id']]
            update = td_update(old, reward, next_max, config['alpha'], config['gamma'], terminal)
            q[state][action['id']] = update['updated']
            visits[state][action['id']] += 1
            steps += 1
            exploratory_steps += int(explore)
            if len(updates) < 12:
                updates.append(dict(episode=episode, state=state, action=action['id'], reward=reward, next=action['next'], terminal=terminal, explore=explore, old=rounded(old), nextMax=rounded(next_max), target=rounded(update['target']), error=rounded(update['error']), updated=rounded(update['updated'])))
            total += reward
            discounted += config['gamma'] ** t * reward
            satisfaction += action['satisfaction']
            t += 1
            state = action['next']
        history.append(dict(episode=episode, total=total, discounted=rounded(discounted), satisfaction=satisfaction, steps=t, qQuick=rounded(q['start']['quick']), qAsk=rounded(q['start']['ask'])))
    # Frozen, greedy evaluation has no learning or exploration.
    trace = []
    state, total, discounted, satisfaction, t = 'start', 0, 0, 0, 0
    while state != 'terminal':
        action = greedy(state, q)
        reward = action[config['objective']]
        trace.append(dict(state=state, action=action['id'], label=action['label'], reward=reward, next=action['next']))
        total += reward
        discounted += config['gamma'] ** t * reward
        satisfaction += action['satisfaction']
        t += 1
        state = action['next']
    # An analytic oracle for evaluation, never used by the learner.
    known_best = max(a[config['objective']] for a in DATA['states']['known'])
    optimal_q = dict(start=dict(quick=DATA['states']['start'][0][config['objective']], ask=-1 + config['gamma'] * known_best), known={a['id']: a[config['objective']] for a in DATA['states']['known']})
    first = 'ask' if optimal_q['start']['ask'] > optimal_q['start']['quick'] else 'quick'
    optimal_return = optimal_q['start'][first]
    rows = [dict(state=s, action=a['id'], label=a['label'], q=rounded(q[s][a['id']]), visits=visits[s][a['id']], optimalQ=rounded(optimal_q[s][a['id']])) for s, actions in DATA['states'].items() for a in actions]
    curve = []
    for i in range(0, len(history), 20):
        block = history[i:i+20]
        curve.append(dict(episode=block[-1]['episode'], mean=rounded(sum(e['total'] for e in block)/len(block))))
    return dict(config=config, rows=rows, history=history, updates=updates, curve=curve, steps=steps, exploratorySteps=exploratory_steps, trainingMean=rounded(sum(e['total'] for e in history)/len(history)), greedy=dict(trace=trace, total=total, discounted=rounded(discounted), satisfaction=satisfaction), optimal=dict(first=first, discounted=rounded(optimal_return)), gap=rounded(max(0, optimal_return-discounted)))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for key, values in CHOICES.items():
        parser.add_argument('--' + key, choices=values, type=type(DEFAULTS[key]), default=DEFAULTS[key])
    print(json.dumps(evaluate(vars(parser.parse_args())), indent=2))
