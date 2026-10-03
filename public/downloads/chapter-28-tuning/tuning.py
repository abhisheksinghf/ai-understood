"""Tiny LoRA arithmetic and two-response DPO. No LLM or external dependencies."""
import argparse
import json
import math
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))


def lora(rank=1, alpha=2, stage='adapted'):
    if type(rank) is not int or rank not in [1, 2] or type(alpha) is not int or alpha not in [1, 2, 4] or stage not in ['initial', 'adapted']:
        raise ValueError('Invalid LoRA configuration.')
    a = [list(row) for row in DATA['A'][:rank]]
    b = [[0 if stage == 'initial' else v for v in row[:rank]] for row in DATA['B']]
    scale = alpha / rank
    delta = [[scale * sum(row[k] * a[k][j] for k in range(rank)) for j in range(4)] for row in b]
    base_output = [sum(w*x for w,x in zip(row, DATA['input'])) for row in DATA['base']]
    update = [sum(w*x for w,x in zip(row, DATA['input'])) for row in delta]
    output = [v+u for v,u in zip(base_output, update)]
    return dict(rank=rank, alpha=alpha, stage=stage, scale=scale, A=a, B=b, delta=delta,
                input=list(DATA['input']), baseOutput=base_output, update=update, output=output,
                baseParameters=16, trainableParameters=8*rank)


def sigmoid(x):
    return 1 / (1 + math.exp(-x))


def preference_state(theta, reference_theta, beta, sign):
    p_a = sigmoid(theta)
    p_ref = sigmoid(reference_theta)
    margin = sign * (theta-reference_theta)
    z = beta * margin
    loss = max(0, -z) + math.log1p(math.exp(-abs(z)))
    gradient = -beta * sign * sigmoid(-z)
    kl = p_a*math.log(p_a/p_ref) + (1-p_a)*math.log((1-p_a)/(1-p_ref))
    return dict(theta=theta, pA=p_a, pB=1-p_a, margin=margin, z=z, loss=loss,
                gradient=gradient, pairFit=sigmoid(z), kl=max(0, kl))


def preference(reference=0.5, beta=0.5, rate=0.5, steps=10, chosen='A'):
    if (any(type(v) not in (int, float) for v in [reference,beta,rate])
            or reference not in [0.2,0.5,0.8] or beta not in [0.1,0.5,1]
            or rate not in [0.1,0.5,1] or type(steps) is not int or not 0 <= steps <= 40
            or chosen not in ['A','B']):
        raise ValueError('Invalid preference configuration.')
    reference_theta = math.log(reference / (1-reference))
    sign = 1 if chosen == 'A' else -1
    theta = reference_theta
    history = []
    for step in range(steps+1):
        state = preference_state(theta, reference_theta, beta, sign)
        history.append(dict(step=step, **state))
        if step < steps:
            theta -= rate * state['gradient']
    return dict(config=dict(reference=reference,beta=beta,rate=rate,steps=steps,chosen=chosen),
                referenceTheta=reference_theta, initial=history[0], final=history[-1], history=history)


def bounded_steps(value):
    try:
        n = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError('Steps must be an integer.') from exc
    if not 0 <= n <= 40:
        raise argparse.ArgumentTypeError('Steps must be from 0 to 40.')
    return n


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rank', type=int, choices=[1,2], default=1)
    parser.add_argument('--alpha', type=int, choices=[1,2,4], default=2)
    parser.add_argument('--stage', choices=['initial','adapted'], default='adapted')
    parser.add_argument('--reference', type=float, choices=[0.2,0.5,0.8], default=0.5)
    parser.add_argument('--beta', type=float, choices=[0.1,0.5,1], default=0.5)
    parser.add_argument('--rate', type=float, choices=[0.1,0.5,1], default=0.5)
    parser.add_argument('--steps', type=bounded_steps, default=10)
    parser.add_argument('--chosen', choices=['A','B'], default='A')
    args = parser.parse_args()
    print(json.dumps(dict(lora=lora(args.rank,args.alpha,args.stage),
                         preference=preference(args.reference,args.beta,args.rate,args.steps,args.chosen)), indent=2))


if __name__ == '__main__':
    main()
