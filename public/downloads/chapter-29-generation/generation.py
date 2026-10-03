"""Two-coordinate generative modeling workbook. Python 3.10+, standard library only.

No neural network, image generator, account, or external service is used.
"""
import argparse
import json
import math
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
STYLES = list(DATA['styles'])


def normal_draws(seed):
    if seed not in DATA['seeds']:
        raise ValueError('Invalid seed.')
    state = seed

    def uniform():
        nonlocal state
        state = (1664525 * state + 1013904223) & 0xffffffff
        return (state + 0.5) / 4294967296

    result = []
    for _ in range(2):
        radius = math.sqrt(-2 * math.log(uniform()))
        angle = 2 * math.pi * uniform()
        result.extend([radius * math.cos(angle), radius * math.sin(angle)])
    return result


def denoise(point, a, style='unconditional'):
    """Posterior-mean noise for a known Gaussian or equal Gaussian mixture."""
    if (not isinstance(point, (list, tuple)) or len(point) != 2
            or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in point)
            or not isinstance(a, (int, float)) or not 0 < a < 1
            or style not in STYLES + ['unconditional']):
        raise ValueError('Invalid denoiser input.')
    root, noise = math.sqrt(a), math.sqrt(1-a)
    variance = a * DATA['variance'] + 1-a
    means = [DATA['styles'][key]['mean'] for key in STYLES]
    logs = [-sum((v-root*m)**2 for v, m in zip(point, mean)) / (2*variance) for mean in means]
    weights = [math.exp(v-max(logs)) for v in logs]
    responsibilities = [w/sum(weights) for w in weights]
    posteriors = [[m+root*DATA['variance']/variance*(v-root*m) for v, m in zip(point, mean)] for mean in means]
    clean = ([sum(w*posterior[j] for w, posterior in zip(responsibilities, posteriors)) for j in range(2)]
             if style == 'unconditional' else posteriors[STYLES.index(style)])
    epsilon = [(v-root*x)/noise for v, x in zip(point, clean)]
    return dict(clean=clean, epsilon=epsilon, responsibilities=responsibilities,
                conditionalVariance=DATA['variance']*(1-a)/variance)


def validate(style, seed):
    if style not in STYLES or seed not in DATA['seeds']:
        raise ValueError('Invalid style or seed.')


def corruption(style='calm', seed=42, level=4, estimator='conditional'):
    validate(style, seed)
    if not isinstance(level, int) or not 1 <= level <= 7 or estimator not in ['conditional', 'unconditional', 'oracle']:
        raise ValueError('Invalid corruption configuration.')
    draws = normal_draws(seed)
    clean = [m+math.sqrt(DATA['variance'])*v for m, v in zip(DATA['styles'][style]['mean'], draws)]
    epsilon = draws[2:]
    a = DATA['retained'][level-1]
    root, noise = math.sqrt(a), math.sqrt(1-a)
    noisy = [root*x+noise*e for x, e in zip(clean, epsilon)]
    estimate = denoise(noisy, a, 'unconditional' if estimator == 'unconditional' else style)
    predicted = epsilon[:] if estimator == 'oracle' else estimate['epsilon']
    reconstructed = [(v-noise*e)/root for v, e in zip(noisy, predicted)]
    mse = sum((v-x)**2 for v, x in zip(reconstructed, clean))/2
    return dict(config=dict(style=style, seed=seed, level=level, estimator=estimator), a=a,
                signalScale=root, noiseScale=noise, errorAmplification=noise/root,
                clean=clean, epsilon=epsilon, noisy=noisy, predictedNoise=predicted,
                reconstructed=reconstructed, mse=mse, conditionalVariance=estimate['conditionalVariance'])


def generate(style='calm', seed=42, guidance=1, steps=8):
    validate(style, seed)
    if guidance not in [0, 1, 3, 7] or steps not in [4, 8, 16] or not isinstance(steps, int):
        raise ValueError('Invalid sampler configuration.')
    angle = math.acos(math.sqrt(DATA['terminal_signal']))

    def alpha(t):
        return math.cos(t/steps*angle)**2

    point = normal_draws(seed)[:2]
    start = point[:]
    history = [dict(step=0, a=alpha(steps), point=point[:])]
    for t in range(steps, 0, -1):
        a, next_a = alpha(t), alpha(t-1)
        unconditioned, conditioned = denoise(point, a), denoise(point, a, style)
        epsilon = [u+guidance*(c-u) for u, c in zip(unconditioned['epsilon'], conditioned['epsilon'])]
        clean = [(v-math.sqrt(1-a)*e)/math.sqrt(a) for v, e in zip(point, epsilon)]
        point = [math.sqrt(next_a)*v+math.sqrt(1-next_a)*e for v, e in zip(clean, epsilon)]
        history.append(dict(step=steps-t+1, a=next_a, point=point[:]))
    distance = math.sqrt(sum((v-m)**2 for v, m in zip(point, DATA['styles'][style]['mean'])))
    return dict(config=dict(style=style, seed=seed, guidance=guidance, steps=steps),
                start=start, final=point[:], distance=distance, history=history)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--style', choices=STYLES, default='calm')
    parser.add_argument('--seed', type=int, choices=DATA['seeds'], default=42)
    parser.add_argument('--level', type=int, choices=range(1, 8), default=4)
    parser.add_argument('--estimator', choices=['conditional', 'unconditional', 'oracle'], default='conditional')
    parser.add_argument('--guidance', type=int, choices=[0, 1, 3, 7], default=1)
    parser.add_argument('--steps', type=int, choices=[4, 8, 16], default=8)
    args = parser.parse_args()
    print(json.dumps(dict(corruption=corruption(args.style, args.seed, args.level, args.estimator),
                         generation=generate(args.style, args.seed, args.guidance, args.steps)), indent=2))


if __name__ == '__main__':
    main()
