# Chapter 26: memory and quantization

Use Python 3.10+ and the standard library. Keep `data.json`, `efficiency.py`, `test_efficiency.py`, and this README together.

```sh
py efficiency.py
py efficiency.py --weight-bits 4 --batch 4 --tokens 8192
py efficiency.py --kv-heads 32 --budget 16
py efficiency.py --preset outlier --quant-bits 4 --grouping pairs
py -m unittest -v test_efficiency.py
```

Use `python` or `python3` if needed. Each calculation prints JSON with `memory` and `compression` reports. Invalid CLI options exit with code 2. No files are written, no network is contacted, and no model or GPU benchmark is run.

## Memory calculation

The hypothetical model has 7,000,000,000 parameters, 32 layers, 32 query heads, and head dimension 128. KV-head choices are architecture comparisons, not a runtime conversion of one checkpoint. Parameter count stays fixed to isolate cache changes; an actual architecture change may also change parameter count.

Ideal weight bytes = parameters * weight bits / 8.
Cache bytes = 2 * sequences * cached tokens per sequence * layers * KV heads * head dimension * cache bits / 8.
The factor 2 counts keys and values. All sequences have the same planned retained length, including prompt and output. There is one shared model copy, no prefix sharing, no beam expansion, no offloading, and no sliding-window eviction.

1 GiB = 2^30 bytes. A fixed **illustrative** 2 GiB reserve is added for other runtime allocations. It is not measured or guaranteed sufficient. Packed weight/cache payloads omit scales, zero points, alignment, and other metadata; real formats may leave some tensors at higher precision. Memory below the selected budget means only **within this estimate**, not a promise of fit, speed, or answer quality. The calculated maximum sequence count uses the same assumptions and floors the remaining capacity; it is not a recommended concurrency setting.

Defaults: 16-bit weights, 8 KV heads, 16-bit cache, one sequence of 4096 tokens, 16 GiB budget. Weights = 13.038516 GiB, cache = 0.5 GiB, reserve = 2 GiB, total = 15.538516 GiB. With 32 KV heads the cache is 2 GiB and total exceeds the budget.

## Quantization calculation

The six weights and six features are hand-set numbers for an illustrative movie matching score, not a trained recommender or a vocabulary head. Preset `outlier` changes the final weight from 1 to 6. Score = dot(features, weights), without bias, nonlinearity, or probability interpretation.

We use symmetric integer codes with `Q = 2^(bits-1)-1`. A group scale is `max(abs(weights))/Q`; all-zero groups use scale 1. Divide by scale, round half away from zero, clamp to [-Q,Q], then multiply by scale to reconstruct. The most negative signed code is unused: 4-bit codes range from -7 through 7. Grouping is one tensor-wide scale or one scale per adjacent pair. Calculations retain host floating-point precision, not rounded float32 scales.

Storage counts describe a **hypothetical packed layout**, not the size of Python objects or the JSON report: ceil(number of weights * bits / 8) payload bytes plus four bytes per scale, without alignment or headers. The reference is six float32 weights (24 bytes). At 4 bits, one scale uses 3+4=7 bytes; three pair scales use 3+12=15 bytes. The larger memory planner intentionally does not estimate this metadata from the six-weight example.

Default codes: [-7,-3,-1,1,3,7]. Original score 0.882 becomes 0.9142857143. Mean absolute weight error is 0.0230952381. With the outlier, pair grouping reduces mean weight error but increases this particular score's absolute error. Weight reconstruction error is not a task-quality metric.

## Practice

1. Double context length; verify that cache memory doubles while weights stay fixed.
2. Reduce weight bits without changing cache bits; identify which memory term changes.
3. Compare 32, 8, and 1 KV heads without claiming the underlying models have equal quality.
4. Compare quantization groups, payload, metadata, weight error, and output-score error. Explain why none establishes a real LLM speedup or preserved recommendation quality.
