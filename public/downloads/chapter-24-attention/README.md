# Chapter 24: attention arithmetic

Requires Python 3.10+ and only the standard library. Extract all four files into one folder. Run:

```sh
py attention.py
py attention.py --ending slow --mask causal
py attention.py --positions sinusoidal --mask bidirectional
py -m unittest -v test_attention.py
```

Use `python` or `python3` if `py` is unavailable. Reports go to stdout as JSON; no model, file, or network service is created. Invalid CLI choices exit with code 2. Defaults match the web explorer: ending `fun`, no position vectors, causal masking. The report includes every row of both heads, so the web selection of a head, query, or source does not alter the calculation.

## The exact teaching contract

- Four word tokens: `this movie is fun`, with an option to replace the last token by `slow`. These are deliberately simplified units, not a production tokenizer.
- Token embeddings, both sets of Q/K/V projections, and the output projection are **hand-set** in `data.json`. Coordinates have no asserted linguistic interpretation; no training has occurred.
- Row-vector convention: X is 4 by 4; each Wq, Wk, Wv is 4 by 2. Q, K, V are 4 by 2. Each score and weight matrix is 4 by 4.
- Optional absolute sinusoidal positions use zero-based position p, width d=4: PE[p,2i]=sin(p/10000^(2i/d)), PE[p,2i+1]=cos(p/10000^(2i/d)). X = embedding + PE. No embedding scaling is applied in this teaching model.
- Raw scores are Q K^T. Divide by sqrt(2), mask future keys j>i when causal, and apply a stable row-wise softmax over allowed keys. Self-attention to j=i stays allowed. Every row has at least one allowed key.
- `null` in `masked` means a blocked score, mathematically negative infinity. Blocked weights are exactly zero. No dropout, padding, bias terms, learned scale, or temperature is used.
- Outputs = weights V. Concatenate the two 2D outputs into 4D, multiply by Wo, then add the input X as a residual. This illustrates the attention sublayer; it omits normalization, the feed-forward network, extra blocks, and the vocabulary prediction head. It is **not a complete trained transformer**.
- Floating-point reports use full precision; the website rounds numbers. Compare with a numerical tolerance rather than exact decimal equality.

## Things to investigate

1. At the third token `is`, Head 1 with no positional vectors and a causal mask has weights about [0.2483, 0.2483, 0.5035, 0]. Reconstruct the weighted value sum.
2. Change `fun` to `slow`. All earlier rows remain unchanged with a causal mask, but can change with bidirectional attention. The diagonal must stay allowed: an input token is used to predict the **next** token.
3. Head 2's query at `is` is [0,0] without positions, so it gives equal weight to the three allowed keys. This is a consequence of the hand-set matrices, not a learned head specialization.
4. The tests check that unmasked attention without positions is permutation equivariant: reordering inputs reorders outputs. Positional encoding and a causal visibility pattern add order information in different ways.

Inspect `data.json` for all values and `attention.py` for the arithmetic. No output is a movie recommendation, next-word probability, benchmark, or explanation of a trained model's reasoning.
