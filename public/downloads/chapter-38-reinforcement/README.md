# Chapter 38: learn a movie recommendation policy

Python 3.10+, standard library only. Extract all four files to one folder, open a terminal there, and run:

```sh
python reinforcement.py
python reinforcement.py --epsilon 0
python reinforcement.py --gamma 0
python reinforcement.py --objective clicks
python reinforcement.py --episodes 60
python -m unittest -v test_reinforcement.py
```

The default uses satisfaction rewards, epsilon 0.3, gamma 0.9, alpha 0.5, 200 episodes, and seed 7. Its frozen greedy policy asks a preference question and then recommends the matched movie. Raw return is -1 + 6 = 5; discounted return is -1 + 0.9*6 = 4.4; mean training return is 3.175. Training includes exploration and earlier, weaker policies. The evaluation uses the same deterministic toy environment, so it is not a generalization test.

With epsilon 0, the zero-initialized, tie-broken policy always recommends the familiar movie and never discovers the matched route. With gamma 0, familiar is optimal for immediate reward. With the clicks proxy, familiar scores 4 under that objective but only 2 on the separately reported satisfaction scale. With just 60 default episodes, the matched action has zero visits. Seed 19 gives a different exploration history; a tiny run is not evidence of convergence.

`data.json` defines two nonterminal states and one terminal state. Each episode naturally ends in at most two actions. Start actions are familiar (terminal) or ask (known preference). Known-preference actions are generic or matched (both terminal). Satisfaction rewards are 2, -1, 1, 6 respectively; click-proxy rewards are 4, -1, 3, 1. These are authored teaching scores, not measured clicks or actual movie ratings. Every viewer follows this same deterministic model; real preferences vary and may change over time.

`reinforcement.py` implements tabular Q-learning. Q starts at zero on every run. Epsilon-greedy exploration chooses uniformly among valid actions; that random choice can coincide with the greedy one. Exact ties follow data order (familiar before ask; generic before matched). Randomness uses a seeded 32-bit linear congruential generator for browser/Python reproducibility. There is no randomness in transitions or rewards. Alpha and epsilon stay fixed; do not infer stochastic convergence guarantees from this implementation.

Only observed transitions enter Q updates. Terminal targets contain reward only; no future value is bootstrapped. The full data is visible for teaching and runs the environment, but the learner does not plan with it. An analytic optimal-value comparison is computed separately after training and is never fed to the learner. Evaluation freezes Q and turns exploration off. Reports round to six decimals; training and action selection use full precision. The first twelve TD updates, per-episode history, action visit counts, and 20-episode mean-return curve are included in JSON.

Try predicting each change before running it. Inspect unvisited actions before interpreting a low Q value. Compare training return, greedy discounted return, and satisfaction separately. This is neither an RL library nor a robot controller; physical robots need state estimation, dynamics-aware control, safety constraints, and staged testing. The tests verify manual TD calculations, terminal behavior, deterministic seeds, all configurations, action accounting, reward objectives, and comparison with an independent optimal-return calculation.
