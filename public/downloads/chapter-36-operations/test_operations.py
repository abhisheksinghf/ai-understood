import unittest
from operations import DATA, DEFAULTS, evaluate, normalize, run_request, summarize

class OperationsTests(unittest.TestCase):
    def test_default_rollback_changes_future_routing(self):
        r = evaluate()
        self.assertEqual(r['totals'], dict(n=20,good=19,bad=1,goodPercent=95,httpOk=20,candidate=1,attempts=20,costUnits=59,p95=1200))
        self.assertEqual(r['rollbackAfter'], 1)
        self.assertTrue(all(x['version'] == 'baseline' for x in r['rows'][5:]))
        self.assertTrue(r['sloMet'])
        self.assertEqual(r['budgetRemaining'], 0)
    def test_observe_only_keeps_bad_version(self):
        r = evaluate(dict(rollback='observe'))
        self.assertEqual((r['totals']['bad'],r['totals']['candidate'],r['totals']['costUnits']), (4,4,56))
        self.assertEqual(r['decision'], 'review_needed')
    def test_larger_canary_exposes_more_before_rollback(self):
        r = evaluate(dict(share=100))
        self.assertEqual((r['totals']['bad'],r['totals']['candidate']), (2,5))
    def test_healthy_rollout_does_not_claim_approval(self):
        for share, count in ((0,0),(20,4),(60,12),(100,20)):
            r = evaluate(dict(scenario='healthy',share=share))
            self.assertEqual(r['totals']['candidate'], count)
            self.assertEqual(r['totals']['good'], 20)
            self.assertEqual(r['decision'], 'observe_more' if share else 'baseline_only')
    def test_retries_recover_transient_not_persistent_faults(self):
        for retries, good, attempts in ((0,12,20),(1,16,28)):
            r = evaluate(dict(scenario='provider_fault',retries=retries,rollback='observe'))
            self.assertEqual((r['totals']['good'],r['totals']['attempts']), (good,attempts))
    def test_deadline_includes_backoff_and_prior_attempt(self):
        r = evaluate(dict(scenario='provider_fault',deadline=1200,rollback='observe'))
        first = r['rows'][0]
        self.assertEqual((first['status'],first['elapsedMs'],first['reason']), (504,1200,'deadline_exceeded'))
        self.assertEqual([a['durationMs'] for a in first['attempts']], [400,600])
        self.assertEqual(first['costUnits'], 3)
        self.assertEqual(r['totals']['good'], 12)
    def test_shared_outage_survives_rollback(self):
        r = evaluate(dict(scenario='provider_fault',share=60))
        self.assertEqual(r['decision'], 'rolled_back')
        self.assertEqual(r['totals']['bad'], 4)
        self.assertTrue(any(not x['good'] for x in r['rows'][5:]))
    def test_quality_failure_is_not_retried(self):
        r = evaluate()['rows'][0]
        self.assertEqual((r['status'],r['quality'],len(r['attempts'])), (200,False,1))
    def test_no_retry_when_backoff_uses_budget(self):
        r = run_request(DATA['requests'][0],'baseline',{**DEFAULTS,'scenario':'provider_fault','deadline':500})
        self.assertEqual((r['reason'],len(r['attempts'])), ('retry_budget_exhausted',1))
    def test_p95_empty_and_small_samples(self):
        self.assertIsNone(summarize([])['p95'])
        self.assertEqual(summarize(evaluate()['rows'][:5])['p95'], 1200)
    def test_config_rejects_wrong_types_and_options(self):
        for c in ({'share':True},{'retries':True},{'deadline':'1200'},{'scenario':'x'},{'extra':1},[]):
            with self.assertRaises(ValueError): normalize(c)

if __name__ == '__main__':
    unittest.main()
