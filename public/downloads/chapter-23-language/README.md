# Chapter 23: text, tokens, and next-token probabilities

Python 3.10+ and its standard library are enough. Extract all four files together. No package installation, API key, model download, or network call is required. Use `python` or `python3` instead of `py` when appropriate.

```sh
py language.py tokenize --text "this movie is fun." --merges 16
py language.py tokenize --text " Movie night!" --merges 24
py language.py model --method greedy
py language.py model --method sample --temperature 0.5 --top-k 3
py language.py model --alpha 0 --score-case unknown
py -m unittest -v test_language.py
```

Commands print JSON, do not save files, and do not train a neural model. Output escapes non-ASCII characters for Windows-console portability; a JSON reader reconstructs the original Unicode. Invalid CLI choices or text return code 2. Input text is limited to 200 Unicode code points and must not contain isolated surrogates.

## Two deliberately separate token systems

The `tokenize` command fits byte-pair encoding (BPE). The `model` command fits a bigram using lowercase ASCII words and separate punctuation. The bigram does **not** consume the BPE token IDs. They use the same six authored sentences only to keep the teaching examples connected. One duplicate sentence intentionally changes frequencies. There is no held-out evaluation set.

## Byte-pair encoding

The initial vocabulary contains every byte value 0-255; its ID equals the byte value. Raw UTF-8 bytes preserve case, spaces, punctuation, and Unicode. There is no Unicode normalization, word pre-tokenization, or special-token insertion. Pairs may merge across spaces but never across corpus-sentence boundaries.

At each training step, count all adjacent pairs, including overlapping occurrences. Choose the largest count, with ties resolved by smaller left ID then smaller right ID. Replace matching pairs left to right, without overlap, with the next ID starting at 256. Stop at the merge budget or when no pair occurs twice. `--merges` accepts 0-24. Encoding new text applies the fixed learned merge list in rank order; it does not fit on that new text.

The first merge joins byte 115 (`s`) and byte 32 (space), count 10, into ID 256. The default text at budget 16 has IDs `[270, 102, 268, 46]`, four pieces representing `this movie is `, `f`, `un`, and `.`. It has 18 code points and 18 UTF-8 bytes before merging. Vocabulary size is 272: 256 base bytes plus 16 merges.

The report includes token byte arrays, so the round trip can be verified independently. `piece` is a display label: `␠` is space, `↵` is newline, `⇥` is tab, and `␍` is carriage return. A byte fragment that is not standalone UTF-8 is shown as hexadecimal. Concatenate all byte arrays before decoding; do not concatenate display labels to reconstruct text. Empty input is valid and gives no tokens. Byte fallback covers valid input but does not establish linguistic understanding or efficient segmentation for every language.

## The count-based language model

The model lowercases text, groups `[a-z]+` into words, and treats each remaining non-whitespace code point as a token. This intentionally simple English-oriented tokenizer removes whitespace distinctions and is not lossless. Unknown tokens map to `<unk>`.

The ordered target vocabulary is `<eos>`, `<unk>`, followed by sorted training tokens. Its size is 13. `<bos>` supplies the first context; it is not a prediction target. Each corpus sentence ends with `<eos>`. No transition crosses sentence boundaries, and no outgoing EOS counts are learned.

For context h and target w, the estimate is `(C(h,w)+alpha)/(C(h)+alpha*13)`. `--alpha 0` uses unsmoothed counts; `--alpha 1` adds one to every target. If alpha is 0 and a context has no observations, its returned row is all zeros and generation stops with `No observed continuation`; the code does not call that row a normalized distribution. For alpha 1, an unseen context is uniform.

After `is`, counts are `fun: 2`, `slow: 1`, `warm: 1`. With alpha 0 their probabilities are 0.5, 0.25, 0.25. With alpha 1, they are 3/17, 2/17, 2/17; every other target gets 1/17. Both `this movie is` and `this film is` use exactly the same context `is`.

## Decoding

`--temperature 0.5|1|2` applies `q proportional to p ** (1/T)`. Computation uses log probabilities and subtracts the largest log score for stability. `--top-k 0|3` keeps all candidates or the best three positive-probability candidates, then renormalizes. Ties use lower vocabulary ID. Zero probabilities stay zero. The report's adjusted probabilities are sampling probabilities; greedy selection itself chooses only the maximum.

`--method greedy|sample` chooses an argmax or a seeded draw. Every run starts with seed 42 and stops after EOS or 10 new tokens, counting EOS in that limit. Sampling uses the 32-bit recurrence `(1664525*state + 1013904223) mod 2**32`, then divides by `2**32`. Candidates are traversed in vocabulary order. Seeds make this implementation reproducible, not universally identical to other libraries' samplers.

The default CLI method is sample; the website initially shows greedy. At alpha 1, temperature 1, no top-k filter, greedy completes `this movie is fun.`; the seeded sample produces `this movie is feels <unk> is a film`. This awkward output is a real result of the tiny count model. It illustrates the model's limits; it is not an authored LLM response.

## Scoring

`--score-case familiar|recombined|unknown` selects a fixed visible sentence. Scoring starts from BOS, uses each observed previous token, includes EOS as a target, and uses **base** probabilities. It is independent of decoding temperature, top-k, or method.

The familiar sentence has six scored targets. With alpha 0 its probability product is 1/8, mean negative natural-log probability is 0.34657359 nats, and perplexity is sqrt(2), approximately 1.414214. With alpha 1 the mean is 1.43932423 and perplexity is 4.217845. Neither result is a generalization benchmark.

The unknown case maps `dazzling` to `<unk>`. With alpha 0 it has two zero-probability transitions: loss and perplexity are mathematically infinite. JSON uses `null` for infinite NLL/aggregate metrics and explicitly reports `zero_probabilities`; null does not mean zero loss. With smoothing the score is finite but refers to the mapped sequence, not an assigned probability of the exact unseen spelling.

## Inspect and extend

Read `train_bpe` and `tokenize`, then `fit_bigram`, `distribution`, `generate`, and `score`. Tests verify hand-counted merges, Unicode round trips, boundary counts, normalization, temperature/top-k behavior, seeded sampling, stopping rules, and scoring. JavaScript/Python comparisons allow tiny floating-point differences. For real evaluation, freeze the tokenizer and model before testing on independent, appropriately separated text.
