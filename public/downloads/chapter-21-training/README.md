# Chapter 21: training and debugging neural networks

Python 3.10+; standard library only. Extract these four files together:
`data.json`, `train.py`, `test_train.py`, and `README.md`.

```sh
py train.py --preset fast
py train.py --preset fast --early-stop
py train.py --preset raw --batch-size 4
py train.py --preset baseline --epochs 100
py -m unittest -v test_train.py
```

Use `python` or `python3` if needed. Commands print JSON and make no network
calls. Use shell redirection yourself if you want a saved report. The default
CLI preset is baseline; the website initially displays fast for diagnosis.
There is no automatic model saving or resume-training command.

## Experiment contract

16 original fictional training movies and 12 validation movies. Inputs are
adventure scores (0-100) and romance scores (0-1). Labels follow the preference
for exactly one high genre (above the midpoint), except training rows T06 and
T11. Those two labels are deliberately inconsistent. They are not repaired.
Zero input means a low score, not missing data. No test set is included.
All quality reports are training/development-validation results.

The 2-8-1 tanh/sigmoid network has 33 parameters. Hidden parameters are stored
as eight [adventure weight, romance weight, bias] triples, followed by eight
output weights and one output bias. Seeded Xavier weights and zero biases
are used except in the all-zero preset. Seed 42 initializes weights; a new
seed 1000 + epoch generates each Fisher-Yates shuffle. All rows are visited
once per epoch. Mean gradients are computed per batch before each update.

The scaler uses only training means and population standard deviations.
Zero deviation is replaced by 1. With scaling disabled, means 0 and deviations
1 pass raw values through. Reuse the chosen scaler for every new prediction.

Cross-runtime note: the deliberately unscaled (`raw`) batch-size-4 case is
sensitive to roundoff. Python and JavaScript begin with matching values but
their later trajectories diverge. Both stop policies are tested for their own
selection and finite-value invariants, not falsely reported as exact parity.
The other 22 preset/batch/stop combinations match within the checked tolerance.
The chapter's printed numerical comparisons all use full batches of 16.

Six presets change one baseline setting: input scaling, all-zero initialization,
Adam rate, L2 penalty, or optimizer. Baseline rate is 0.03; fast uses 1. Adam
uses beta1=0.9, beta2=0.999, epsilon=1e-8, and bias correction. SGD has no momentum.
Its report has unused zero m/v arrays so the checkpoint schema stays consistent.
L2 adds lambda/2 times squared weights to the training objective and excludes
biases. This is Adam with L2, not AdamW. Dropout, normalization layers, clipping,
schedules, augmentation, and mixed precision are discussed but not implemented.

## Metrics and selection

Every epoch is evaluated with one fixed parameter snapshot. Both plotted losses
are mean binary cross-entropy without the regularization penalty. The training
objective, full-training objective-gradient norm, and hidden saturation are
reported separately. Saturation means abs(tanh activation) > 0.99, counted over
training rows and hidden units. Accuracy uses unrounded p >= 0.5.

`best` is the lowest observed validation data loss, including epoch 0. Exact
ties retain the earlier snapshot. Optional patience 30 uses its own reference:
an improvement greater than 0.0001 resets its counter. Smaller strict improvements
still update `best`. The run returns both `best` and `last`, including separate
weight lists and optimizer snapshots. Early stopping does not overwrite `last`
with `best`; select the desired snapshot explicitly.

For fast/full-batch, the 600-epoch run selects epoch 112 (loss about 0.041878),
but ends at loss about 0.189861. With early stopping, it stops at 46 and selects
16 (loss about 0.073782). A patience rule cannot anticipate later recovery.

## Use the selected predictor

```python
from train import run, forward

report = run("fast", early_stop=True)
raw_movie = [80, 0.2]
scaler = report["scaler"]
x = [(v - scaler["mean"][i]) / scaler["std"][i]
     for i, v in enumerate(raw_movie)]
hidden, logit, probability = forward(report["best"]["theta"], x)
print(probability)
```

Forward prediction needs no label or optimizer state and does not update weights.
To resume a real training job, preserve preprocessing, data/version identifiers,
architecture, weights, optimizer moments/counter, and shuffle or random state.
This workbook exposes those calculations but does not implement a resume CLI.

`--input PATH` loads a compatible JSON object with nonempty `train` and
`validation` lists. Each row needs a unique ID, two finite numeric inputs, and
integer label 0 or 1. Invalid input returns code 2. Steps are controlled by
`--epochs` (1-600) and `--batch-size` (4 or 16). The epoch cap is a teaching limit,
not a convergence guarantee. For small custom datasets, the last batch may be
smaller; full-split reported losses still average per example.

Tests check analytic gradients including L2 against finite differences, the
Adam update, scaler and validation boundaries, deterministic batch order,
zero-initialization failure, and checkpoint copying/selection. Presets are
illustrations, not universal training recommendations or an optimizer ranking.
