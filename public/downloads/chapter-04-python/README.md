# Chapter 4: Python for AI

This original, synthetic example evaluates fixed weights for:

    predicted price units = weight * area + 1

Area is measured in 1,000 sq ft. One price unit is 10 lakh rupees (1,000,000 rupees). A prediction of 5 means 50 lakh rupees. It does not train a model, call an API,
or establish performance on future houses.

## Run

1. Extract the ZIP before running.
2. Open a terminal in the folder containing evaluate_houses.py and houses.json.
3. Run: py evaluate_houses.py

If your Python command is python or python3, use that command instead of py.
Python 3 is required. No additional packages are needed.

Expected output:

    w=1.0 | houses=3 | MSE=4.6667 price_units^2
    w=2.0 | houses=3 | MSE=0.0000 price_units^2
    Saved price_report.json

The script reads houses.json from its own folder, validates the rows, and writes
price_report.json in the same folder. Running it again replaces that generated
report. Keep files you wish to retain under a different name.

## Try

- Change the third actual price from 7.0 to 8.0 and run again.
  At weight 2.0, MSE becomes 0.3333 price_units^2.
- Restore the original data. Import predict and evaluate into a scratch script
  and verify predict(2.5, 2.0) == 6.0.
- Test an empty list: evaluate([], 2.0) raises ValueError.

JSON uses double quotes around keys and does not allow trailing commas.
Numeric fields must be finite, nonnegative numbers, not strings or booleans.
Missing required keys or malformed input produce an error instead of a result.

The code uses dictionaries, lists, functions, a loop, imports, file paths,
JSON input/output, and specific exception handling from Chapter 4.
