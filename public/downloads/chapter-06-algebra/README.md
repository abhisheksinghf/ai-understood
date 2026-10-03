# Chapter 6: linear algebra you can inspect

Extract the ZIP, open a terminal in this folder, and run:

```powershell
py linear_algebra.py
```

Use Python 3.10 or newer. If your command is python or python3, substitute it for
py. No packages, account, internet connection, or model API is needed. The script
prints results; it creates no output files and does not train a model.

Expected output:

```
One prediction: 8.0 seconds
Batch predictions: [3.0, 5.5, 8.0]
Length of [3, 4]: 5.0
Cosine of [3, 4] and [6, 8]: 1.0
Rotated [2, 1]: [-1, 2]
Projected [2, 1]: [2, 0]
```

The prediction feature order is size in MB, then number of queued jobs. The toy
formula is 2 * size_mb + 0.5 * queued_jobs + 1. The separate geometry examples
use dimensionless coordinates. These are original synthetic examples, not a
validated runtime model or real text embeddings.

Try these edits in main(), then run the file again:

1. Change bias from 1 to 0: the batch becomes [2.0, 4.5, 7.0].
2. Change weights to [2]: the code raises ValueError because each row has 2 entries.
3. Evaluate cosine([0, 0], [1, 0]): it raises ValueError; zero has no direction.
4. Compare matvec([[1, 0], [0, 0]], [2, 1]) and the same call with [2, -3].
   Both return [2, 0]. The discarded coordinate cannot be recovered uniquely.

dot() multiplies corresponding entries and sums them. matvec() applies dot()
to each matrix row. predict_batch() then adds the scalar bias to every result.
The checks reject mismatched or ragged shapes instead of silently truncating.
For large arrays, practical libraries use optimized implementations; this small
workbook keeps the calculation visible and is not a general numerical package.
