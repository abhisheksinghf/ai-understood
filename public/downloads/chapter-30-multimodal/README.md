# Chapter 30: Multimodal AI

Requires Python 3.10+. Uses only the standard library; no account, model download, or external service. Extract the four files into one folder, open a terminal there, and run:

```sh
python multimodal.py
python multimodal.py --query space --candidates moon
python multimodal.py --space mismatched --temperature 0.1
python multimodal.py --interval 4 --phase 0.25 --resolution 448 --no-align-audio
python -m unittest -v test_multimodal.py
```

The JSON output contains independent `matching` and `video` reports. Save a report with `python multimodal.py > report.json`.

## Matching experiment

Three hand-set text vectors and three hand-set poster vectors stand in for learned encoders. The vectors have no assigned human-readable coordinate meanings. The fictional posters are Moonlight Map, Neon Chase, and Orbit Home. This workbook does not load images or train an encoder.

Cosine similarity compares directions after normalizing both vectors. In the mismatched setting, only image coordinates are permuted from [x,y,z] to [z,x,y]; text coordinates stay unchanged. This preserves dimensions and norms but breaks the intended alignment. Permuting both streams identically would preserve dot products.

The reported softmax `share` uses score/temperature and is normalized across the selected candidates. It is not a calibrated correctness probability. Lower temperature sharpens shares without changing fixed-vector ranking. A single candidate receives a share of one even for an unrelated query. Candidate-set changes affect the shares but not any pair's cosine score.

## Video experiment

The complete 20-second timeline is an invented annotation, not a real video. A lantern is visible during [5,6) seconds: start included, end excluded. Frame times are `phase*interval + k*interval`, restricted to times below 20 seconds. Annotations are assumed perfect to isolate sampling; real models can make recognition errors too.

At interval 4 and phase 0, frames at 0,4,8,12,16 miss the lantern. Phase 0.25 gives 1,5,9,13,17 and sees it at 5. Both use five frames. Missing an event in selected frames does not prove its absence from the whole video.

The patch counter assumes square 224 or 448 pixel frames and non-overlapping 16 pixel patches, no special tokens or pooling. It is not a provider's token or billing formula and does not measure total compute. A 224-square frame has 196 patches; five have 980. Doubling both dimensions gives 784 per frame and 3,920 total without changing temporal coverage.

An audio clip begins at source time 4 seconds. The transcript line has clip-local times 0.8 to 2.2 seconds. Correct mapping adds 4 to both, giving 4.8 to 6.2. Omitting the offset deliberately produces a wrong source citation. Neither the offset switch nor resolution changes the visual annotations. Words mentioning a lantern do not establish that it appears in the image.

## Practice

1. Compare the space query with all candidates and with Moonlight Map alone. Explain the share change.
2. Change sampling phase while holding the number of inspected frames fixed. Explain coverage versus resolution.
3. Compare audio overlap times with and without the offset. Keep a common source clock in a real pipeline.

The tests verify geometry, normalization, candidate effects, time boundaries, known budgets, source offsets, and invalid settings. Browser and Python calculations agree within ordinary floating-point tolerance.

## Primary reading

- CLIP: https://arxiv.org/abs/2103.00020
- Vision Transformer: https://arxiv.org/abs/2010.11929
- Visual instruction tuning: https://arxiv.org/abs/2304.08485
- LayoutLMv3: https://arxiv.org/abs/2204.08387
- Whisper: https://arxiv.org/abs/2212.04356
- TimeSformer: https://arxiv.org/abs/2102.05095
