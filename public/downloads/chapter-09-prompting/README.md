# Chapter 9: prompting and context design

Python 3.10 or newer. No packages, API key, network access, or model calls. The script prints results and writes no files.

```powershell
py prompt_lab.py --case incomplete --version grounded
py prompt_lab.py --demo
```

Replace `py` with your working `python` or `python3` command. Available cases: `incomplete`, `confirmed`, `conflict`, `embedded`. Available versions: `vague`, `contract`, `grounded`. Notes and reference responses are authored; learner profiles, study estimates, and exam dates are teaching examples.

The first command prints the assembled prompt, then a separately labelled human-written reference. The reference is never inserted into the assembled prompt. The same case keeps the same reference across all three versions. No model performance has been measured.

The demo prints:

```text
Reference: PASS (structure only)
Wrong type: FAIL (structure only)
Unsupported claim: PASS (structure only)
The 2026-12-01 claim is unsupported, even though its structure passes.
```

To check a recommendation you saved as `candidate.json`:

```powershell
py prompt_lab.py --case incomplete --check candidate.json
```

The file must contain exactly `recommendation`, `exam_date`, `evidence_ids`, and `open_questions`. The script checks types, nonempty text where applicable, distinct supplied IDs, and required fields. A successful check returns exit code 0; structural failure returns 1; unreadable or invalid JSON returns 2.

This is a deliberately small validator, not a complete JSON Schema implementation. It does not verify truth, source support, citation coverage, prompt-injection resistance, or recommendation usefulness. Ordinary JSON parsing may accept duplicate keys using the last value; a production parser may need stricter handling. Keep any real model evaluation separate from this local exercise.

Practice:

1. Compare the three prompt versions while keeping the source case fixed. Identify the behavior each added instruction is intended to change.
2. Change an evidence ID in a candidate to S99. The structure checker should reject the unknown ID. Restore a valid ID and invent an exam date: it can pass structure while failing evidence review.
3. Read the conflict and embedded-instruction cases. Explain the expected behavior before revealing their references. Text boundaries are organizational aids, not security guarantees.

The browser workshop and Python workbook use the same `cases.json`; the build checks also compare all 12 assembled prompts across the two implementations.
