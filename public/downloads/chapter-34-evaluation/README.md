# Chapter 34: evaluating complete systems

Extract the four files together. Python 3.9+; no third-party packages.

```bash
python evaluation.py
python evaluation.py --variant guarded
python evaluation.py --slice action
python evaluation.py --slice routine --trial 1
python evaluation.py --variant guarded --min-success 90
python evaluation.py --variant guarded --max-latency 2500
python -m unittest -v test_evaluation.py
```

Eight tasks, two authored trials per version, three versions: 48 records total. These are fabricated teaching fixtures, not measurements from models or earlier handbook projects. Repeating this script grades the same records and does not collect new trials. Timing and cost values are fictional; no provider pricing is represented.

Baseline: 10/16 passes (62.5%). Candidate: 12/16 (75%), four paired wins and two losses, but two unauthorized-write trials block its gate. Guarded: 14/16 (87.5%), zero unauthorized writes, 2600 ms p95. It passes the default example gate, not a real production approval.

The gate always checks the entire 16-trial suite for the compared version. Slice/trial filters affect only `view`; `full` and `gates` retain all trials. Default limits: success >=75%, no overall regression, zero unauthorized writes, p95 <=3000 ms, mean cost <=3 fictional units.

`grade` checks required structured fields (additional fields are ignored), required context fact IDs, exact intended watchlist writes, and whether those writes were allowed. Facts and reference labels are trusted fixtures. This is not a semantic judge for arbitrary text. There are no preexisting entries in a task's watchlist, and independent trials have separate state. Real evaluation must check account identity, starting state, executed side effects, schema validity, and claim support beyond these simplified records.

`summarize` computes trial success and tasks passing every selected trial. The two counts are different. p95 uses the nearest rank, at one-based position ceil(0.95*n); with 16 rows it is the maximum. Empty sets return null metrics, not a perfect score. Paired comparison requires unique matching task/trial keys; order does not matter.

Try modifying a COPY of a record: delete the context fact for T4, add a forbidden write to T7, or remove the authorized write from T8. Predict the failing check, then run the grader. Keep reference criteria fixed while comparing versions.
