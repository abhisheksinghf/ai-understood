import itertools
import unittest
from reasoning import evaluate, search, normalize, CHOICES, DATA

class ReasoningTests(unittest.TestCase):
    def test_hand_calculation(self):
        r = evaluate()
        self.assertEqual((r['posterior'], r['eligible'], r['chosen'], r['bestUtility']), (.8, 2, 'M01', 3.02))
        self.assertEqual(r['rows'][0]['enjoyment'], .78)

    def test_unknown_and_negative_evidence(self):
        self.assertEqual(evaluate(dict(evidence='unknown', prior=20))['posterior'], .2)
        r = evaluate(dict(evidence='disliked', prior=20))
        self.assertEqual((r['posterior'], r['chosen']), (.058824, 'M02'))

    def test_hard_constraints(self):
        self.assertEqual(evaluate(dict(minutes=80))['decision'], 'no_feasible_movie')
        self.assertEqual(evaluate(dict(minutes=120, offline='no'))['chosen'], 'M03')
        self.assertEqual(evaluate(dict(minutes=120))['rows'][2]['reasons'], ['Not downloaded'])

    def test_abstain_and_tie(self):
        r = evaluate(dict(evidence='unknown', penalty=10))
        self.assertEqual((r['eligible'], r['decision'], r['chosen']), (2, 'abstain', None))
        self.assertEqual(evaluate(dict(evidence='unknown'))['chosen'], 'M01')

    def test_all_configurations(self):
        for values in itertools.product(*CHOICES.values()):
            c = dict(zip(CHOICES, values))
            r = evaluate(c)
            odds = c['prior'] / (100 - c['prior']) * {'unknown': 1, 'liked': 4, 'disliked': .25}[c['evidence']]
            self.assertAlmostEqual(r['posterior'], odds / (1 + odds), places=6)
            feasible = [m for m in r['rows'] if m['minutes'] <= c['minutes'] and (c['offline'] == 'no' or m['downloaded'])]
            self.assertEqual(r['eligible'], len(feasible))
            if r['chosen']:
                chosen = next(m for m in feasible if m['id'] == r['chosen'])
                self.assertGreater(chosen['utility'], 0)
                self.assertEqual(chosen['utility'], max(m['utility'] for m in feasible))
            else:
                self.assertTrue(all(m['utility'] <= 0 for m in feasible))

    def test_search_paths(self):
        self.assertEqual(search('bfs')['cost'], 10)
        for method in ('ucs', 'astar'):
            r = search(method)
            self.assertEqual(r['cost'], 3)
            self.assertEqual(r['path'], ['Start', 'Check', 'Pick', 'Ready'])
        self.assertEqual(search('ucs')['expanded'], ['Start', 'Check', 'Detour', 'Pick', 'Ready'])
        self.assertEqual(search('astar')['expanded'], ['Start', 'Check', 'Pick', 'Ready'])

    def test_consistent_heuristic(self):
        self.assertEqual(DATA['heuristic']['Ready'], 0)
        for node, edges in DATA['graph'].items():
            for target, cost in edges:
                self.assertLessEqual(DATA['heuristic'][node], cost + DATA['heuristic'][target])

    def test_invalid_configuration(self):
        for config in ([], {'prior': '50'}, {'offline': True}, {'penalty': True}, {'minutes': 95}, {'extra': 1}):
            with self.assertRaises(ValueError):
                normalize(config)
        with self.assertRaises(ValueError):
            search('greedy')

if __name__ == '__main__':
    unittest.main()
