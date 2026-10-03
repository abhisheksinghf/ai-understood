# Chapter 40: Connections workbook

Use Python 3.10 or later. No dependencies, accounts, or network calls. All movies, counts, probabilities, and annotations are fictional teaching data.

```bash
python connections.py
python connections.py --steps 3
python connections.py --topology shortcut
python connections.py --allocation balanced --targetHigh 0.75
python connections.py --strategy confident --budget 1
python -m unittest -v test_connections.py
```

The program prints one JSON report. Save it with `python connections.py > report.json`.

## Three separate experiments

- Graph: undirected chain A-B-C-D, optional A-D shortcut, isolated E. Every synchronous round mixes half the old feature with half the old neighbors' mean. Isolated nodes keep their value. No weights are fitted: this is an aggregation demonstration, not a trained GNN. Features are not probabilities. The report includes final values, snapshots, and per-node update traces.
- Causal comparison: compare viewing proportions with/without a banner. High/low prior interest has different distributions across exposure groups in the unbalanced table. Standardize both rates to the chosen target group weights. The balanced table changes counts while preserving within-group rates; balanced counts alone do not prove randomization. A causal interpretation additionally requires sufficient confounder adjustment, treatment consistency, overlap, and appropriate applicability to the target population. This calculation estimates no uncertainty interval.
- Active queries: rank supplied review predictions by binary entropy (base 2). Uncertain-first ranks descending; confident-first ranks ascending as a comparison. Use six-decimal entropy keys and ascending review IDs for ties. Only after selection are supplied annotations revealed. Unselected labels are null. There is no retraining or performance estimate; selected entropy is not accuracy.

There are 144 joint settings. Every calculation starts fresh. The three experiments do not feed into one another. Use full precision within graph/standardization calculations and round outputs to six decimals. The active-query mean uses the explicitly rounded ranking scores. Helpers accept alternate data fixtures with the same schema; the UI and CLI use the supplied fixed data.

## Expected results

Default: one chain update gives A=0.5, B=0.25, C=D=0, E=0.4. The unbalanced table gives pooled viewing rates 0.68 versus 0.42, contrast +0.26 (26 percentage points). At a 50/50 target mixture, standardized rates are 0.5 versus 0.6, contrast -0.1. The two most uncertain reviews are R1 and R2, mean entropy 0.996387 bits.

Three chain updates: A=0.3125, B=0.234375, C=0.09375, D=0.03125, E=0.4. One update with shortcut A-D gives D=0.25. Balanced counts give pooled contrast -0.1. A 75% high-interest target gives standardized rates 0.65 versus 0.75. Every group has a -0.1 contrast here, so changing target weights changes both rates but leaves their difference unchanged.

The two most confident reviews are R5 and R6, mean entropy 0.111117 bits. R5 is confidently wrong about a sarcastic review. Its label does not change the ranking. Choosing uncertain reviews is a heuristic, not proof that the next trained model will improve. Compare annotation strategies after retraining against an independent evaluation set, at the same labeling budget.
