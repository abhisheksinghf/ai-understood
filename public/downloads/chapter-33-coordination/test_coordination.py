import unittest
from coordination import run_coordination, availability_report, verify_availability, protocol_transcript


class CoordinationTests(unittest.TestCase):
    def test_parallel_time_and_work(self):
        p = run_coordination()
        s = run_coordination(dict(schedule='sequential'))
        self.assertEqual((p['elapsed'], s['elapsed'], p['workUnits'], s['workUnits']), (6, 8, 8, 8))
        self.assertEqual((p['chosen'], p['status']), ('M003', 'verified'))
        self.assertTrue(all(j['start'] >= p['jobs'][0]['end'] for j in p['jobs'][1:]))

    def test_handoff(self):
        r = run_coordination(dict(pattern='handoff'))
        self.assertEqual((r['owner'], r['handoffs'], r['status']), ('Movie specialist', 1, 'verified'))
        self.assertEqual(r['jobs'][0]['owner'], 'Manager')
        self.assertEqual(r['jobs'][1]['owner'], 'Movie specialist')

    def test_bad_evidence(self):
        for scenario in ('missing', 'wrong_region', 'stale', 'conflict'):
            with self.subTest(scenario=scenario):
                r = run_coordination(dict(scenario=scenario))
                self.assertEqual((r['status'], r['chosen']), ('insufficient_evidence', None))
                r = run_coordination(dict(scenario=scenario, validate=False))
                self.assertEqual((r['status'], r['chosen']), ('unsupported', 'M003'))

    def test_budget(self):
        for budget in (1, 2):
            r = run_coordination(dict(budget=budget))
            self.assertEqual(r['jobCount'], budget)
            self.assertEqual(r['status'], 'incomplete')
            self.assertNotIn('taste', r['reports'])

    def test_unknown_is_not_negative(self):
        self.assertIn('unknown', verify_availability(None, 'M003')['reason'])
        self.assertIn('unavailable', verify_availability(availability_report('normal'), 'M001')['reason'])

    def test_invalid_results(self):
        for row in (dict(movie_id='M999', available=True), dict(movie_id='M003', available='true'), None):
            r = availability_report('normal')
            r['records'] = [row]
            self.assertFalse(verify_availability(r, 'M003')['ok'])

    def test_independent_runs(self):
        r = run_coordination()
        r['reports']['catalog']['movies'][0]['title'] = 'changed'
        r['reports']['taste']['ranking'][0] = 'M999'
        self.assertEqual(run_coordination()['chosen'], 'M003')
        self.assertEqual(run_coordination()['reports']['catalog']['movies'][0]['title'], 'Moonlight Map')

    def test_invalid_configuration(self):
        for c in (dict(scenario='x'), dict(pattern='x'), dict(schedule='x'), dict(budget=0), dict(budget=True), dict(validate='yes'), dict(unexpected=1)):
            with self.assertRaises(ValueError):
                run_coordination(c)

    def test_protocol_ids(self):
        t = protocol_transcript()
        self.assertEqual(len(t), 7)
        self.assertNotIn('id', t[2])
        self.assertEqual(t[2]['method'], 'notifications/initialized')
        for a, b in ((0, 1), (3, 4), (5, 6)):
            self.assertEqual(t[a]['id'], t[b]['id'])
        self.assertEqual(t[4]['result']['tools'][0]['name'], t[5]['params']['name'])


if __name__ == '__main__':
    unittest.main()
