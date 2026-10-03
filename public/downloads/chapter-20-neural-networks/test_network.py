import math
import unittest
from network import initial, forward, sample_gradient, batch, train, update, log_loss, sigmoid


class NetworkTests(unittest.TestCase):
    def test_forward_and_gradients(self):
        r = sample_gradient(initial(), [1, 0], 1)
        self.assertEqual(r["a"], [0.7, -0.5, 0.75])
        self.assertAlmostEqual(r["z"], 0.5633503751930565)
        self.assertAlmostEqual(r["p"], 0.6372273974891202)
        self.assertAlmostEqual(r["loss"], 0.45062870518331766)
        self.assertAlmostEqual(r["gradient"][0], -0.09210645318985008)
        self.assertEqual(r["gradient"][1], 0)
        self.assertAlmostEqual(batch(initial())["gradient"][0], 0.025594383368197825)

    def test_finite_difference_every_parameter(self):
        eps = 1e-5
        for architecture in ("linear", "hidden"):
            for steps in (0, 100):
                theta = train(architecture, steps)["theta"]
                gradient = batch(theta)["gradient"]
                for i, actual in enumerate(gradient):
                    plus, minus = theta[:], theta[:]
                    plus[i] += eps
                    minus[i] -= eps
                    numeric = (batch(plus)["loss"] - batch(minus)["loss"])/(2*eps)
                    self.assertAlmostEqual(actual, numeric, delta=2e-8)

    def test_batch_mean_and_simultaneous_update(self):
        theta = initial()
        before = theta[:]
        b = batch(theta)
        next_theta = update(theta, b["gradient"], 0.5)
        self.assertEqual(theta, before)
        self.assertAlmostEqual(next_theta[0], 0.5872028083159011)
        self.assertEqual(train("hidden", 1)["theta"], next_theta)
        self.assertLess(batch(next_theta)["loss"], b["loss"])
        for i in range(13):
            expected = sum(sample_gradient(theta, [x1, x2], y)["gradient"][i]
                           for x1, x2, y in [(1,0,1),(0,1,1),(1,1,0),(0,0,0)]) / 4
            self.assertAlmostEqual(b["gradient"][i], expected)

    def test_fit_and_linear_limitation(self):
        h, linear = train("hidden", 2000), train("linear", 2000)
        self.assertEqual(h["accuracy"], 1)
        self.assertLess(h["loss"], 0.003)
        self.assertTrue(all(r["p"] > 0.99 if r["y"] else r["p"] < 0.01 for r in h["rows"]))
        self.assertAlmostEqual(linear["loss"], math.log(2))
        self.assertTrue(all(abs(r["p"]-0.5) < 1e-10 for r in linear["rows"]))
        self.assertEqual(len(h["history"]), 101)
        self.assertEqual(h["history"][-1]["step"], 2000)

    def test_stability_and_inference(self):
        self.assertEqual(sigmoid(-1000), 0)
        self.assertEqual(sigmoid(1000), 1)
        self.assertEqual(log_loss(1000, 0), 1000)
        self.assertEqual(log_loss(-1000, 1), 1000)
        theta = train("hidden", 100)["theta"]
        before = theta[:]
        self.assertEqual(forward(theta, [0,1]), forward(theta, [0,1]))
        self.assertEqual(theta, before)
        self.assertNotIn("y", forward(theta, [0,1]))

    def test_invalid_arguments(self):
        for steps in (-1, 2001, 1.5, True):
            with self.assertRaises(ValueError):
                train("hidden", steps)
        for rate in (0, -1, math.inf, math.nan, 2.1):
            with self.assertRaises(ValueError):
                train("hidden", 0, rate)
        with self.assertRaises(ValueError):
            train("other")
        with self.assertRaises(ValueError):
            forward([1,2], [0,1])
        with self.assertRaises(ValueError):
            sample_gradient(initial(), [0,1], 2)


if __name__ == "__main__":
    unittest.main()
