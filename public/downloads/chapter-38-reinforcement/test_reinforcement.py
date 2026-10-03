import itertools
import unittest
from reinforcement import evaluate, td_update, normalize, make_random, CHOICES

class ReinforcementTests(unittest.TestCase):
    def test_terminal_and_credit(self):
        self.assertEqual(td_update(0, 6, 99, .5, .9, True), dict(target=6, error=6, updated=3))
        self.assertEqual(td_update(0, -1, 6, .5, .9, False), dict(target=4.4, error=4.4, updated=2.2))
        self.assertEqual(td_update(0, -1, 0, .5, .9, False)['updated'], -.5)

    def test_no_exploration(self):
        r = evaluate(dict(epsilon=0))
        self.assertEqual((r['greedy']['total'], r['gap'], r['exploratorySteps']), (2, 2.4, 0))
        self.assertEqual([a['visits'] for a in r['rows']], [200, 0, 0, 0])

    def test_reproducibility(self):
        self.assertEqual(evaluate(), evaluate())
        self.assertNotEqual(evaluate()['history'], evaluate(dict(seed=19))['history'])
        self.assertEqual(make_random(7)(), 1025555898/4294967296)

    def test_delayed_value_and_proxy(self):
        r = evaluate()
        self.assertEqual([a['action'] for a in r['greedy']['trace']], ['ask', 'match'])
        self.assertEqual((r['greedy']['discounted'], r['greedy']['total'], r['trainingMean'], r['gap']), (4.4, 5, 3.175, 0))
        p = evaluate(dict(objective='clicks'))
        self.assertEqual((p['greedy']['discounted'], p['greedy']['satisfaction'], p['gap']), (4, 2, 0))
        self.assertEqual(evaluate(dict(episodes=60))['rows'][3]['visits'], 0)

    def test_all_settings(self):
        for values in itertools.product(*CHOICES.values()):
            c = dict(zip(CHOICES, values))
            r = evaluate(c)
            self.assertEqual(len(r['history']), c['episodes'])
            self.assertEqual(sum(a['visits'] for a in r['rows']), r['steps'])
            self.assertEqual(r['rows'][0]['visits'] + r['rows'][1]['visits'], c['episodes'])
            self.assertEqual(r['rows'][1]['visits'], r['rows'][2]['visits'] + r['rows'][3]['visits'])
            oracle = max(2, -1+c['gamma']*6) if c['objective']=='satisfaction' else 4
            self.assertAlmostEqual(r['optimal']['discounted'], oracle)
            self.assertLessEqual(r['greedy']['discounted'], oracle+1e-6)
            self.assertEqual(r['greedy']['total'], sum(a['reward'] for a in r['greedy']['trace']))
            self.assertAlmostEqual(r['greedy']['discounted'], sum(c['gamma']**i*a['reward'] for i, a in enumerate(r['greedy']['trace'])))
            self.assertEqual(r['greedy']['trace'][-1]['next'], 'terminal')
            for u in r['updates']:
                if u['terminal']:
                    self.assertEqual((u['target'], u['nextMax']), (u['reward'], 0))
                self.assertLess(abs(u['updated']-(u['old']+c['alpha']*(u['target']-u['old']))), 2e-6)
            if c['gamma']==0:
                self.assertEqual(r['greedy']['trace'][0]['action'], 'quick')

    def test_invalid(self):
        for c in ([], {'objective':'profit'}, {'epsilon':1}, {'gamma':'0.9'}, {'alpha':0}, {'episodes':True}, {'seed':0}, {'extra':2}):
            with self.assertRaises(ValueError):
                normalize(c)

if __name__ == '__main__':
    unittest.main()
