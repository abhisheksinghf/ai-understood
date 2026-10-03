# Chapter 25: training and frozen generation

Python 3.10+ and the standard library are sufficient. Keep these four files together: `data.json`, `lifecycle.py`, `test_lifecycle.py`, and this README.

```sh
py lifecycle.py
py lifecycle.py --mask all --steps 80
py lifecycle.py --checkpoint pretrained --prompt prose
py lifecycle.py --steps 20 --method sample --temperature 1.5 --limit 8
py -m unittest -v test_lifecycle.py
```

Use `python` or `python3` if needed. Commands print JSON containing the training traces, three parameter checkpoints, and a generation trace. They do not write files or contact a network. Invalid CLI choices exit with code 2.

## Exact model and data contract

This is a **trigram softmax table trained with gradients**, not a neural transformer or an LLM. Each pair of preceding tokens has an independent trainable vector of 15 logits. No embeddings, attention, long-range context, or preference training are implemented. Movie titles and examples are fictional. The fixed vocabulary and context keys are defined from all visible teaching data; there is no held-out set.

- Input units are whitespace-separated words and literal markers. `<bos>` supplies two initial context positions, never a target. `<eos>` is appended as a target. The 15 target IDs follow `data.json` order. There is no unknown-token input mode.
- Pretraining uses six authored prose sequences, including repeated examples, for 30 next-token targets. It runs 80 full-batch gradient steps from zero logits with learning rate 3.
- Adaptation continues from a copy of that checkpoint for 0, 20, or 80 steps. Four conversation demonstrations each contain `<user> genre <assistant> title words . <eos>`.
- Reply-only loss scores the three reply tokens plus `<eos>`: 16 total targets. All-token loss scores all seven targets per example: 28 total. In both cases, the whole observed prefix is used as context. This is a loss mask, not an attention mask.
- Each step computes mean cross-entropy over selected targets. For a context logit, the gradient accumulates `(p_j - 1[j=target])/N` over selected occurrences, then all parameters are updated together. The learning rate is a toy-model setting, not a suggested LLM learning rate.
- The two evaluation columns always score the same 30 prose or 16 reply targets, using base probabilities. They describe training examples only. Do not compare means computed over different masks as if they measured the same task.
- Reply-only training leaves the prose score unchanged here because its scored context pairs are disjoint from prose contexts and table rows share no parameters. This is not a promise that reply-only tuning prevents forgetting in neural LLMs. All-token tuning modifies the shared beginning context and worsens the prose score in this fixture.
- A saved checkpoint is an in-memory parameter snapshot in this exercise. A production training-resume checkpoint may also need optimizer, schedule, random-state and data-position information.

## Frozen generation contract

The selected checkpoint is read without mutation. Prompts are the three presets in `data.json`. The model uses only the last two tokens; every unknown generated context falls back to uniform zero logits. Stored but untrained contexts are uniform too.

Softmax is computed after dividing logits by temperature (0.75, 1, or 1.5). Greedy ties use the lowest vocabulary ID. Sampling uses seed 42 and the LCG update `(1664525*state+1013904223) mod 2^32`, scanning candidates in vocabulary order. Reproducibility is for this implementation, not a guarantee across commercial model services.

The output limit counts all newly selected tokens, including `<eos>`. A selected end token takes precedence over a simultaneous length limit. There are no additional output filters, top-k/top-p rules, tool calls, or KV cache. `text` removes `<eos>` and the space before a period; `tokens` and `trace` preserve the actual computation. Each trace row includes the base and temperature-adjusted distributions.

## Experiments

1. Reply-only adaptation lowers mean reply loss from 2.7081 to about 0.0364 after 80 steps. The first reply target `Moonlight` rises from probability 1/15 to about 0.9642. These are training results, not generalization evidence.
2. Compare the loss masks and the fixed prose/reply evaluation columns. Explain why 16 versus 28 scored targets also changes the per-target gradient scale under this mean-loss objective.
3. Generate from the pretrained checkpoint using the prose prompt, then the chat prompt. Compare with the adapted checkpoint. Correct output on these known sequences does not demonstrate general instruction following.
4. Change temperature, seed-independent greedy decoding, or the token limit. Verify that generation leaves every checkpoint value unchanged.
