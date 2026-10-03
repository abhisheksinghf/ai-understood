import itertools
import unittest
from workflows import DATA, ToolError, WatchlistStore, run_workflow, validate_call


class WorkflowTests(unittest.TestCase):
    def test_success_has_receipt(self):
        r = run_workflow()
        self.assertEqual((r['status'], r['attempts'], len(r['backendRows'])), ('completed', 2, 1))
        self.assertTrue(any(e['code'] == 'save_ok' for e in r['trace']))

    def test_rejections_do_not_execute(self):
        for scenario in ('bad_json', 'extra_field', 'unknown_tool', 'unknown_movie'):
            r = run_workflow(dict(scenario=scenario))
            self.assertEqual((r['status'], r['attempts'], r['backendRows']), ('blocked', 0, []))

    def test_write_gates(self):
        for c in (dict(canWrite=False), dict(authorized=False), dict(scenario='changed_movie')):
            r = run_workflow(c)
            self.assertEqual((r['status'], r['attempts'], r['backendRows']), ('blocked', 1, []))

    def test_failed_evidence_stops_write(self):
        for scenario, status in (('unavailable', 'not_available'), ('bad_result', 'failed')):
            r = run_workflow(dict(scenario=scenario))
            self.assertEqual((r['status'], len(r['backendRows'])), (status, 0))

    def test_read_timeout(self):
        self.assertEqual(run_workflow(dict(scenario='read_timeout'))['attempts'], 3)
        self.assertEqual(run_workflow(dict(scenario='read_timeout', retries=0))['status'], 'failed')

    def test_replay_and_unsafe_duplicate(self):
        for dedup, rows in ((True, 1), (False, 2)):
            r = run_workflow(dict(scenario='lost_receipt', deduplicate=dedup))
            self.assertEqual((r['status'], r['attempts'], len(r['backendRows'])), ('completed', 3, rows))

    def test_unknown_is_not_failure_or_success(self):
        for c in (dict(retries=0), dict(budget=2)):
            r = run_workflow(dict(c, scenario='lost_receipt'))
            self.assertEqual((r['status'], len(r['backendRows'])), ('needs_reconciliation', 1))
            self.assertIn('unknown', r['answer'])

    def test_key_conflict_and_account_scope(self):
        store = WatchlistStore()
        a = store.save('a', 'M001', 'k')
        b = store.save('a', 'M001', 'k')
        self.assertEqual(a['receipt_id'], b['receipt_id'])
        self.assertTrue(b['replayed'])
        with self.assertRaises(ToolError) as exc:
            store.save('a', 'M002', 'k')
        self.assertEqual(exc.exception.code, 'key_conflict')
        store.save('b', 'M002', 'k')
        self.assertEqual(len(store.rows), 2)

    def test_invalid_contracts(self):
        for raw in ('null', '[]', '{}', '{"movie_id":123}', '{"movie_id":"M001","user":"b"}'):
            with self.assertRaises(ToolError):
                validate_call('add_to_watchlist', raw)
        self.assertEqual(validate_call('add_to_watchlist', '{"movie_id":"M999"}'), {'movie_id': 'M999'})

    def test_invalid_configuration(self):
        for c in ([], dict(retries=True), dict(budget=0), dict(canWrite=1), dict(scenario='x'), dict(extra=True)):
            with self.assertRaises(ValueError):
                run_workflow(c)

    def test_invariants_across_all_controls(self):
        for scenario, retries, budget, can_write, authorized, dedup in itertools.product(
                [s['id'] for s in DATA['scenarios']], range(3), range(1, 5), (True, False), (True, False), (True, False)):
            r = run_workflow(dict(scenario=scenario, retries=retries, budget=budget, canWrite=can_write,
                                  authorized=authorized, deduplicate=dedup))
            self.assertLessEqual(r['attempts'], budget)
            if dedup:
                self.assertLessEqual(len(r['backendRows']), 1)
            if not can_write or not authorized:
                self.assertEqual(r['backendRows'], [])
            if r['status'] == 'completed':
                self.assertTrue(any(e['code'] in ('save_ok', 'receipt_replayed') for e in r['trace']))


if __name__ == '__main__':
    unittest.main()
