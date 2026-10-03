import copy
import unittest
from assistant import DATA, evaluate, run


class AssistantTests(unittest.TestCase):
    def test_reference_and_baseline(self):
        self.assertEqual(evaluate()['passed'], 8)
        baseline = evaluate({'constraints': False, 'aliases': False})
        self.assertEqual((baseline['passed'], baseline['violations'], baseline['gate']), (4, 3, 'Needs work'))

    def test_actual_retrieval_and_source(self):
        request = DATA['cases'][0]['request']
        result = run(request)
        self.assertEqual((result['movie_id'], result['value'], result['sources']), ('M001', 105, ['M001:r1:card']))
        self.assertEqual(result['candidates'][0]['score'], 2)
        self.assertFalse(result['candidates'][0]['eligible'])
        self.assertEqual(run(request, {'constraints': False})['movie_id'], 'M002')

    def test_exact_limit_and_seen(self):
        request = {'intent': 'recommend', 'query': 'space', 'max_minutes': 105, 'seen': []}
        self.assertEqual(run(request)['movie_id'], 'M001')
        request['max_minutes'] = 104
        self.assertEqual(run(request)['status'], 'no_match')
        request.update(max_minutes=105, seen=['M001'])
        self.assertEqual(run(request)['status'], 'no_match')

    def test_aliases_deduplication_and_ties(self):
        request = {'intent': 'recommend', 'query': 'cosmic space SPACE', 'max_minutes': 200, 'seen': []}
        self.assertEqual(run(request)['candidates'][0]['score'], 1)
        self.assertEqual(run(request)['movie_id'], 'M002')
        self.assertEqual(evaluate({'aliases': False})['passed'], 7)

    def test_tool_timeout_does_not_fabricate(self):
        result = run(DATA['cases'][5]['request'], {'tool': 'timeout'})
        self.assertEqual((result['status'], result['sources'], result['value']), ('tool_unavailable', [], None))
        report = evaluate({'tool': 'timeout'})
        self.assertEqual((report['passed'], report['violations'], report['toolFailures']), (7, 0, 1))

    def test_unknown_region_movie_and_unsupported(self):
        self.assertEqual(run({'intent': 'availability', 'movie_id': 'M001', 'region': 'US'})['status'], 'unknown_availability')
        self.assertEqual(run({'intent': 'runtime', 'movie_id': 'M999'})['status'], 'not_found')
        self.assertEqual(run({'intent': 'director', 'movie_id': 'M001'})['status'], 'unsupported_question')

    def test_reject_invalid_inputs(self):
        base = DATA['cases'][0]['request']
        for request in [None, [], {}, {**base, 'max_minutes': True}, {**base, 'max_minutes': -1}, {**base, 'max_minutes': 105.5}, {**base, 'query': '!'}, {**base, 'seen': 'M001'}, {**base, 'execute': 'anything'}, {'intent': 'availability', 'movie_id': 'M001', 'region': 10}]:
            self.assertEqual(run(request)['status'], 'invalid_input')
        for config in [{'constraints': 1}, {'tool': 'live'}, {'extra': True}, []]:
            with self.assertRaises(ValueError):
                evaluate(config)

    def test_inputs_are_not_mutated(self):
        request = copy.deepcopy(DATA['cases'][0]['request'])
        saved = copy.deepcopy(request)
        run(request)
        self.assertEqual(request, saved)


if __name__ == '__main__':
    unittest.main()
