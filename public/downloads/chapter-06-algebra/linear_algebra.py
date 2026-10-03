"""Small, readable linear-algebra operations; standard library only."""
import math


def check_vector(values):
    if not isinstance(values, (list, tuple)) or not values:
        raise ValueError("Expected a nonempty vector.")
    if any(type(value) not in (int, float) or not math.isfinite(value) for value in values):
        raise ValueError("Vector entries must be finite numbers.")


def dot(a, b):
    check_vector(a)
    check_vector(b)
    if len(a) != len(b):
        raise ValueError("Dot product needs equal vector lengths.")
    return sum(left * right for left, right in zip(a, b))


def norm(values):
    check_vector(values)
    return math.hypot(*values)


def cosine(a, b):
    product = dot(a, b)
    denominator = norm(a) * norm(b)
    if denominator == 0:
        raise ValueError("Cosine is undefined for a zero vector.")
    # Bound tiny floating-point overshoots of the theoretical interval.
    return max(-1.0, min(1.0, product / denominator))


def matvec(matrix, values):
    check_vector(values)
    if not isinstance(matrix, (list, tuple)) or not matrix:
        raise ValueError("Expected a nonempty matrix.")
    return [dot(row, values) for row in matrix]


def predict_batch(matrix, weights, bias):
    if type(bias) not in (int, float) or not math.isfinite(bias):
        raise ValueError("Bias must be a finite number.")
    return [value + bias for value in matvec(matrix, weights)]


def main():
    # Coordinate order: horizontal, then vertical; dimensionless values.
    features = [[1, 0], [2, 1], [3, 2]]
    weights = [2, 0.5]
    bias = 1
    print(f"One prediction: {dot(features[2], weights) + bias:.1f}")
    print(f"Batch predictions: {predict_batch(features, weights, bias)}")
    # Geometry below uses dimensionless coordinates, not mixed-unit features.
    print(f"Length of [3, 4]: {norm([3, 4]):.1f}")
    print(f"Cosine of [3, 4] and [6, 8]: {cosine([3, 4], [6, 8]):.1f}")
    print(f"Rotated [2, 1]: {matvec([[0, -1], [1, 0]], [2, 1])}")
    print(f"Projected [2, 1]: {matvec([[1, 0], [0, 0]], [2, 1])}")


if __name__ == "__main__":
    main()
