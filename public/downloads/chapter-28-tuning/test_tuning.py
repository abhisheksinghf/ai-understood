import copy
import math
import unittest
from tuning import DATA, lora, preference, preference_state


class TuningMechanics(unittest.TestCase):
    def test_zero_b_preserves_base(self):
        for rank in [1,2]:
            r = lora(rank,4,'initial')
            self.assertEqual(r['output'], r['baseOutput'])
            self.assertEqual(r['update'], [0,0,0,0])

    def test_known_adapter_result(self):
        for actual, expected in zip(lora()['output'], [1.4,0.5,-0.2,1.1]):
            self.assertAlmostEqual(actual, expected)
        self.assertEqual(lora()['trainableParameters'], 8)
        self.assertEqual(lora(2)['trainableParameters'], 16)

    def test_merge_matches_two_paths(self):
        for rank in [1,2]:
            r = lora(rank,4)
            merged = [sum((w+u)*x for w,u,x in zip(row, delta, DATA['input']))
                      for row,delta in zip(DATA['base'],r['delta'])]
            for a,b in zip(merged,r['output']): self.assertAlmostEqual(a,b)

    def test_reference_equality_has_zero_margin(self):
        for ref in [0.2,0.5,0.8]:
            for chosen in ['A','B']:
                r = preference(ref,steps=0,chosen=chosen)['final']
                self.assertEqual(r['margin'],0)
                self.assertAlmostEqual(r['loss'],math.log(2))
                self.assertAlmostEqual(r['pA'],ref)
                self.assertAlmostEqual(r['kl'],0)

    def test_one_step_by_hand(self):
        r = preference(steps=1)
        self.assertEqual(r['initial']['gradient'],-0.25)
        self.assertEqual(r['final']['theta'],0.125)
        self.assertAlmostEqual(r['final']['pA'],0.5312093733737563)

    def test_analytical_gradient_against_finite_difference(self):
        for theta in [-2,0,2]:
            for beta in [0.1,0.5,1]:
                for sign in [-1,1]:
                    epsilon = 1e-5
                    plus = preference_state(theta+epsilon,0.3,beta,sign)['loss']
                    minus = preference_state(theta-epsilon,0.3,beta,sign)['loss']
                    expected = preference_state(theta,0.3,beta,sign)['gradient']
                    self.assertAlmostEqual((plus-minus)/(2*epsilon), expected, places=8)

    def test_wrong_label_can_lower_loss_and_grounded_probability(self):
        r = preference(steps=40,chosen='B')
        self.assertLess(r['final']['loss'],r['initial']['loss'])
        self.assertLess(r['final']['pA'],r['initial']['pA'])

    def test_all_supported_trajectories_are_normalized_and_improve_pair_fit(self):
        for ref in [0.2,0.5,0.8]:
            for beta in [0.1,0.5,1]:
                for rate in [0.1,0.5,1]:
                    for chosen in ['A','B']:
                        history = preference(ref,beta,rate,40,chosen)['history']
                        for row in history:
                            self.assertAlmostEqual(row['pA']+row['pB'],1)
                            self.assertTrue(all(math.isfinite(v) for v in row.values()))
                        for a,b in zip(history,history[1:]): self.assertLess(b['loss'],a['loss'])

    def test_no_shared_matrix_mutation(self):
        before = copy.deepcopy(DATA)
        r = lora()
        r['A'][0][0]=999
        r['input'][0]=999
        self.assertEqual(DATA,before)

    def test_invalid_choices(self):
        for args in [(0,2,'adapted'),(1,3,'adapted'),(1,2,'unknown'),(True,2,'initial')]:
            with self.assertRaises(ValueError): lora(*args)
        for args in [(0,0.5,0.5,1,'A'),(0.5,0,0.5,1,'A'),(0.5,0.5,0.5,41,'A'),(0.5,0.5,0.5,1,'C')]:
            with self.assertRaises(ValueError): preference(*args)


if __name__ == '__main__':
    unittest.main()
