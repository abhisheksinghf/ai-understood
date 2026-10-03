# Chapter 28: fine-tuning and preference learning

Python 3.10+, standard library only. Extract all four files together.
These are two independent numerical experiments, not an LLM training recipe.
No credentials, downloaded checkpoints, network calls, or GPU are needed.

```bash
py tuning.py
py tuning.py --rank 2 --alpha 4 --stage initial
py tuning.py --steps 1 --chosen A
py tuning.py --steps 40 --chosen B --beta 1
py -m unittest -v test_tuning.py
```

Use `python` or `python3` if needed. `--help` lists supported choices.
Invalid values exit with code 2. Reports retain full numeric precision.

## LoRA arithmetic

W0 is the 4x4 identity. A has shape rank x 4; B has shape 4 x rank.
The update is delta = (alpha/rank) BA. Output = W0 x + delta x.
The 16 base parameters are frozen; the adapter has 8 x rank parameters.
Rank 2 gives no trainable-count saving over this tiny base matrix.

The initial state has nonzero A and zero B, so its output equals the base.
The adapted state uses hand-set matrices, not learned results. The numeric
coordinates are not movie scores. No bias or dropout is modeled.

## Two-response preference optimization

The output space contains exactly the two complete replies in data.json.
A is grounded; B contains unsupported claims. A scalar theta gives
P(A)=sigmoid(theta), P(B)=1-P(A). Initialize theta to the reference log-odds.
For preferred A, sign=+1; for preferred B, sign=-1.

margin = sign * (theta - reference_theta)
z = beta * margin
loss = -log(sigmoid(z))
gradient = -beta * sign * sigmoid(-z)
theta_new = theta - learning_rate * gradient

The stable implementation uses softplus for the loss. The reference stays
fixed for the entire trajectory. The report includes each step, both reply
probabilities, pair-fit probability sigmoid(z), and KL(policy || reference).
Pair-fit is not factual accuracy or P(A). All supported runs use at most
40 steps with the documented bounded settings.

Start at reference=0.5, beta=0.5, rate=0.5. Step zero has loss log(2).
One step preferring A yields theta=0.125 and P(A)=0.5312093734.
Preferring B instead lowers P(A) while still lowering the training loss.

## Interpret carefully

This really optimizes a scalar, but it does not generate text, train adapters,
or generalize across prompts. A real LLM computes complete-response
log-probabilities by summing token log-probabilities. The two responses do not
exhaust its output space. Our complementary probabilities are a toy assumption.
Beta affects both the objective's interpretation and finite-step gradients;
this single repeated pair cannot establish a useful production setting.

Try changing a label and explaining the resulting curve before checking it.
Tests verify hand calculations, a finite-difference gradient, normalization,
all supported full trajectories, merging equivalence, and malformed inputs.
