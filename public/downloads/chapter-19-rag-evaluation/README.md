# Chapter 19: improving and evaluating RAG

Extract all five files together. Use Python 3.10+ and its standard library. Run `evaluate.py`, not the copied engine's standalone CLI. The evaluation commands make no network or model calls and write no files. `rag.py` is the unchanged Chapter 18 pipeline engine. Its optional local-model adapter is not invoked by this evaluator.

```sh
py evaluate.py --config wide
py evaluate.py --config wide --slice missing
py evaluate.py --config tight --case Q1
py evaluate.py --audit wrong_citation
py -m unittest -v test_evaluate.py
```

Use `python` or `python3` if needed. Commands print JSON; `--input PATH` reads another compatible benchmark. Exit 0 means the evaluation ran, not that the evaluated system passed every case. Invalid inputs exit 2.

## What is real and what is authored?

The source records are the eight fictional movies from Chapter 18. Eight public development cases supply question text, a preset lexical search, and a requested field. The pipeline uses real BM25 retrieval, section chunking, greedy word-unit packing, and the deterministic evidence formatter. This formatter can choose another movie's fact; Q5 exposes that limitation.

Reference facts and `gold` labels are passed only to the evaluator after the pipeline runs. Tests change labels and verify that retrieval, context, and generation remain identical. Stable fact IDs decouple evidence judgments from chunk IDs, although the source snapshot and reference facts must still agree. These eight cases are visible teaching development data, not a held-out or representative production sample.

Three fixed configurations:

| ID | Candidate count K | Evidence word budget | Task success |
| --- | --- | --- | --- |
| narrow (A) | 1 | 50 | 5/8 |
| wide (B) | 3 | 50 | 7/8 |
| tight (C) | 3 | 20 | 5/8 |

B wins Q1, Q4, and Q7, loses Q5, and ties four cases against A: +25 percentage points. Q5 requests Unlisted Voyage's unknown runtime; B supplies Moonlight Map's 105-minute runtime. Quote support is 100% while the answer is wrong. C retrieves every required fact but drops some while packing. Mean evidence units: A=11.875, B=39.75, C=11.875. These are not model tokens or measured latency.

## Metric conventions

- Each current answerable case requires one fact. Required-fact retrieval recall checks candidates; context recall checks packed passages. Macro means include only answerable cases. A missing-fact case has undefined recall.
- A case succeeds if its required facts are correctly answered without extraneous wrong facts, or if the requested fact is missing and the system abstains.
- Answer coverage = answered/all. Answered accuracy = correct answers/answered. False-answer rate = answered missing-fact cases/all missing-fact cases.
- Exact-quote support = quotes present in their cited packed passage/all emitted quotes, pooled across cases. It is not a semantic faithfulness grader or task-correctness measure.
- Empty denominators are JSON `null`, displayed as Undefined in the browser. An empty answer does not get perfect support.
- Paired comparisons align by question ID. The delta is candidate task success minus baseline task success. No confidence interval or significance claim is calculated.

## Citation exercise

Six authored answer fixtures answer “What is Quiet Orbit about, and how long is it?” Their `supported_by` and `covers` fields are authored judgments, not automated semantic inference. The program calculates context support, valid citation IDs, citation precision, citation coverage, and required-fact coverage from those labels. Each example uses claims supportable by one passage; joint multi-source support needs a richer rubric.

Examples: a runtime-only answer has full support but half completeness; a real but wrong attached source gives zero citation precision; a true Winter Road fact can be fully supported and cover none of the required Quiet Orbit facts. No citation links means undefined link precision, not perfect precision.

Inspect `run_case`, `summarize`, `compare`, and `audit` in `evaluate.py`. Do not tune against reference labels by feeding them to the generator. For live LLM evaluation, record actual outputs and provenance, define a task rubric, use a calibrated grader, repeat runs where needed, and confirm changes on separate held-out cases. This workbook does not run an LLM judge or claim model quality.
