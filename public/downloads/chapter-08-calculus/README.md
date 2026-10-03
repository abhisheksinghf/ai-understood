# Chapter 8: calculus, optimization, and information theory

Run `py calculus_lab.py` from this folder with Python 3.10 or newer. Use `python` or `python3` if that is your installed command. No extra packages or network access are required. The script prints results and writes no files.

The optimizer minimizes the dimensionless teaching objective L(w) = (w - 3)^2 / 2. Its derivative is w - 3. This is real gradient descent on a chosen function; it does not train a useful predictor or measure production performance. It is separate from Chapter 3's runtime dataset.

Expected output:

```text
Step 0: w=0.00000, loss=4.500000
Step 1: w=1.50000, loss=1.125000
Step 2: w=2.25000, loss=0.281250
Step 3: w=2.62500, loss=0.070312
Step 4: w=2.81250, loss=0.017578
Step 5: w=2.90625, loss=0.004395
Derivative at w=1.5: exact=-1.500, finite difference=-1.500
Entropy=0.811278 bits; cross-entropy=1.000000 bits; KL=0.188722 bits
Zero predicted probability on a possible outcome: inf
```

Python's formatting uses its rounding rules. Exact step-3 loss is 0.0703125; the printed last digit is not evidence of different mathematics.

Try these changes:

1. Print `descent(rate=1)`, `descent(rate=1.5)`, `descent(rate=2)`, and `descent(rate=2.2)`. One reaches the minimum immediately, one alternates while approaching it, one cycles, and one moves away. These statements are for this objective and a nonoptimal starting point.
2. Use `descent(start=3, rate=2.2)`. The exact gradient is zero, so it stays at the minimum even with this rate. A poor learning rate does not create a nonzero gradient by itself.
3. Compare `cross_entropy(p, p)` with `entropy(p)` for `p=[0.75,0.25]`, then try a mismatched forecast. Keep the same category order. KL is cross-entropy minus entropy.

All information values use log base 2, so the unit is bits. Natural-log training losses use nats. Zero-probability target categories contribute zero; assigning zero predicted probability to a target category with positive probability gives infinite cross-entropy. This workbook preserves that mathematical distinction rather than silently clipping probabilities.

The central finite difference estimates a derivative using two nearby function evaluations. It is not automatic differentiation. Changing its step size can change rounding and approximation error; making the step arbitrarily tiny does not guarantee a better numerical result.
