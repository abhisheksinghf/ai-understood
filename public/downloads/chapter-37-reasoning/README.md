# Chapter 37: reason about a movie night

Python 3.10+; no packages, credentials, or network calls. Extract all four files into one folder, open a terminal there, and run:

```sh
python reasoning.py
python reasoning.py --minutes 120 --offline no
python reasoning.py --evidence unknown --penalty 10
python reasoning.py --minutes 80
python reasoning.py --prior 20 --evidence disliked
python -m unittest -v test_reasoning.py
```

The default JSON has posterior 0.8, two eligible films, and M01 / Quiet Orbit with enjoyment probability 0.78 and expected utility 3.02. With 120 minutes and online access, Comet Chase wins. With unknown trailer feedback and penalty 10 at default time, the result is abstain. With 80 minutes, no film is feasible.

`data.json` contains four fictional films, authored conditional probabilities, and a five-node graph. H means a sci-fi mood, not a permanent user trait. Liking a sci-fi trailer has likelihood 0.8 given H and 0.2 otherwise. Unknown feedback makes no update. Movie enjoyment is assumed conditionally independent of trailer feedback given H. Utility is +5 for enjoyment and minus the selected penalty for disappointment; skipping has utility zero. These are teaching assumptions, not measured preferences. Hard duration and offline constraints are applied before utility selection.

Reports round probabilities and utilities to six decimals; selection uses these rounded utilities. Ties keep abstention at zero, then the earlier eligible catalog film. Changing the penalty can change the decision without changing beliefs. The script scores all four films for inspection, but never selects an ineligible one. It implements explicit rules and enumeration, not a general logic engine or constraint solver.

The separate search example always uses the same graph: Start→Ready costs 10; Start→Check→Pick→Ready costs 3. Start→Detour→Start is a cycle. BFS returns the one-edge route; UCS and A* return the cheaper route. The expansion trace includes the goal when popped. Best-cost tracking suppresses cycles and allows a cheaper route to replace an earlier one. Equal priority uses insertion order. The supplied consistent heuristic is {Start:3, Check:2, Pick:1, Detour:4, Ready:0}; A* skips the detour in this example. This tiny implementation sorts a list for clarity; large searches use a priority queue.

Explore: predict a result, run it, then inspect `rows`, `reasons`, `posterior`, and `searches`. Tests check hand calculations, evidence handling, hard constraints, abstention, every configuration, search paths, and heuristic consistency. Changing fixture data means updating expectations. Real systems need validated inputs, estimated/calibrated probabilities, representative evaluation, and plans that account for changing state.
