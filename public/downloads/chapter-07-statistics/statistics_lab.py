"""Chapter 7's synthetic arithmetic. No external packages or API calls."""
import math
import statistics


def alert_counts(base_rate=0.01, recall=0.90, false_positive_rate=0.05, total=10000):
    for probability in (base_rate, recall, false_positive_rate):
        if type(probability) not in (int, float) or not 0 <= probability <= 1:
            raise ValueError("Probabilities must be finite numbers from 0 to 1.")
    if type(total) is not int or total <= 0:
        raise ValueError("Total must be a positive integer.")
    spam_count = total * base_rate
    legitimate = total - spam_count
    true_positive = spam_count * recall
    false_negative = spam_count - true_positive
    false_positive = legitimate * false_positive_rate
    true_negative = legitimate - false_positive
    alerts = true_positive + false_positive
    return {
        "true_positive": true_positive, "false_negative": false_negative,
        "false_positive": false_positive, "true_negative": true_negative,
        "alerts": alerts,
        "precision": None if alerts == 0 else true_positive / alerts,
    }


def known_sigma_interval(mean, sigma, n):
    if type(mean) not in (int, float) or not math.isfinite(mean):
        raise ValueError("Mean must be finite.")
    if type(sigma) not in (int, float) or not math.isfinite(sigma) or sigma <= 0:
        raise ValueError("The known population standard deviation must be positive.")
    if type(n) is not int or n < 1:
        raise ValueError("Sample size must be a positive integer.")
    standard_error = sigma / math.sqrt(n)
    margin = 1.96 * standard_error
    return mean - margin, mean + margin


def main():
    delivery_days = [2, 3, 3, 4, 8]
    print(f"Mean: {statistics.mean(delivery_days):.1f} days; median: {statistics.median(delivery_days):.1f} days")
    print(f"Sample variance: {statistics.variance(delivery_days):.1f} days^2")
    print(f"Sample SD: {statistics.stdev(delivery_days):.3f} days")
    for base_rate in (0.01, 0.10):
        counts = alert_counts(base_rate=base_rate)
        print(f"Base rate {base_rate:.0%}: {counts['true_positive']:.0f} true alerts, "
              f"{counts['false_positive']:.0f} false alerts; "
              f"P(spam | alert) = {counts['precision']:.2%}")
    for n in (25, 100):
        low, high = known_sigma_interval(mean=1, sigma=4, n=n)
        print(f"Known-SD normal example, n={n}: [{low:.3f}, {high:.3f}] days")
    none = alert_counts(base_rate=0, false_positive_rate=0)
    print(f"No alerts: conditional probability = {none['precision']} (undefined)")


if __name__ == "__main__":
    main()
