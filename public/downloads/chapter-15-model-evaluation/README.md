# Chapter 15: model evaluation workbook

Evaluate frozen movie thumbs-up predictions, inspect error tradeoffs, and select
a decision policy on validation before an optional final test. All movies,
labels, and candidate probabilities are authored synthetic teaching data.
Candidates A and B are not trained models, and this is not a benchmark result.

## Run

Extract these four files together: `evaluate.py`, `movie_predictions.json`,
`test_evaluate.py`, and `README.md`. Python 3.10+ is enough; no packages or API
calls are used. From a terminal in that folder:

```powershell
py evaluate.py
py evaluate.py --candidate baseline
py evaluate.py --threshold 0.85
py evaluate.py --slice short
py evaluate.py --cost unwanted
py -m unittest -v test_evaluate.py
```

Use your installed `python` or `python3` command if `py` is unavailable. The
default input is resolved beside the script, regardless of your working folder.
The CLI prints JSON without writing to files. The test runner may create Python's
normal `__pycache__` directory when it imports a module.

After settling the selection rule and cost assumption:

```powershell
py evaluate.py --evaluate-test
```

This chooses from the preset configurations using **all validation events**,
then evaluates only the chosen policy on **all test events**. It does not select
using test labels. The flag is a workflow reminder, not an access-control lock.
If test feedback guides a later change, those labels have become development
data and fresh independent evaluation is needed for the revised procedure.

## What is in the snapshot?

- Twelve validation events and eight test events; one distinct viewer per row.
- `liked` is observed feedback: 1 = thumbs-up, 0 = thumbs-down. Missing feedback
  is not represented and must not be silently converted into 0.
- `a` and `b` are frozen, authored probabilities of a thumbs-up.
- `prior_ratings` counts earlier feedback. A short-history slice has fewer than
  five ratings; a long-history slice has at least five. These are audit groups,
  not evidence of what features a real fitted model used.
- A separate authored training summary (6 positives / 24 events) supplies the
  constant baseline probability 0.25. Original training records are not included,
  so their provenance or separation cannot be audited from this workbook.
- Movie titles can repeat across viewers. IDs identify events and viewers.

The validator checks version `movie-evaluation-v1`, exact field names, up to
1000 events, unique E-prefixed three-digit event IDs, V-prefixed three-digit
viewer IDs, nonempty movie titles of at most 100 characters, nonnegative integer
history counts up to 10000, observed labels 0/1, and finite probabilities in
[0, 1]. Viewer IDs may repeat within one split but cannot cross validation/test.
Both splits must be nonempty. Training counts must be integers satisfying
0 <= positive <= total, with total in 1..100000. Booleans are not numeric values.

Invalid data, missing input files, nonfinite/out-of-range thresholds, and empty
selected slices produce `status: invalid_input` JSON and exit code 2. Malformed
CLI options use argparse's usage error and exit code 2. Success exits with 0.
For edits, copy the JSON and supply `--input path/to/copy.json`.

## Outputs and numerical conventions

The default `validation` report describes Candidate A, threshold 0.50, all rows,
and cost `misses` (FP costs 1, FN costs 3):

- TP = 3, FP = 2, TN = 7, FN = 0.
- Accuracy 10/12 = 83.3333%; precision 3/5 = 60%; recall 3/3 = 100%; F1 = 0.75.
- Total cost 2; cost per event 2/12.
- ROC-AUC 25/27 = 0.9259259, mean log loss 0.4485438, Brier score 0.14375.
- Constant baseline at 0.50: accuracy 75%, recall 0, precision undefined.

Decision rule: probability **greater than or equal to** threshold is positive.
Thresholds accept any finite number in [0, 1]. The website slider steps by 0.05.

Undefined ratios return JSON `null`, shown as "Undefined" on the website:
precision when there are no predicted positives; recall when there are no
observed positives; F1 when 2TP+FP+FN=0; specificity when there are no observed
negatives. Balanced accuracy and ROC-AUC require both observed classes here.

The ROC sweep starts with no predicted positives and adds equal-score groups
together in descending order. Its trapezoidal area agrees with pairwise AUC,
giving half credit to ties. AUC does not depend on the displayed threshold.
Neither do log loss and Brier score for the same rows and supplied probabilities.

Only log-loss calculation clips p to [1e-15, 1-1e-15] to produce finite JSON at
the endpoints. The mathematical loss for a wrong certainty would be infinite.
Decisions, Brier scores, and ROC ordering use the original p. The arithmetic
helpers assume already validated rows; `experiment` validates the full snapshot.

## Exploration versus the fixed selection procedure

`--candidate`, `--threshold`, and `--slice` affect the `validation` exploration
report. They do not alter the preset grid or the rows used for selection.

The `selection` object always compares A and B at thresholds
0.40, 0.50, 0.60, 0.70, and 0.85 on all validation events. It minimizes total
weighted error cost. Ties choose the first row in fixed order: A before B,
then ascending threshold. This deterministic tie-break is not a significance test.
The constant baseline is a reference in exploration, not a candidate in this grid.

Cost choices:

| `--cost` | FP cost | FN cost | Selected policy in this snapshot |
| --- | --- | --- | --- |
| `misses` (default) | 1 | 3 | A at 0.60 |
| `unwanted` | 3 | 1 | B at 0.70 |
| `equal` | 1 | 1 | A at 0.60 (fixed-order tie-break) |

`--evaluate-test` appends `final_test`, using that validation-selected policy,
not the manually explored one. Without the flag, no test metrics or test rows
are printed. Changing test labels cannot change validation scores or selection.

The website downloads only the exploration and selection reports. Both
implementations independently calculate the same metrics; repository checks
compare their results. There is no cross-validation fit, confidence interval,
calibration model, AP calculation, or deployed recommendation experiment here.

## Practice

1. Recalculate accuracy, precision, recall, and F1 from the default four counts.
2. Compare A/0.60 and B/0.70 under both unequal cost assumptions.
3. Flip only test event E013's label in a copy. Verify that validation and
   selection stay fixed while final-test metrics change.

The tests independently check confusion arithmetic, pairwise versus ROC AUC,
ties, undefined metrics, endpoint clipping, threshold monotonicity, sample
slices, selection/test isolation, input validation, and lack of data mutation.
