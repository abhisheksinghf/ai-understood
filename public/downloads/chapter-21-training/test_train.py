import copy
import json
import math
from pathlib import Path
import unittest
from train import PRESETS, initialize, fit_scaler, transform, evaluate, optimizer_step, order, run, forward, validate

DATA = json.loads(Path(__file__).with_name("data.json").read_text(encoding="utf-8"))


class TrainingTests(unittest.TestCase):
    def test_scaling_and_saturation(self):
        s = fit_scaler(DATA["train"])
        self.assertEqual(s["mean"], [50, 0.5])
        self.assertAlmostEqual(s["std"][0], math.sqrt(912.5))
        self.assertAlmostEqual(s["std"][1], math.sqrt(0.09125))
        self.assertEqual(len(initialize()), 33)
        self.assertEqual(evaluate(initialize(), DATA["train"])["saturation"], 109/128)
        self.assertEqual(evaluate(initialize(), transform(DATA["train"], s))["saturation"], 0)
        self.assertEqual(fit_scaler([{"x":[1,1]},{"x":[1,1]}])["std"], [1,1])

    def test_all_gradients_with_and_without_l2(self):
        rows = transform(DATA["train"], fit_scaler(DATA["train"]))
        for theta in (initialize(), run(epochs=20)["last"]["theta"]):
            for l2 in (0, 0.02):
                g = evaluate(theta, rows, l2)["gradient"]
                for i, analytic in enumerate(g):
                    plus, minus = theta[:], theta[:]
                    plus[i] += 1e-5
                    minus[i] -= 1e-5
                    numeric = (evaluate(plus, rows, l2)["objective"] - evaluate(minus, rows, l2)["objective"])/(2e-5)
                    self.assertAlmostEqual(analytic, numeric, delta=3e-8)

    def test_optimizer_and_penalty(self):
        theta, g = [1, -2], [0.2, -0.4]
        state = {"step":0,"m":[0,0],"v":[0,0]}
        a, s = optimizer_step(theta, g, state, PRESETS["baseline"])
        self.assertAlmostEqual(a[0], 1-0.03*0.2/(0.2+1e-8))
        b, _ = optimizer_step(a, g, s, PRESETS["baseline"])
        self.assertAlmostEqual(b[0], 1-2*0.03*0.2/(0.2+1e-8))
        self.assertEqual(optimizer_step(theta,g,state,PRESETS["sgd"])[0], [0.994,-1.988])
        weights = initialize("zero")
        weights[2], weights[32] = 3, 4
        self.assertEqual(evaluate(weights, DATA["train"], 0.02)["penalty"], 0)
        weights[0] = 3
        self.assertAlmostEqual(evaluate(weights, DATA["train"], 0.02)["penalty"], 0.09)

    def test_validation_isolation(self):
        data = copy.deepcopy(DATA)
        for row in data["validation"]:
            row["x"] = [row["x"][0]+300,row["x"][1]+3]
            row["y"] = 1-row["y"]
        a = run(batch_size=4, data=DATA, epochs=30)
        b = run(batch_size=4, data=data, epochs=30)
        self.assertEqual(a["scaler"], b["scaler"])
        self.assertEqual(a["last"]["theta"], b["last"]["theta"])
        self.assertEqual([r["train_loss"] for r in a["history"]], [r["train_loss"] for r in b["history"]])
        self.assertNotEqual(a["last"]["validation_loss"], b["last"]["validation_loss"])

    def test_shuffle_and_update_counts(self):
        for epoch in range(1,6):
            self.assertEqual(sorted(order(16,epoch)), list(range(16)))
            self.assertEqual(order(16,epoch), order(16,epoch))
        self.assertEqual(run(epochs=3)["last"]["updates"], 3)
        self.assertEqual(run(batch_size=4,epochs=3)["last"]["updates"], 12)

    def test_zero_initialization_and_inference(self):
        r = run("zero")
        self.assertTrue(all(v == 0 for v in r["last"]["theta"][:32]))
        self.assertAlmostEqual(forward(r["last"]["theta"], [1,1])[2], 0.625)
        self.assertGreater(r["history"][0]["gradient_norm"], 0)
        theta = r["last"]["theta"][:]
        forward(theta, [2,3])
        self.assertEqual(theta, r["last"]["theta"])

    def test_checkpoint_and_patience(self):
        r = run("fast")
        self.assertEqual(r["best"]["epoch"], 112)
        self.assertAlmostEqual(r["best"]["validation_loss"], 0.04187753458079985)
        self.assertEqual(r["best"]["validation_loss"], min(h["validation_loss"] for h in r["history"]))
        self.assertAlmostEqual(r["last"]["validation_loss"], 0.18986098500566193)
        self.assertEqual(r["last"]["validation_accuracy"], 11/12)
        stopped = run("fast", True)
        self.assertEqual(stopped["last"]["epoch"], 46)
        self.assertEqual(stopped["best"]["epoch"], 16)
        old = r["last"]["theta"][0]
        r["best"]["theta"][0] = 999
        self.assertEqual(r["last"]["theta"][0], old)

    def test_invalid_inputs(self):
        data = copy.deepcopy(DATA)
        data["validation"][0]["id"] = data["train"][0]["id"]
        with self.assertRaises(ValueError):
            validate(data)
        for data in (None, {"train":[],"validation":[]}, {"train":[None],"validation":[{}]}):
            with self.assertRaises(ValueError):
                validate(data)
        for epoch in (-1,0,601,2.5,True):
            with self.assertRaises(ValueError):
                run(epochs=epoch)
        with self.assertRaises(ValueError):
            run("unknown")


if __name__ == "__main__":
    unittest.main()
