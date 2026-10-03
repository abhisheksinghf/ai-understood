import copy
import unittest
from evaluation import DATA, grade, summarize, compare_rows, evaluate


class EvaluationTests(unittest.TestCase):
    def test_counts_and_pairs(self):
        r=evaluate()
        self.assertEqual((r['full']['baseline']['success'], r['full']['candidate']['success']), (62.5,75))
        self.assertEqual(r['full']['paired'], dict(wins=4,losses=2,ties=10,delta=12.5))
        self.assertEqual((r['full']['candidate']['unauthorized'],r['decision']), (2,'hold_for_review'))

    def test_guarded_and_thresholds(self):
        r=evaluate(dict(variant='guarded'))
        self.assertEqual(r['full']['candidate']['success'],87.5)
        self.assertEqual(r['decision'],'passes_example_gate')
        for c in (dict(minSuccess=90),dict(maxLatency=2500)):
            self.assertEqual(evaluate(dict(variant='guarded',**c))['decision'],'hold_for_review')

    def test_filters_keep_gate(self):
        a=evaluate(); b=evaluate(dict(slice='routine',trial='1'))
        self.assertEqual(b['view']['candidate']['success'],100)
        self.assertEqual(b['view']['candidate']['n'],4)
        self.assertEqual(a['full'],b['full']); self.assertEqual(a['gates'],b['gates'])

    def test_different_failure_layers(self):
        for version,task_id,failed in (('baseline','T8','state'),('candidate','T4','support')):
            row=next(r for r in DATA['records'] if r['version']==version and r['taskId']==task_id and r['trial']==2)
            task=next(t for t in DATA['tasks'] if t['id']==task_id)
            g=grade(task,row)
            self.assertTrue(g['checks']['answer']); self.assertEqual(g['failures'],[failed])

    def test_consistency_and_percentiles(self):
        r=evaluate()
        self.assertEqual(r['view']['candidate']['allTrialsPassed'],5)
        self.assertEqual(r['view']['baseline']['allTrialsPassed'],4)
        self.assertEqual(r['full']['candidate']['p95'],2400)
        self.assertEqual(r['full']['candidate']['meanCost'],2)
        self.assertIsNone(summarize([])['success']); self.assertIsNone(summarize([])['p95'])

    def test_pair_order_and_missing_pairs(self):
        v=evaluate()['view']
        self.assertEqual(compare_rows(v['baselineRows'],list(reversed(v['rows']))),v['paired'])
        with self.assertRaises(ValueError): compare_rows(v['baselineRows'],v['rows'][1:])
        duplicate=copy.deepcopy(v['rows']);duplicate[0]=duplicate[1]
        with self.assertRaises(ValueError): compare_rows(v['baselineRows'],duplicate)
        missing=copy.deepcopy(v['rows']);missing[0]['taskId']='absent'
        with self.assertRaises(ValueError): compare_rows(v['baselineRows'],missing)

    def test_duplicate_authorized_write(self):
        t=next(t for t in DATA['tasks'] if t['id']=='T8')
        row=copy.deepcopy(next(r for r in DATA['records'] if r['taskId']=='T8' and r['trial']==1))
        row['writes']=['M003','M003']; g=grade(t,row)
        self.assertTrue(g['checks']['authorized']);self.assertFalse(g['checks']['state'])

    def test_bad_configuration(self):
        for c in (dict(variant='x'),dict(slice='x'),dict(trial=1),dict(minSuccess=0),dict(maxLatency=0),dict(extra=True)):
            with self.assertRaises(ValueError):evaluate(c)


if __name__=='__main__': unittest.main()
