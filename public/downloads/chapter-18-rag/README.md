# Chapter 18: an inspectable RAG pipeline

Use Python 3.10+. Extract all four files into one folder. Run `py rag.py` (or `python rag.py` / `python3 rag.py`). No third-party Python dependencies. Default behavior is offline and reads only the supplied fictional sources; it writes no files.

## Follow the data

1. `chunk_sources`: whole movie cards or separate plot/runtime passages; carry title, revision, movie ID, and runtime metadata.
2. `retrieve`: BM25 over titles and passage text, k1=1.2, b=0.75, unique query terms, positive scores, optional known-runtime filter, deterministic ID tie-breaking. Collection statistics use all indexed chunks. These are preset query rewrites, not a learned interpreter.
3. `pack`: scan ranked candidates, keep complete source blocks that fit, skip others. Includes source wrappers in the whitespace-word budget. This is NOT an LLM token budget. Instructions, question, output reserve, and model tokenization need separate accounting for a real deployment.
4. `make_candidate`: offline formatter selects one full sentence for a preset fact type from the packed evidence. It is not an LLM or a semantic relevance checker. Streaming facts are absent, so that preset abstains.
5. `check_candidate`: exact schema, request-context source membership, and quote substring checks. Rejects the whole candidate if any item fails. A true quote about the wrong movie can pass! These checks do not establish relevance, completeness, source truth, or protection against malicious content.

```sh
py rag.py --chunking section --k 1
py rag.py --chunking section --k 3 --budget 20
py rag.py --query runtime --chunking section --k 1
py rag.py --query streaming
py rag.py --query space --limit under120
py rag.py --fault bad_id
py rag.py --fault bad_quote
py -m unittest -v test_rag.py
```

Default: Quiet Orbit and Winter Road whole cards use 21+22=43 evidence units. Sections with K=1 retrieve Quiet Orbit's runtime only, so a plot question abstains. K=3 and budget 50 fit runtime (11), plot (18), and Winter Road plot (19), total 48. Budget 20 includes only runtime. A citation references e.g. `M004:r1:plot`; revision changes produce different IDs.

CLI output is a JSON trace including chunks, ranked candidates, omissions, prompt, candidate, and validation. Status `evidence_ready` means traceability checks passed, not that the task is solved. `insufficient_evidence` is an evidence gap; `blocked` is failed candidate validation. Successful trace execution returns exit 0 for any of these outcomes. Invalid inputs return 2. `--input` reads an alternate snapshot; keep the schema and update revisions for changed source content.

## Optional real generation with an installed local model

The workbook does not install software or download models. If Ollama is already serving a suitable installed LOCAL model, use its exact name:

```sh
py rag.py --query runtime --ollama-model YOUR_INSTALLED_LOCAL_MODEL
```

This opts into one request to `http://127.0.0.1:11434/api/chat`. Use a local model, not a cloud-backed model name. The selected fictional source passages and question go to that server. The adapter uses nonstreaming messages, temperature 0, and a JSON schema with `status` and at most three `{source_id, quote}` items. The model generates structured, extractive evidence, not unrestricted prose. It still needs semantic evaluation: schema and quote checks cannot decide whether selected evidence answers the question.

No context means no model call. The client has a 60-second timeout, a 1 MB response cap, no proxy, no redirects, and no retries. Transport, JSON, or incomplete-response failures return `generation_error` and exit 3; no offline answer is silently substituted. Fault fixtures and model calls cannot be selected together. The test suite uses mocked transport, not a running language model. Live model quality is unmeasured.

Inspect the payload in `ollama_payload`, the call in `generate_local`, and the candidate validation afterward. This separates source preparation and search from generation. For free-form synthesis, extend the contract to claim-level citations and add semantic support and completeness evaluation; exact quote matching is not enough.

Official references: [Ollama chat](https://docs.ollama.com/api/chat), [structured outputs](https://docs.ollama.com/capabilities/structured-outputs).
