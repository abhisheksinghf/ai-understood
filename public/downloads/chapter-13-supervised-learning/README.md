# Chapter 13: supervised learning

A standard-library Python workbook with real fits for linear rating regression and logistic thumbs-up classification. All records are synthetic. This new snapshot adds a pre-watch history feature and two feedback targets; it does not modify Chapter 12's dataset. The tiny results illustrate arithmetic, not production recommendation quality.

## Files and running

- `movie_learning.json`: twelve events, with explicit train/validation/test roles (6/3/3).
- `supervised.py`: validation, model fitting, prediction, metrics, and CLI.
- `test_supervised.py`: nine groups of checks, including independent math and leakage boundaries.
- `README.md`: this guide.

Use Python 3.10+ from the extracted folder:

```powershell
py supervised.py
py supervised.py --task classification
py supervised.py --task classification --threshold 0.9
py supervised.py --task classification --strength 1 --history 0.75
py -m unittest -v test_supervised.py
```

Use `python` or `python3` if that is your working command. No installation, network access, or API key is needed. Default data paths resolve beside the script, independently of your current directory. Output is JSON on stdout; inputs are never rewritten. Success exits 0, malformed inputs/setup exit 2. `--input path/to/copy.json` selects another snapshot with the same schema/version. Fix your choices using validation first; append `--evaluate-test` for test metrics. This flag does not stop repeated peeking or establish credible performance with only three test events.

## What the feature means

One event = a viewer watching a movie. `history_like_fraction` is likes / rated movies from that viewer's earlier history in the target movie's genre. Only information available before this event may be included. Values are supplied synthetic fractions; this code cannot prove temporal provenance because no raw history is included. Zero history would require a separate missing-history policy; zero fraction means no likes among some prior rated movies. Counts are not modeled. Viewers do not cross splits, but held-out viewers may have their own legitimate earlier history. This is not a no-history cold-start experiment.

The fixed feature is `x = 2*s - 1`, with `s` in 0–1. IDs and labels never enter x. `rating` (1–5) and `liked` (0/1) are separate recorded outcomes; neither is derived from the other. Rating regression treats ordinal differences as numeric distances. Records have strict fields, finite numeric values, unique event IDs, and disjoint viewer groups. Training requires at least two rows and both thumbs-up classes; held-out splits must be nonempty. Missing or invalid inputs stop the run rather than receiving undocumented defaults.

## Models and objectives

Regression predicts `w*x+b`. It minimizes `0.5 * mean((prediction-rating)**2) + 0.5 * strength * w**2`. The closed-form weight is centered covariance divided by `(centered variance + strength)`, with intercept `mean(y)-w*mean(x)`. A constant feature at strength 0 stops with a suggestion to use a baseline or positive regularization. Predictions are not rounded or clipped.

Classification predicts `sigmoid(w*x+b)` and minimizes mean binary log loss plus `0.5 * strength * w**2`. Initialization is w=b=0. Every one of 2,000 full-batch steps computes both gradients from the old parameters and subtracts learning rate 0.3 times each gradient. The intercept is unpenalized. The fixed iteration budget is not a general convergence guarantee. Sigmoid and log-loss calculations avoid avoidable exponential overflow. Strength options are 0, 0.1, and 1; scales are specific to these objectives and feature units.

Prediction uses the stored weights. Classification uses `p >= threshold`, including equality. Changing threshold does not mathematically change the fit or probability. Separate CLI runs recompute the same deterministic fit. The browser caches fitting until task/strength changes. Fitting a new strength changes parameters. No model is fitted to validation/test rows.

## Expected default results

At s=0.75, x=0.5, strength=0:

| Quantity | Regression | Classification |
| --- | --- | --- |
| Weight | 1.8571428571 (13/7) | approximately 3.0350689588 |
| Intercept | 3 | approximately 0 |
| Prediction | 3.9285714286 | 0.8201751332 |
| Training loss | MSE 0.0571428571 | Log loss 0.4129978058 |
| Validation loss | MSE 0.1878231293 | Log loss 0.3418120893 |

Threshold 0.5 returns class 1; 0.9 returns class 0 for this query. L2 strength 1 changes the rating prediction to 3.2954545455 and probability to 0.5261036459. Metrics exclude the regularization penalty. Regression reports MSE, RMSE, and MAE; classification reports average log loss, accuracy, and TP/FP/TN/FN counts. Baselines use training mean rating (3) or training positive proportion (0.5), with the same threshold. At 0.5, the constant classifier predicts positive, including the tie. Both classifiers get 2/3 validation events correct but have different log losses.

## Small experiments

1. Change only S08's validation rating from 3 to 5. The regression fit and training metrics must remain unchanged; validation MSE changes.
2. Compare thresholds 0.5 and 0.9 for the same fitted classifier. Parameters and log loss stay unchanged; decisions can change.
3. Increase strength. Weights shrink in this example, but validation need not improve. Preserve the original snapshot before editing.

Store the raw snapshot, feature policy, fitted parameters, ordered inputs, split plan, and code version together when extending this into an application. No file here is a serialized production model. The browser uses JavaScript rather than running this Python; project checks compare both implementations across all six model configurations and thresholds.

Primary references: [linear models](https://scikit-learn.org/stable/modules/linear_model.html), [classification thresholds](https://scikit-learn.org/stable/modules/classification_threshold.html), [regression loss](https://developers.google.com/machine-learning/crash-course/linear-regression/loss), [logistic loss](https://developers.google.com/machine-learning/crash-course/logistic-regression/loss-regularization).
