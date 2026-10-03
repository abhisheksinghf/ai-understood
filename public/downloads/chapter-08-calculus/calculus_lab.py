"""Chapter 8: real arithmetic on original teaching examples; Python standard library only."""
import math


def loss(w):
    return 0.5 * (w - 3) ** 2


def gradient(w):
    return w - 3


def descent(start=0.0, rate=0.5, steps=5):
    if any(type(v) not in (int, float) or not math.isfinite(v) for v in (start, rate)):
        raise ValueError("Start and rate must be finite numbers.")
    if not -2 <= start <= 6 or rate not in (0.1, 0.5, 1, 1.5, 2, 2.2):
        raise ValueError("Use the starts and rates shown in the chapter.")
    if type(steps) is not int or not 0 <= steps <= 12:
        raise ValueError("Use 0 through 12 steps.")
    w = float(start)
    trace = [(0, w, loss(w))]
    for step in range(1, steps + 1):
        w -= rate * gradient(w)
        trace.append((step, w, loss(w)))
    return trace


def check_distribution(values):
    if not values or any(type(p) not in (int, float) or not math.isfinite(p) or not 0 <= p <= 1 for p in values):
        raise ValueError("Use finite probabilities between zero and one.")
    if not math.isclose(sum(values), 1, rel_tol=0, abs_tol=1e-10):
        raise ValueError("Probabilities must sum to one.")


def entropy(p):
    check_distribution(p)
    return -sum(probability * math.log2(probability) for probability in p if probability > 0)


def cross_entropy(p, q):
    check_distribution(p)
    check_distribution(q)
    if len(p) != len(q):
        raise ValueError("Use the same ordered categories.")
    if any(pi > 0 and qi == 0 for pi, qi in zip(p, q)):
        return math.inf
    return -sum(pi * math.log2(qi) for pi, qi in zip(p, q) if pi > 0)


def main():
    for step, w, value in descent():
        print(f"Step {step}: w={w:.5f}, loss={value:.6f}")
    h = 1e-5
    numerical = (loss(1.5 + h) - loss(1.5 - h)) / (2 * h)
    print(f"Derivative at w=1.5: exact={gradient(1.5):.3f}, finite difference={numerical:.3f}")
    p, q = [0.75, 0.25], [0.5, 0.5]
    hp, ce = entropy(p), cross_entropy(p, q)
    print(f"Entropy={hp:.6f} bits; cross-entropy={ce:.6f} bits; KL={ce-hp:.6f} bits")
    print(f"Zero predicted probability on a possible outcome: {cross_entropy(p, [1, 0])}")


if __name__ == '__main__':
    main()
