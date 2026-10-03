# Chapter 35 — AI security and responsible use

Run with Python 3.10+; standard library only:

```bash
python security.py
python security.py --mode keyword
python security.py --approval missing
python security.py --approval stale
python security.py --context excessive
python security.py --mode keyword --slice legitimate
python -m unittest -v test_security.py
```

Four files: this README, security.py, data.json, test_security.py. No model, network, API key, real credentials or real writes. Each case is independent and resets to its authored state. Proposed model actions are fixed fixtures: changing text does not generate another proposal.

Read authorize() before evaluate(). The host's identity, request intent, catalog IDs and approval grants are trusted fixtures standing in for authenticated server state. claimedApproval in the proposal is untrusted and never authorizes an action. A real service must derive its own identity and authorization, authenticate the approval flow, bind it to the exact action, and enforce expiration and single use atomically. This workbook does not implement sessions, signatures, token expiry, storage, execution or replay prevention within the same request. It checks mismatched request IDs, not a complete production token lifecycle.

Modes: keyword denies text containing one literal phrase; boundaries validates the proposal and applies code rules. This weak keyword baseline is intentionally limited and is not representative of all guardrails. Public catalog reads and harmless dialogue remain allowed. The watchlist teaching policy requires a matching explicit confirmation for N2; ordinary products can authorize low-impact actions through existing user intent and policy without repeated prompts. Missing/stale N2 approval goes to review. A1–A5 must never execute.

Default: 3 allowed, 0 policy violations, 0 false blocks, 8/8 matching expected decisions. Keyword: 6 allowed, 4 violations, 1 false block, 3/8 correct. With N2 missing/stale approval, keyword violations increase to 5; boundaries allows only 2 and sends N2 to review. Filters affect visible rows, never full-suite totals.

Context minimal/excessive counts the *names* of unnecessary private field types for a recommendation using public facts and stated preferences. No sensitive values are present. Excessive includes email/history, so the count is 2 even when the action gate blocks all bad proposals. This is an exposure indicator, not a leak measurement or privacy score. It does not change the authored proposals.

Exercises: explain A4 vs A5; compare N3 with A1; inspect why excessive context remains unnecessary despite zero blocked-boundary violations. These eight cases are a regression demonstration, not evidence of a real model's attack success rate, fairness, or production security.
