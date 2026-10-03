# Chapter 14: movie structure workbook

Explore real k-means updates and one-component PCA using nine fictional movies.
The two 0–10 scores describe action and humor. They are invented teaching data,
not viewer feedback, genre labels, or measurements of real films.

## Run

Extract all four files together. Use Python 3.10+; no packages, credentials, or
network calls are needed. In this folder on Windows:

```powershell
py unsupervised.py
py unsupervised.py --steps 0
py unsupervised.py --steps 1
py unsupervised.py --start first
py unsupervised.py --k 2 --humor-weight 3
py unsupervised.py --mode pca
py -m unittest -v test_unsupervised.py
```

Use `python` or `python3` if that is your installed command. The script resolves
its default JSON input relative to itself, so it also works from another folder.
It prints JSON to standard output without editing input files. Python's test
runner may create an ordinary `__pycache__` folder when importing modules.

Files: `unsupervised.py`, `movie_features.json`, `test_unsupervised.py`, and this
`README.md`. To try edits, copy the JSON and run `--input your-copy.json`.

## Read the results

Default k = 3, spread start, humor ×1:

- Step 0: nearest-center assignment; inertia = 75.
- Step 1: mean update and reassignment; inertia = 51.1666666667.
- Centers: (23/6, 14/6), (2, 9), (8.5, 8.5); assignments then stabilize.
- The first-row start reaches inertia 55.3333333333 with the same k and scales.

PCA always uses the two original, equally scaled scores. It ignores clustering
choices (`--k`, `--start`, `--humor-weight`, and `--steps`). Its center is about
(4.6667, 4.4444), direction (0.6851, 0.7285), and explained-variance ratio
0.6997313492. Mean squared reconstruction distance is 5.7458815889. Scores and
reconstructed points are listed in the same order as the movies.

Clustering JSON uses zero-based assignments 0, 1, 2; the website labels these
C1, C2, C3. Centers in the JSON use the actual fitted coordinates, so their humor
coordinate is scaled when `--humor-weight 3` is active. The website divides
that coordinate by 3 to plot centers against the original-score axes.

## Understand the implementation choices

- Squared Euclidean distance is the clustering objective. Multiplying a feature
  coordinate by 3 multiplies its squared-distance contribution by 9. Do not
  compare raw inertia across differently scaled representations.
- Spread start uses rows first/middle/last for k = 3, or first/last for k = 2.
  First-row start uses the first k rows. These choices are deterministic and
  depend on row order; neither implements k-means++.
- The first state already has assignments. Each update moves centers to current
  group means, then reassigns points. At intermediate steps, a center can differ
  from the mean of its newly assigned group.
- Equal distances choose the lowest center index. Empty groups retain their
  prior centers. Fewer than k occupied groups are possible with duplicate points.
- Stop when assignments are unchanged after a center update, or after 50 updates.
  `converged: true` means the assignment stopping rule was met, not a global
  optimum or a verified semantic grouping.
- PCA computes the two-by-two population covariance (sums divided by n), then
  its largest-eigenvalue direction. Sample covariance with n − 1 would produce
  the same direction and variance ratio with differently scaled eigenvalues.
- Directions have arbitrary sign. The implementation chooses nonnegative first
  component; equal eigenvalues within 1e-14 choose (1, 0). Total variance at or
  below 1e-14 raises an error because the ratio is treated as undefined.
- Reconstruction residuals are squared Euclidean distances in original units.
  For this one-component, two-feature fit, their average equals the discarded
  eigenvalue. Explained variance is not a target-accuracy measurement.

The arithmetic helpers assume finite, two-dimensional points. `experiment`
validates the versioned movie dataset before calling them. This implementation
is deliberately small and educational, not a general-purpose ML library.

## Data contract and errors

The JSON object has exactly `version` and `movies`; version is
`movie-structure-v1`. Provide 3–1000 movie rows. Every row has exactly `id`,
`title`, `action`, and `humor`: a unique M-prefixed three-digit ID, a nonempty
title of at most 100 characters, and finite numeric feature scores from 0 to 10.
Booleans, missing/extra fields, duplicate IDs, and nonfinite scores are invalid.

Valid choices are k = 2 or 3, start = spread or first, humor weight = 1 or 3,
and steps = an integer from 0 through 50. Bad data, inaccessible files, and
out-of-range steps produce `status: invalid_input` JSON and exit code 2.
Malformed command-line options use argparse's usage error and exit code 2.
Success exits with code 0. The script makes no file writes or API calls.

## Scope and practice

This is an exploratory fit on the entire supplied collection. There is no test
split and no claim of generalization to future viewers or films. If these
methods become preprocessing for a predictive model, fit them on training data
only and reuse that fit for held-out data.

1. Calculate the distance between (2, 3) and (3, 4) before/after humor ×3.
2. Recover the default centroid (23/6, 14/6) and explain what it means.
3. Project (3, 3) onto the first component of [(1, 1), (2, 2), (3, 3)]; then
   compare the exact reconstruction with Cafe Chaos's loss of detail.

The tests check hand-calculated solutions, objective monotonicity, fixed-point
means, feature weighting, permutation-equivalent groups, empty groups, input
validation, and PCA projection/reconstruction properties. The website performs
the same calculations independently in JavaScript; project checks compare
both implementations across every exposed clustering configuration and PCA.
