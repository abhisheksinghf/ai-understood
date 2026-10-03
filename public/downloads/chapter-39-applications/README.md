# Chapter 39: Cinema applications workbook

Use Python 3.10 or later. No dependencies, images, accounts, or network calls are required. All data and movie titles are fictional teaching examples.

```bash
python applications.py
python applications.py --threshold 0.9
python applications.py --weight 0 --k 2
python applications.py --weight 0.5 --k 3
python applications.py --forecast last
python applications.py --forecast mean3
python -m unittest -v test_applications.py
```

The program prints one JSON report. Redirect it to a file if desired: `python applications.py > report.json`.

## What is calculated

- Vision: supplied detections for one class, four labeled posters across two frames. Boxes use [left, top, right, bottom]. Keep scores at or above the chosen threshold, match highest score first to the highest-IoU unmatched truth in the same frame at IoU >= 0.5. Each truth is matched once. No non-maximum suppression runs; duplicates deliberately remain. Empty precision/recall denominators return null. This is a simplified point-metric evaluator, not COCO AP/mAP.
- Recommendations: five candidates after removing watched and unavailable movies. Content scores are cosine similarity to the supplied interest vector. Collaborative-style scores are authored inputs, not fitted factors. Both signals lie on a 0-1 teaching scale. Blend with the content weight and sort descending; exact ties use ascending movie ID. Future binary relevance is used only for evaluation. Compute precision, recall, and NDCG over the chosen top K. Recall and NDCG are null if there are no eligible relevant items.
- Forecasting: seven rolling one-day forecasts for days 15-21 of an authored 21-day series. Each origin can use observations only through the preceding day. Last value, trailing mean of three, and seasonal naive with lag seven have no fitted parameters. Report source days, actual-minus-prediction errors, MAE, and RMSE. No uncertainty intervals are estimated.

The three tasks are separate experiments, not outputs feeding one another. The controls have 54 joint configurations. Each run starts fresh. Internal calculations use full precision; reports round to six decimals. Task data is fixed for the UI and command-line choices; helper functions allow test fixtures with the same schema.

## Expected results

Default (threshold 0.6, weight 0.5, K=2, seasonal7): vision 3 TP / 2 FP / 1 FN, precision 0.6 and recall 0.75. Top movies are Starlit Journey and Quiet Orbit; precision=recall=0.5, NDCG=0.613147. Forecast MAE=RMSE=5.

Threshold 0.9 gives 1 TP / 1 FP / 3 FN; confidence does not ensure correctness. At weight 0, K=2, the relevant movie is second and NDCG=0.386853. At weight 0.5, K=3, recall=1 and NDCG=0.919721. Last-value MAE=22.142857; mean-three MAE=31.904762. Day 15's seasonal forecast uses day 8: prediction 45, actual 50.

These values describe this authored dataset only. One viewer and seven forecast origins do not establish population quality or future performance. Once you use this evaluation window to select settings, treat it as development data and reserve later untouched data for final evaluation.
