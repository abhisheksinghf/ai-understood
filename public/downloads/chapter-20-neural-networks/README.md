# Chapter 20: neural networks from first principles

Use Python 3.10 or newer; no packages, credentials, downloads, or network calls.
Extract all three files into one folder, then run:

```sh
py network.py --architecture hidden --steps 2000 --rate 0.5
py network.py --architecture linear --steps 2000 --rate 0.5
py network.py --architecture hidden --steps 1
py -m unittest -v test_network.py
```

Use `python` or `python3` in place of `py` where needed. Commands print JSON only.
Redirect it yourself if you want a file, for example `py network.py > report.json`.
An invalid argument returns exit code 2. Rate must be finite, > 0, and <= 2;
steps must be an integer from 0 to 2000. The step cap is not a convergence test.

## What is being learned?

Four original fictional movies encode a deliberately simple preference:
like adventure OR romance, but not both or neither. Features are binary flags;
zero means absent, not missing. All four movies are training rows. No test,
validation, calibration, or real recommendation-quality measurement is present.

The linear model is a sigmoid of two weighted inputs plus a bias (3 parameters).
The hidden model is 2 inputs -> 3 tanh units -> 1 sigmoid (13 parameters).
Both have fixed initial values and optimize mean binary cross-entropy. Every
step uses all four rows, so one step is also one epoch. There is no regularizer.
All gradients are calculated before any parameters change. Inference calls
`forward(theta, x)` and never reads labels or changes the parameter list.

## Read the code in this order

1. `initial`: explicit parameter values. Hidden parameter ordering is each
   unit's `[w1, w2, bias]`, then output `[v1, v2, v3, bias]`.
2. `forward`: hidden sums, tanh activations, output logit, sigmoid probability.
3. `log_loss`: stable binary cross-entropy from a logit.
4. `sample_gradient`: manual chain rule for one movie.
5. `batch`: average four losses and gradients, retaining per-movie predictions.
6. `update` and `train`: simultaneous gradient descent updates; history records
   every 20 steps, step zero, and the final step.

JSON contains full-precision results. Threshold decisions use p >= 0.5 without
rounding. Extremely small deviations around 0.5 can flip a label but say little
about useful confidence. Compare loss and probabilities, not just accuracy.

At rate 0.5 and 2000 steps the hidden model's training loss is about 0.002742;
its training accuracy is 100%. The linear model approaches loss ln(2), with
probabilities 0.5 on all rows. It cannot separate opposite corners using a
single straight boundary on the original features. Engineered interaction
features or a tree can also represent the pattern; a neural network is not
the only solution.

The tests check finite-difference gradients, a simultaneous update, immutable
inference, stable extreme-logit arithmetic, convergence, and invalid inputs.
The numerical gradient check is for verification, not used for training.

## Practice

- Match the initial Moonlight Trail trace to the chapter's numbers.
- Compare the first weight's single-row and full-batch gradients.
- Compare rates 0.1, 0.5, and 2 after the same step budget. These are teaching
  experiments on training data, not validation-based model selection.

No model is saved automatically. All data and parameters are inside network.py.
