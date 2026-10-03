# Chapter 12: preparing data for machine learning

Python 3.10+; standard library only. All viewers, viewing events, labels, and reviews are synthetic. This workbook prepares features and targets. It does not train a predictive model or call a service.

Extract every file into one folder and run:

```powershell
py prepare_data.py
py prepare_data.py --strategy mean
py prepare_data.py --leaky-demo
py -m unittest -v test_prepare_data.py
```

Use your working python or python3 command if py is unavailable. All paths default to files beside the script, so it can also be called from another folder. Output is JSON on stdout; files are never overwritten by the script. Invalid file/setup/options return a nonzero exit code (2 for handled input errors). Exit 0 with quarantined rows means processing completed with the audit shown, not that every input row was valid.

## Files and contracts

- `raw_watch_events.csv`: 13 records, seven text columns in documented order: event_id, viewer_id, movie_id, runtime_minutes, genre, liked, review_after.
- `raw_watch_events.json`: exactly the same raw values, shared with the browser demo. Tests prevent drift.
- `split_plan.json`: viewer IDs assigned to train, validation, or test; no viewer may appear twice.
- `prepare_data.py`: reading, cleaning, grouping, fitting, transforming, and CLI.
- `test_prepare_data.py`: audit, numerical results, group isolation, held-out invariance, target leakage boundaries, unknown categories, and edge cases.

Each event is one viewer watching one movie. The label is a later thumbs-up (1) or thumbs-down (0). A missing label is not a negative label. The task is a pre-watch prediction using only runtime and primary genre. IDs are metadata; review_after is future information and is excluded from X. The data have no event timestamps and do not establish chronological generalization. Movie metadata alone cannot personalize scores to different viewers with otherwise identical inputs.

## Fixed data-quality rules

Trim text, lowercase genres, and map the explicit alias sci fi to sci-fi. Runtime must be blank or an integer from 1 to 600. Label must be blank, 0, or 1. IDs follow E + two digits, U + two digits, and M + three digits. These ranges are exercise contracts, not universal movie facts.

Malformed records are quarantined with input row number and reason. Among valid normalized records, identical copies of an event ID keep one copy; conflicting copies of an event ID are all quarantined. Different event IDs for the same viewer/movie are not automatically duplicates. Unlabeled events are recorded separately and excluded from this supervised table. The default audit is 13 raw, 10 kept, 1 duplicate copy, 1 quarantined record, and 1 unlabeled event. Missing runtimes on E04 and E06 remain missing in the cleaned records.

## Split, fit, transform

U01-U03 provide 6 training rows. U04 supplies 2 validation rows; U05 supplies 2 test rows. These are predetermined teaching groups, not a randomly sampled evaluation benchmark. The counts and labels are far too small for meaningful accuracy estimates.

Fit the fill value from observed training runtimes. Median is 110; mean is 112.5. Fill a temporary numeric column, then learn its mean and population standard deviation from training rows. The default scaling mean is 111.6667 and standard deviation 14.9071. A zero standard deviation uses scale 1; an entirely missing training runtime column stops for an explicit policy decision.

The output X has runtime_z, runtime_missing, one indicator for each genre in the sorted training vocabulary, and a reserved unknown-genre indicator. The label y is separate. The training matrix is 6 x 8; validation and test are each 2 x 8. All splits use the same fitted values and column order. Documentary is unseen during fitting and activates the unknown column in held-out rows. This bucket keeps the shape usable; it does not establish accurate predictions for new genres.

The `--leaky-demo` comparison deliberately learns fill values, scaling, and vocabulary from all splits. The pooled median becomes 127.5 and the vocabulary includes documentary (9 total columns). The JSON marks leakage_demo:true and fit_scope:all. Do not use this comparison to claim valid held-out performance. No performance is measured here.

## Inspect or modify the experiment

The result includes the pipeline version, split plan, audit, fitted state, cleaned splits, and prepared X/y arrays. Retain the exact raw input and split-plan files alongside a saved result; the pipeline version identifies code policy, not the contents of a changed dataset. Changing held-out runtimes must not change training-only fitted state or training X. It will change the intentionally leaky fit.

Custom input: `py prepare_data.py --input your_events.csv --plan your_splits.json`. Edit copies of the provided files. Unknown kept viewers require an explicit split assignment. Do not use real personal viewing histories for this learning exercise.

Imputation creates model inputs, not verified movie facts: the original runtime must remain unknown for Chapter 11's hard runtime constraint. General cleaning conventions can be fixed before splitting, but data-dependent choices (outlier thresholds, feature selection, vocabularies, averages) must be fitted inside training, including each training fold when cross-validating.

References: [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html), [preprocessing](https://scikit-learn.org/stable/modules/preprocessing.html), [group and time-aware validation](https://scikit-learn.org/stable/modules/cross_validation.html), [missing-value imputation](https://scikit-learn.org/stable/modules/impute.html).
