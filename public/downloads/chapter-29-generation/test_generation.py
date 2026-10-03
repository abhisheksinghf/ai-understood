import itertools
import math
import unittest
from generation import DATA, normal_draws, denoise, corruption, generate


class GenerationTests(unittest.TestCase):
    def test_noise_reproducible(self):
        for seed in DATA['seeds']:
            self.assertEqual(normal_draws(seed), normal_draws(seed))
            self.assertEqual(len(normal_draws(seed)), 4)
            self.assertTrue(all(math.isfinite(x) for x in normal_draws(seed)))
        self.assertNotEqual(normal_draws(7), normal_draws(42))

    def test_oracle_recovers_original(self):
        for style, seed, level in itertools.product(DATA['styles'], DATA['seeds'], range(1, 8)):
            row = corruption(style, seed, level, 'oracle')
            for a, b in zip(row['clean'], row['reconstructed']):
                self.assertAlmostEqual(a, b, places=12)

    def test_center_posterior(self):
        for key, style in DATA['styles'].items():
            row = denoise([.5*x for x in style['mean']], .25, key)
            self.assertEqual(row['clean'], style['mean'])
            self.assertEqual(row['epsilon'], [0, 0])

    def test_symmetric_mixture(self):
        row = denoise([0, 0], .25)
        self.assertEqual(row['clean'], [0, 0])
        self.assertEqual(row['responsibilities'], [.5, .5])

    def test_bayes_weights_and_posterior(self):
        row = denoise([1, .5], .25)
        self.assertAlmostEqual(sum(row['responsibilities']), 1)
        self.assertGreater(row['responsibilities'][1], row['responsibilities'][0])
        posteriors = [denoise([1, .5], .25, k)['clean'] for k in DATA['styles']]
        for j in range(2):
            self.assertAlmostEqual(row['clean'][j], sum(w*p[j] for w, p in zip(row['responsibilities'], posteriors)))

    def test_expected_uncertainty_grows(self):
        variances = [denoise([0, 0], a, 'calm')['conditionalVariance'] for a in DATA['retained']]
        self.assertTrue(all(a < b for a, b in zip(variances, variances[1:])))

    def test_corruption_fixed_draws(self):
        a, b = corruption(level=1), corruption(level=7)
        self.assertEqual(a['clean'], b['clean'])
        self.assertEqual(a['epsilon'], b['epsilon'])
        self.assertNotEqual(a['noisy'], b['noisy'])
        self.assertGreater(b['errorAmplification'], a['errorAmplification'])

    def test_sampling_finite_schedule(self):
        for style, seed, guidance, steps in itertools.product(DATA['styles'], DATA['seeds'], [0, 1, 3, 7], [4, 8, 16]):
            row = generate(style, seed, guidance, steps)
            history = row['history']
            self.assertEqual(len(history), steps+1)
            self.assertAlmostEqual(history[0]['a'], .001)
            self.assertEqual(history[-1]['a'], 1)
            self.assertTrue(all(a['a'] < b['a'] for a, b in zip(history, history[1:])))
            self.assertTrue(all(math.isfinite(x) for h in history for x in h['point']))
            self.assertEqual(row, generate(style, seed, guidance, steps))

    def test_zero_guidance_ignores_style(self):
        self.assertEqual(generate('calm', guidance=0)['history'], generate('adventure', guidance=0)['history'])
        self.assertNotEqual(generate('calm')['final'], generate('adventure')['final'])

    def test_final_step_is_conditional_posterior(self):
        row = generate()
        before = row['history'][-2]
        expected = denoise(before['point'], before['a'], 'calm')['clean']
        for a, b in zip(row['final'], expected):
            self.assertAlmostEqual(a, b, places=12)

    def test_steps_hold_initial_noise(self):
        a, b = generate(steps=4), generate(steps=16)
        self.assertEqual(a['start'], b['start'])
        self.assertNotEqual(a['final'], b['final'])

    def test_invalid_inputs(self):
        for args in [('unknown', 42), ('calm', 0), ('calm', 42, 0), ('calm', 42, 8), ('calm', 42, 1, 'unknown')]:
            with self.assertRaises(ValueError):
                corruption(*args)
        for args in [('calm', 42, 2), ('calm', 42, 1, 3)]:
            with self.assertRaises(ValueError):
                generate(*args)
        for point, a in [([0], .5), ([0, float('nan')], .5), ([0, 0], 0), ([0, 0], 1)]:
            with self.assertRaises(ValueError):
                denoise(point, a)


if __name__ == '__main__':
    unittest.main()
