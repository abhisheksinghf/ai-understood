# Chapter 33: connections and coordination

Extract all four files into one folder. Python 3.9+; standard library only.

```bash
python coordination.py
python coordination.py --pattern handoff --schedule sequential
python coordination.py --scenario wrong_region
python coordination.py --scenario wrong_region --no-validation
python coordination.py --scenario missing
python coordination.py --budget 2
python coordination.py --protocol
python -m unittest -v test_coordination.py
```

Default: Harbor Lights (M003), 6 elapsed units, 8 total work units, 3 specialist jobs. Sequential execution takes 8 elapsed units. Handoff changes reply ownership; handoff overhead is not modeled.

This is an in-memory teaching simulator. Worker functions use fixed fictional data and do not call models. Timelines are calculated, not actual concurrent execution. The separate seven-message MCP transcript illustrates revision 2025-11-25; it is not a server, client, transport, or conformance test. No account, network access, or API key is used.

The example requires catalog, availability, and taste reports before finalizing. The job budget counts workers, not model tokens or protocol messages. A shared fixture snapshot stands in for a production freshness policy; timestamps and source-specific versions usually need richer treatment. `verify_availability` demonstrates checks for external evidence. Taste and catalog data are trusted local fixtures in this exercise, not arbitrary validated model outputs. A live application must validate all report schemas and preserve scoped permissions.

`unsupported` is the teaching evaluator's label when bypassing checks produces an ungrounded answer. The coordinator without checks would not know that from the suggestion alone. To extend the exercise, add a wrong movie ID, an expired timestamp, or a missing ranking and write an expected outcome before changing the runner.
