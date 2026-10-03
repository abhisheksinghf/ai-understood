import math
import unittest
from attention import DATA, explore, attend, softmax, position


class AttentionTests(unittest.TestCase):
    def close(self, a, b):
        if isinstance(a, list):
            self.assertEqual(len(a), len(b))
            for x, y in zip(a, b):
                self.close(x, y)
        else:
            self.assertAlmostEqual(a, b, places=10)

    def test_worked_result(self):
        r = explore()
        a = 1/(2+math.exp(1/math.sqrt(2)))
        self.close(r["heads"][0]["weights"][2], [a,a,1-2*a,0])
        self.close(r["heads"][0]["outputs"][2], [a,a])
        self.close(r["heads"][1]["outputs"][2], [2/3,2/3])
        self.close(r["projected"][2], [a+1/3,a+1/3,2/3+a/2,2/3+a/2])
        self.close(r["residual"][2], [x+y for x,y in zip(r["inputs"][2],r["projected"][2])])

    def test_probability_and_value_bounds(self):
        for ending in ("fun", "slow"):
            for p in ("none", "sinusoidal"):
                for causal in (False, True):
                    for h in explore(ending,p,causal)["heads"]:
                        for i in range(4):
                            self.close(sum(h["weights"][i]), 1)
                            for j in range(4):
                                self.assertGreaterEqual(h["weights"][i][j], 0)
                                if causal and j > i:
                                    self.assertEqual(h["weights"][i][j], 0)
                                    self.assertIsNone(h["masked"][i][j])
                            for d in range(2):
                                values = [v[d] for v in h["V"][:i+1 if causal else 4]]
                                self.assertGreaterEqual(h["outputs"][i][d], min(values)-1e-10)
                                self.assertLessEqual(h["outputs"][i][d], max(values)+1e-10)

    def test_future_isolation(self):
        for p in ("none", "sinusoidal"):
            a,b = explore("fun",p),explore("slow",p)
            self.close(a["residual"][:3], b["residual"][:3])
            self.assertNotEqual(a["residual"][3], b["residual"][3])
            self.assertNotEqual(explore("fun",p,False)["projected"][2], explore("slow",p,False)["projected"][2])

    def test_diagonal(self):
        for h in explore()["heads"]:
            self.close(h["weights"][0], [1,0,0,0])
            self.close(h["outputs"][0], h["V"][0])

    def test_permutation_equivariance(self):
        x,perm = explore()["inputs"],[2,0,3,1]
        for h in DATA["heads"]:
            a,b = attend(x,h,False),attend([x[i] for i in perm],h,False)
            self.close(b["outputs"], [a["outputs"][i] for i in perm])
            self.close(b["weights"], [[a["weights"][i][j] for j in perm] for i in perm])

    def test_positions(self):
        self.close(position(0), [0,1,0,1])
        self.close(position(1), [math.sin(1),math.cos(1),math.sin(.01),math.cos(.01)])
        self.assertNotEqual(explore()["heads"][0]["weights"], explore(positions="sinusoidal")["heads"][0]["weights"])

    def test_stable_softmax(self):
        self.close(softmax([1000,1000,None]), [.5,.5,0])
        self.close(softmax([-1000,-1000,None]), [.5,.5,0])
        with self.assertRaises(ValueError): softmax([None,None])

    def test_options(self):
        for args in [("bad",),("fun","bad"),("fun","none",1)]:
            with self.assertRaises(ValueError): explore(*args)


if __name__ == "__main__":
    unittest.main()
