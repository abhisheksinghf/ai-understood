# Chapter 4: Python for AI

This original, synthetic example evaluates fixed weights for:

    predicted seconds = weight * size + 1

Size is measured in thousands of records. It does not train a model, call an API,
or establish performance on future jobs.

## Run

1. Extract the ZIP before running.
2. Open a terminal in the folder containing evaluate_jobs.py and jobs.json.
3. Run: py evaluate_jobs.py

If your Python command is python or python3, use that command instead of py.
Python 3 is required. No additional packages are needed.

Expected output:

    w=1.0 | jobs=3 | MSE=4.6667 s^2
    w=2.0 | jobs=3 | MSE=0.0000 s^2
    Saved runtime_report.json

The script reads jobs.json from its own folder, validates the rows, and writes
runtime_report.json in the same folder. Running it again replaces that generated
report. Keep files you wish to retain under a different name.

## Try

- Change the third actual runtime from 7.0 to 8.0 and run again.
  At weight 2.0, MSE becomes 0.3333 s^2.
- Restore the original data. Import predict and evaluate into a scratch script
  and verify predict(2.5, 2.0) == 6.0.
- Test an empty list: evaluate([], 2.0) raises ValueError.

JSON uses double quotes around keys and does not allow trailing commas.
Numeric fields must be finite, nonnegative numbers, not strings or booleans.
Missing required keys or malformed input produce an error instead of a result.

The code uses dictionaries, lists, functions, a loop, imports, file paths,
JSON input/output, and specific exception handling from Chapter 4.
