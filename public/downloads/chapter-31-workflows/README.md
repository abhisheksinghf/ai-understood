# Chapter 31: tool calling and explicit workflows

Python 3.9+; standard library only. Extract the four files together and run commands from this directory. No model, credentials, network, database, or real account is used. All movies and tool proposals are fictional.

```bash
python workflows.py --scenario happy
python workflows.py --scenario lost_receipt
python workflows.py --scenario lost_receipt --no-deduplicate
python workflows.py --scenario lost_receipt --retries 0
python workflows.py --scenario lost_receipt --budget 2
python workflows.py --deny-write
python workflows.py --no-authorization
python -m unittest -v test_workflows.py
```

Use `python workflows.py --help` for all ten scenarios. Retries: 0, 1 or 2 per tool. Budget: 1 through 4 total handler executions including retries. Validation rejections do not consume this budget. Backoff and timeouts are simulated, with no real sleeping. Every run starts an empty store.

The report shows the configuration, caller status and answer, attempts, backendRows, and a trace. `backendRows` is an omniscient teaching view, not information available to the caller after a lost response. A lost receipt with one retry produces 3 attempts, 1 row with deduplication, and 2 rows without it. With no retry, the caller reports needs_reconciliation despite the hidden committed row.

The account is attached by application code. The authorization flag stands for consent for the intended movie, not for arbitrary targets. The changed_movie scenario proves that M001 authorization cannot cover M002. The operation key is constant only within a fresh isolated run; real business operations need correctly scoped unique keys.

`WatchlistStore` demonstrates matching receipt replay, parameter conflicts, and account scoping. It has no durability or concurrent-worker protection. The no-deduplicate option deliberately reproduces an unsafe append retry. Real systems need atomic persistent deduplication (or a provider contract), authorization at execution, full input/output validation, timeouts, cancellation, durable checkpoints, and privacy-aware tracing. The simulated bad_result case checks a mismatched movie ID; it is not a general output-schema validator.

Suggested exploration: add a permanent service-error scenario that must not retry; add an idempotency conflict scenario; add a separate receipt-status lookup to reconcile an ambiguous save. Test that success messages are supported by verified tool results.
