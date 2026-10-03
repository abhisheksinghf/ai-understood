# Chapter 27: choosing an adaptation approach

Python 3.10+; standard library only. Extract all four files into one folder.
No model, API, retrieval service, training process, or watchlist action runs.
This is a transparent teaching checklist, not an accuracy predictor.

```bash
py adaptation.py --scenario hybrid --design fineTune
py adaptation.py --scenario hybrid --design rag,readTool,writeTool
py adaptation.py --scenario behavior --ready --design fineTune
py -m unittest -v test_adaptation.py
```

Use `python` or `python3` if needed. The default scenario is `hybrid` and the
default design includes only the prompt baseline. Scenario names are `provided`,
`archive`, `availability`, `watchlist`, `behavior`, and `hybrid`.
`--ready` marks baseline evaluation, demonstrations, and held-out evaluation
as ready; it does not create these artifacts or establish a behavior gap.
Use `--help` for options. Invalid names or duplicate design choices exit with code 2.

## Read the report

`plan` records requirements, suggested roles, training readiness, and checks.
`assessment` compares the selected design with the required external roles.
Fine-tuning never substitutes for retrieval, live reads, or actual writes.
Omitting training does not fail the external-capability checklist: behavior
quality is a separate evaluation. `Inputs and actions covered` does not mean
implemented, authorized, safe, accurate, or ready for deployment.

## The explicit rules

1. Every design contains a prompt baseline.
2. Large document collections suggest RAG; live service state suggests a read tool.
3. A user-requested state change needs an authorized write tool.
4. Repeated stable behavior failures plus all three prerequisites make training
   a trial candidate. No gap means `Not indicated`; an untested prompt means
   `Build the baseline`; missing data/evaluation means `Prepare evidence`.
5. A trial still must beat an appropriate baseline on held-out quality, relevant
   regressions, and operating constraints before it is worth adopting.

The chapter assumes a large archive and an authoritative live availability
service. A small supplied catalog may need no retrieval; a sufficiently fresh
index could provide live facts in another architecture. Search may itself be
implemented as a tool. These are roles, not mutually exclusive products.

## Change a requirement in Python

```python
from adaptation import DATA, plan, assess
config = dict(DATA['scenarios'][5]['config'])
config['examplesReady'] = False
proposal = dict(rag=True, readTool=True, writeTool=True, fineTune=True)
print(plan(config)['fineTuning'])
print(assess(config, proposal))
```

Expect `Prepare evidence` and `Revisit adaptation choice`. Then turn off
`fineTune`: the external roles are covered, but behavior is still unmeasured.

The tests exercise readiness boundaries, capability separation, input validation,
and all 128 requirement combinations. No credentials or external dependencies
are required. All titles and scenarios are fictional teaching examples.
