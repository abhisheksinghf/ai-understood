# Chapter 36 — Deploying and operating AI applications

Requires Python 3.10+ and the standard library only. Four files: operations.py, data.json, test_operations.py, README.md.

```bash
python operations.py
python operations.py --rollback observe
python operations.py --share 100
python operations.py --scenario provider_fault --rollback observe --retries 0
python operations.py --scenario provider_fault --rollback observe --retries 1
python operations.py --scenario provider_fault --rollback observe --deadline 1200
python -m unittest -v test_operations.py
```

No model, server, cloud account, deployment, network, sleep, real billing or watchlist write is involved. This is a deterministic release-controller simulation, not production performance evidence. Each run resets all state.

Twenty request fixtures form four windows of five. share=20 sends slot 1 to candidate; 60 sends slots 1–3; 100 sends all. This fixed slot assignment is for repeatability, not representative sampling. Automatic rollback is checked at each window end; any bad candidate result moves all *subsequent* windows to baseline. Earlier effects cannot be undone. Observe-only reports failures but changes no routing. Healthy runs report observe_more, never production approval.

healthy: every attempt succeeds. bad_release: candidate returns HTTP 200 but an incorrect recommendation at slots 1 and 3. provider_fault: both versions get 503 on the first slot-1 attempt and on all slot-3 attempts. Only a 503 can trigger one optional retry. A fixed 200 ms backoff is included; production retries generally need bounded jitter and error-specific handling. The lab does not simulate jitter, queuing, circuit breakers, cache, fallbacks or concurrent traffic.

The deadline covers all attempts and backoff. A response exactly on the deadline counts as on time. A longer attempt is cut at the deadline with local status 504. All attempted calls incur the full fictional attempt cost, even if timed out; these units are accounting assumptions, not provider pricing. A caller timeout does not imply a real provider stopped processing or charging.

Baseline success takes 1200 ms and costs 3 units; candidate success takes 900 ms and costs 2. A fault takes 400 ms and costs 1. A good request requires status 200, correct fixture quality and completion by deadline. p95 uses nearest rank over all 20 final elapsed times, including failures. Quality is an authored label immediately visible to the controller, unlike delayed/sampled production judgments.

Default: bad release, 20% share, one retry, 2400 ms deadline, automatic rollback. Result: 19/20 good, 20/20 HTTP 200, 1 candidate request, 59 cost units; rollback after window 1. Observe-only: 16/20 good, 4 candidate requests, 56 units. At 100% with automatic rollback: 18/20 good, 5 candidate requests. The 95% teaching SLO allows one bad request out of 20; this coarse window is not a realistic monthly objective. Error-budget policy and rollout stop conditions are separate: a rollout can stop while the window's SLO is met.

Provider-fault scenario, observe-only, 20% share, 2400 ms deadline: without retry 12/20 good and 20 attempts; one retry gives 16/20 good and 28 attempts. With 1200 ms, transient retries miss the deadline and good returns to 12/20. Rollback cannot fix a dependency used by both versions. Inspect version-specific failures and use a runbook.
