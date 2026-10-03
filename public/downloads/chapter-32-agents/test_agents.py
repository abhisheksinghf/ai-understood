import copy
import itertools
import unittest
from agents import DATA, propose, run_agent, verify_finish


class AgentTests(unittest.TestCase):
    def test_adaptive_run_changes_candidate(self):
        r = run_agent()
        self.assertEqual((r['status'], r['turns'], r['toolCalls']), ('completed', 4, 3))
        self.assertEqual([f['proposal'].get('args', {}).get('movie_id') for f in r['frames'][1:3]], ['M001', 'M003'])
        self.assertIn('Harbor Lights', r['answer'])

    def test_normal_finishes_earlier(self):
        r = run_agent(dict(scenario='normal'))
        self.assertEqual((r['turns'], r['toolCalls']), (3, 2))
        self.assertIn('Moonlight Map', r['answer'])

    def test_scope_and_uncertainty(self):
        for scenario, status in [('none_available', 'no_match'), ('empty_search', 'no_match'), ('availability_unknown', 'insufficient_evidence')]:
            r = run_agent(dict(scenario=scenario))
            self.assertEqual(r['status'], status)
            self.assertIn('catalog', r['answer'])

    def test_missing_input_asks_before_tools(self):
        r = run_agent(dict(scenario='missing_region'))
        self.assertEqual((r['status'], r['turns'], r['toolCalls']), ('needs_input', 1, 0))

    def test_forgetting_is_stopped(self):
        r = run_agent(dict(policy='forgetful'))
        self.assertEqual((r['status'], r['turns'], r['toolCalls']), ('loop_stopped', 3, 2))
        self.assertIs(r['state']['checks']['M001'], False)

    def test_no_guard_still_has_budget(self):
        r = run_agent(dict(policy='forgetful', loopGuard=False))
        self.assertEqual((r['status'], r['turns'], r['toolCalls']), ('tool_limit', 5, 4))

    def test_premature_answer_is_blocked(self):
        r = run_agent(dict(policy='premature', scenario='normal'))
        self.assertEqual((r['status'], r['toolCalls']), ('blocked', 1))

    def test_injection_is_not_authority(self):
        r = run_agent(dict(scenario='malicious_note', policy='gullible'))
        self.assertEqual((r['status'], r['toolCalls']), ('blocked', 1))
        self.assertEqual(run_agent(dict(scenario='malicious_note'))['status'], 'completed')

    def test_finish_requires_its_own_decision(self):
        r = run_agent(dict(maxTurns=3))
        self.assertEqual(r['status'], 'turn_limit')
        self.assertIs(r['state']['checks']['M003'], True)

    def test_snapshots_are_independent(self):
        r = run_agent()
        self.assertEqual(r['frames'][0]['state']['checks'], {})
        r['state']['checks']['M001'] = True
        self.assertIs(r['frames'][1]['state']['checks']['M001'], False)

    def test_finish_gate_rejects_false_no_match_and_bad_constraints(self):
        r = run_agent(dict(scenario='normal'))
        self.assertEqual(verify_finish(dict(movie_id=None), r['state'], r['goal'])['status'], 'blocked')
        for change in [dict(minutes=100), dict(genre='action'), dict(mood='intense')]:
            state = copy.deepcopy(r['state'])
            state['candidates'][0].update(change)
            self.assertEqual(verify_finish(dict(movie_id='M001'), state, r['goal'])['status'], 'blocked')

    def test_invalid_configs(self):
        for c in ([], dict(maxTurns=True), dict(maxTools=0), dict(loopGuard=1), dict(policy='x'), dict(extra=1)):
            with self.assertRaises(ValueError):
                run_agent(c)

    def test_all_896_configurations_obey_limits(self):
        count = 0
        for s, p, turns, calls, guard in itertools.product(DATA['scenarios'], DATA['policies'], (2, 3, 4, 6), (1, 2, 3, 4), (True, False)):
            r = run_agent(dict(scenario=s['id'], policy=p['id'], maxTurns=turns, maxTools=calls, loopGuard=guard))
            count += 1
            self.assertLessEqual(r['turns'], turns)
            self.assertLessEqual(r['toolCalls'], calls)
            if r['status'] == 'completed':
                movie = r['frames'][-1]['proposal']['movie_id']
                self.assertIs(r['state']['checks'][movie], True)
                self.assertIs(s['availability'][movie], True)
        self.assertEqual(count, 896)


if __name__ == '__main__':
    unittest.main()
