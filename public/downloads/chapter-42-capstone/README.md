# Chapter 42 - Movie assistant capstone

Python 3.10+; standard library only. Extract all four files into the same directory.
All films, service names, records and cases are authored fiction. `online` means a
successful local fixture, not an internet call. This reference is deterministic
retrieval, rules and templates; it does not train or call an LLM.

## Run and inspect

```sh
python assistant.py
python assistant.py --case C1
python assistant.py --constraints off --aliases off
python assistant.py --aliases off
python assistant.py --tool timeout
python -m unittest -v test_assistant.py
```

Default: 8/8 public development cases, zero constraint violations, demo gate passes.
Constraints off + aliases off: 4/8, three violations. Aliases off alone: 7/8.
Tool timeout with the default safeguards: 7/8, zero constraint violations, one tool
failure. Honest abstention is safe but fails C6's availability-answer requirement.
The suite returns every case, its expected outcome, output, evidence checks and trace.
The CLI exit code means the command ran, not that the demo gate passed; read `gate`.

## Your own request

Save this as `request.json`, then run `python assistant.py --request request.json`:

```json
{"intent":"recommend","query":"detective comedy","max_minutes":100,"seen":[]}
```

Expected movie: M004, Clockwork Clue, 88 minutes, source M004:r1:card.
Other request shapes:

```json
{"intent":"runtime","movie_id":"M002"}
```

```json
{"intent":"availability","movie_id":"M001","region":"IN"}
```

Results are JSON on stdout. `python assistant.py > report.json` saves a local report.
Each query token is lowercased; optional aliases map cosmic to space and detective
to mystery. Unique tokens score one point per matching tag. Hard filters remove
overlong and seen films; the remaining positive scores are ranked descending.
Ties retain catalog order (M002 before M001), making the baseline reproducible.
`max_minutes` is inclusive, integer 1..600. Query text is at most 200 characters
and must contain an ASCII letter or digit. This tokenizer is intentionally English
and limited. Unknown request fields are rejected. Unsupported intents with a
movie_id return unsupported_question. Unknown IDs return not_found for supported
fact/tool intents. A missing availability record means unknown, not unavailable.

## Build milestones

1. Explain the request contract and trace C1 manually; run the baseline.
2. Keep constraints on, inspect C4, add aliases and rerun the exact same cases.
3. Reproduce C6's timeout; never fill a missing tool result from memory.
4. Add a movie card, unique source revision, and a manually specified development
   case. Freeze a configuration after inspecting these public cases.
5. Ask another person to author new evaluation cases before showing you labels.
   Keep those separate; all eight bundled cases are development examples.
6. Optional LLM extension: place a generator after retrieval; supply bounded,
   versioned evidence. Validate a schema and cited IDs, then verify every claim
   against its source. Schema validation is not semantic verification. Add human
   review and model-specific failure cases. The workbook does not include this adapter.

## Completion rubric

Deliver the data manifest, runnable source, tests, baseline/candidate reports,
new evaluation results, error analysis and short system card. State task scope,
unsupported requests, source dates, revisions, measured latency/cost if applicable,
and a rollback criterion. Passing the eight public cases is a learning milestone,
not evidence of generalization, prompt-injection resistance or production readiness.

Keep a failure log: request | expected | actual | failing layer | proposed change |
new regression case. Investigate request parsing, retrieval, constraints, evidence,
tools and wording separately. Change one relevant part and rerun old cases.
