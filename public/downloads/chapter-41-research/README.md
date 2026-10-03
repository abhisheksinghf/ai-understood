# Chapter 41: Research evidence workbook

Python 3.10 or later; standard library only. No network, credentials, training, or model calls. Every result is fictional teaching data. The three experiments use separate datasets.

```bash
python research.py
python research.py --overlap exclude
python research.py --scope facts --overlap exclude
python research.py --sample 400
python research.py --protocol unequal --remove retrieval
python research.py --remove reranker
python -m unittest -v test_research.py
```

Redirect a JSON report with `python research.py > report.json`.

## What is calculated

- Audit: 12 paired cases across facts, preference matching, and tool use. Outcomes are supplied 0/1 rubric results. Four cases have fictional documented overlap with the candidate's training material. A scope filter selects a task; exclusion removes flagged cases from BOTH denominators. Excluded rows remain visible for auditing. Count successes, paired wins/losses/ties, and the candidate-minus-baseline difference. An empty selection returns null rates. Filtering changes the population; it neither proves the cause of a difference nor certifies remaining cases as unseen.
- Uncertainty: separate hypothetical study summaries of 20/25, 80/100, and 320/400 successes. Compute a 95% Wilson score interval with z=1.96. It assumes independent trials with a common success probability. It does not model training-run variability, clustering, or bias, and is not an interval for a two-model difference. Larger sample settings are hypothetical independent studies, not duplicated rows. The helper returns null interval fields at n=0 and rejects invalid counts.
- Ablation: four supplied variants on the same 100 cases. A small catalog is available to all: retrieval narrows candidates, reranking reorders, and neither uses a fixed ordering. In the matched protocol, each has a 1,500-token ceiling. The unequal protocol replaces only the full variant's summary with 90 passes and a 3,000-token ceiling. Compare the full variant with the specified removal. Only matched budgets show the descriptive interaction: both - retrieval - reranker + neither. No per-case outcomes or repeated runs are supplied, so no paired confidence interval is estimated. Equal token ceilings do not imply equal costs or latency.

The UI/CLI support 144 joint settings. The experiments are independent. Calculations start fresh, use full precision, and round reports to six decimals. Interval width is calculated before rounding endpoints, so the last decimal can differ from subtracting displayed endpoints. Data-fixture helper arguments are for tests and teaching extensions with the same schema.

## Expected results

Default audit: baseline 6/12=0.5, candidate 9/12=0.75, difference +0.25; candidate wins/losses/ties 4/1/7. Exclude overlap: baseline 6/8=0.75, candidate 5/8=0.625, difference -0.125; wins/losses/ties 0/1/7. Facts alone after exclusion: 2/2 versus 1/2. Preference and tool slices each tie at 2/3 after exclusion.

Wilson for 20/25: [0.608687, 0.911395], width 0.302709. For 80/100: [0.711169, 0.866634], width 0.155465. For 320/400: [0.758029, 0.836264], width 0.078235. All observed rates are 0.8.

Matched ablation: neither 60%, retrieval 75%, reranker 65%, full 84%. Remove retrieval: +19 percentage points; reranker: +9; both: +24. Interaction = +4 points. Unequal-budget full =90%: the contrasts become +25, +15, and +30 points; interaction is null because budget changes too.

## Reusable research note

- Source URL, paper version/revision, date checked:
- Question and operational claim:
- Data population, split, and overlap checks:
- Baseline, model/prompt/tool setup, attempt and resource budgets:
- Metric, denominator, result, and uncertainty:
- Known limitations and untested settings:
- My small reproduction or hand calculation:
- What would change my conclusion:
- Decision and next check:

Do not treat any of these toy datasets as evidence about real models or AGI.
