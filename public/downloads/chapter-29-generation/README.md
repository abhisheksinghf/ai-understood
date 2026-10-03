# Chapter 29: Generative AI beyond language

Requires Python 3.10 or newer. Uses only the standard library. Extract all four files into one folder, open a terminal there, and run:

```sh
python generation.py
python generation.py --level 7 --estimator oracle
python generation.py --style adventure --guidance 3 --steps 16 --seed 7
python -m unittest -v test_generation.py
```

The JSON output contains two independent reports, `corruption` and `generation`. The CLI style and seed apply to both; the web lab lets you select them separately. Save a report with `python generation.py > report.json`.

## What this models

A fictional poster is represented by two coordinates: cool-to-warm color and spare-to-busy composition. Calm and adventure are Gaussian distributions with means [-1.25, -0.75] and [1.25, 0.75], each with per-coordinate variance 0.25. The unconditional distribution is their equal mixture. This is not an image model, and coordinates are not image-quality scores.

Corruption computes `y = sqrt(a)*x + sqrt(1-a)*noise`. Changing the noise level holds the original and noise draws fixed for a fixed seed/style. The analytic conditional estimator knows the style; the unconditional estimator averages the two component posteriors with Bayes weights. The oracle instead uses the actual noise draw and is only a teaching identity. Normal estimators do not have this hidden information. `mse` is reconstruction error across two coordinates, not visual fidelity.

The `conditionalVariance` field means posterior variance within a known style, not total mixture variance. More corruption increases this expected uncertainty; one particular example's reconstruction error need not increase monotonically.

Generation starts with a standard-normal draw and a signal coefficient of 0.001, which only approximates the terminal noised-data distribution. A finite cosine-spaced schedule advances to a=1 using a zero-added-noise DDIM-style step. Guidance combines noise predictions as `unconditional + s*(conditional - unconditional)`. Zero ignores the style, one uses the conditional prediction, and values above one extrapolate. This analytic denoiser replaces a learned network for teaching. Finite steps and the approximate starting distribution prevent a claim of exact target samples.

The `distance` field is Euclidean distance from the final point to the selected style mean. It is not a quality score. With guidance zero, changing style leaves the trajectory unchanged but changes this reference distance.

## Experiments

1. Compare levels 1 and 7, then use the oracle. Explain the source of uncertainty.
2. Compare target styles at guidance 0 and 1. Explain why only the latter steers the path.
3. Compare 4 and 16 steps with one seed. More steps refine a numerical approximation; they cannot fix a wrong learned distribution.

The reproducible generator uses a 32-bit linear congruential sequence and Box-Muller normals to match the web lab. This is for reproducibility, not cryptography. Tiny floating-point differences across runtimes are expected. The tests check identities, conditioning, fixed draws, trajectory boundaries, and invalid configurations.

## Further reading

- DDPM: https://arxiv.org/abs/2006.11239
- DDIM: https://arxiv.org/abs/2010.02502
- Classifier-free guidance: https://arxiv.org/abs/2207.12598
- Flow matching (explained in the chapter; not implemented by this workbook): https://arxiv.org/abs/2210.02747
