# Chapter 32: building AI agents

Extract all four files together. Python 3.9+ and the standard library are enough. The deterministic policies simulate model choices; no LLM, API key, network, or real account is used.

```bash
python agents.py
python agents.py --scenario normal
python agents.py --policy forgetful
python agents.py --policy forgetful --no-loop-guard
python agents.py --policy premature
python agents.py --scenario malicious_note --policy gullible
python agents.py --scenario availability_unknown
python agents.py --max-turns 3
python -m unittest -v test_agents.py
```

`python agents.py --help` lists the seven scenarios and four policies. `--max-turns` accepts 2, 3, 4, 6; `--max-tools` accepts 1 through 4. Every policy call counts as one decision, including clarification, blocked requests, and finish proposals. Only executed tools consume the tool budget.

Default: M001 is unavailable, M003 is available. The adaptive policy searches, checks M001, checks M003, then proposes a final answer: 4 decisions and 3 tool calls. A three-decision budget stops with evidence recorded but no accepted finish proposal. The loop guard stops a forgetful policy at 3 decisions and 2 tools. Without it, the same policy reaches the tool budget at 5 decisions and 4 tools.

The report contains `frames` (one snapshot per decision), `state`, `turns`, `toolCalls`, `status`, and `answer`. The policy sees only observations returned so far; hidden scenario availability is consulted only by the simulated tool. The forgetful policy ignores recorded checks while the runner retains them. This separates context failure from application-side verification.

The search returns all matches in the tiny teaching catalog, in fixed order. The runtime limit is strict: under 100 means minutes < 100. All availability checks use one region and one fixed snapshot. Unknown availability is None/null, not False. No-match messages apply to the returned catalog candidates, not the entire world.

The gullible policy demonstrates a prompt-injection attempt, but the runner exposes only read tools, so it blocks the unsupported watchlist request. This is not a general prompt-injection detector. The finish gate checks objective metadata and recorded availability; it does not measure user enjoyment.

The proposal format is internal teaching data, not a vendor API schema. A live integration needs parsing and full schema validation for arbitrary model output, authenticated tool adapters, real result validation, timeouts, durable state if needed, permission checks, context management, observability, and evals with actual models. Loop detection against a static fixture is not a universal retry policy for changing environments. For write tools, retain the idempotency and receipt protections from Chapter 31.

Try adding a transient tool failure with a bounded retry policy, a candidate excluded by an explicit user preference, or a clarification-resume flow. Test each change against the allowed scope and final evidence requirements.
