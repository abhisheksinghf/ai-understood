import copy
import math
import unittest
from explore import DATA, cnn, convolve, pool, sequence, forward, transfer


class ArchitectureTests(unittest.TestCase):
    def test_convolution_arithmetic(self):
        self.assertEqual(convolve([[1,2,3],[4,5,6],[7,8,9]], [[1,0],[0,-1]]), [[-4,-4],[-4,-4]])
        self.assertEqual(cnn()["output"], [[3,3,0]]*3)
        self.assertEqual(cnn()["pooled"], [[3]])
        self.assertEqual(cnn()["global_mean"], 2)

    def test_padding_stride_and_shapes(self):
        self.assertEqual(convolve([[1,2],[3,4]], [[1]], 2, 1), [[0,0],[0,4]])
        for poster in DATA["posters"]:
            for kernel in DATA["kernels"]:
                for s in (1,2):
                    for p in (0,1):
                        r = cnn(poster, kernel, s, p)
                        n = (5+2*p-3)//s+1
                        self.assertEqual((len(r["output"]),len(r["output"][0])), (n,n))
                        self.assertTrue(all(x >= 0 for row in r["activation"] for x in row))

    def test_pooling_edges(self):
        self.assertEqual(pool([[1,2,100],[3,4,100],[100,100,100]]), [[4]])
        self.assertEqual(pool([[-4,-2],[-3,-1]]), [[-1]])

    def test_order_and_recurrence(self):
        a, b = sequence(), sequence("reversed")
        self.assertEqual(a["mean"], b["mean"])
        self.assertLess(a["real_final"], 0)
        self.assertGreater(b["real_final"], 0)
        self.assertAlmostEqual(a["steps"][1]["state"], math.tanh(.8+.5*a["steps"][0]["state"]))
        for history in DATA["histories"]:
            r = sequence(history, 0)
            self.assertAlmostEqual(r["real_final"], math.tanh(.8*r["inputs"][-1]))

    def test_masking(self):
        a, b = sequence(), sequence(mask=False)
        self.assertEqual(a["final"], a["real_final"])
        self.assertNotEqual(b["final"], b["real_final"])
        self.assertEqual(a["steps"][:3], b["steps"][:3])
        self.assertEqual(sum(s["skipped"] for s in a["steps"]), 2)

    def test_finite_difference_gradients(self):
        for y in (0,1):
            theta = DATA["transfer"]["theta"]
            g = forward(theta, label=y)["gradient"]
            for i in range(9):
                a, b = list(theta), list(theta)
                a[i] += 1e-5
                b[i] -= 1e-5
                numerical = (forward(a,label=y)["loss"]-forward(b,label=y)["loss"])/2e-5
                self.assertAlmostEqual(g[i], numerical, places=8)

    def test_freezing_and_sgd(self):
        initial = copy.deepcopy(DATA)
        a, b = transfer(), transfer("finetune")
        self.assertEqual(a["trainable_count"], 3)
        self.assertEqual(b["trainable_count"], 9)
        self.assertEqual(a["backbone_change"], 0)
        self.assertGreater(b["backbone_change"], 0)
        self.assertEqual(a["before"]["features"], a["after"]["features"])
        self.assertEqual(a["after_theta"][6:], b["after_theta"][6:])
        for r in (a,b):
            self.assertLess(r["after"]["loss"], r["before"]["loss"])
            for i, p in enumerate(r["after_theta"]):
                self.assertAlmostEqual(p,r["before_theta"][i]-(r["rate"]*r["before"]["gradient"][i] if r["trainable"][i] else 0))
        self.assertEqual(DATA, initial)

    def test_invalid_inputs(self):
        for m in ([], [[1],[2,3]], [[float("nan")]], [[True]]):
            with self.assertRaises(ValueError):
                convolve(m, [[1]])
        for call in (lambda: cnn("bad"), lambda: convolve([[1]],[[1,2]]), lambda: pool([[1]]), lambda: sequence(recurrent=.7), lambda: sequence(mask="yes"), lambda: transfer("bad"), lambda: forward([1])):
            with self.assertRaises(ValueError):
                call()


if __name__ == "__main__":
    unittest.main()
