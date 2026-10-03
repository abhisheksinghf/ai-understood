# Chapter 7: probability and statistics workbook

Extract the ZIP and open a terminal in this folder. Run:

```powershell
py statistics_lab.py
```

Use Python 3.10 or newer; replace py with python or python3 if needed. No third-party
packages, network, API keys, or data files are required. The script prints results;
it does not train a model, simulate random draws, or write files.

Expected output:

```
Mean: 4.0 days; median: 3.0 days
Sample variance: 5.5 days^2
Sample SD: 2.345 days
Base rate 1%: 90 true alerts, 495 false alerts; P(spam | alert) = 15.38%
Base rate 10%: 900 true alerts, 450 false alerts; P(spam | alert) = 66.67%
Known-SD normal example, n=25: [-0.568, 2.568] days
Known-SD normal example, n=100: [0.216, 1.784] days
No alerts: conditional probability = None (undefined)
```

All data and rates are synthetic. Alert counts are expected counts under supplied
probabilities, not a measured confusion matrix. Recall is P(alert | spam),
false-positive rate is P(alert | no spam), and precision is P(spam | alert).
The assumed confidence-interval model uses independent, normally distributed
prediction errors with known population SD = 4 days and observed mean = 1 day.
The 1.96 multiplier gives an approximately 95% interval under that model. This is
not a universal interval recipe, a prediction interval, or a claim about the five
delivery-day values shown earlier. Increasing n does not repair sampling bias.

Try changing the inputs in main(), then run again:

1. Replace 8 with 18 in delivery_days: the mean becomes 6, the median stays 3.
2. Set the spam base rate to 0.001, holding recall and false-positive rate fixed:
   expect 9 true alerts and 499.5 false alerts out of 10000 hypothetical emails.
   Fractional expected counts are allowed; this is not an observed sample.
3. For the normal example, change n from 25 to 100: interval width halves.
4. Set base_rate=0 and false_positive_rate=0: no alerts exist, so the conditional
   probability is undefined; the function returns None instead of pretending it is 0.

Python's statistics.variance() and statistics.stdev() use the sample denominator
n - 1. Their population counterparts, pvariance() and pstdev(), use n.
