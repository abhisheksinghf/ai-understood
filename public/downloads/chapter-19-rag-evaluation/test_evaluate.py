import copy
import json
from pathlib import Path
import unittest
import evaluate as ev

DATA=json.loads(Path(__file__).with_name('benchmark.json').read_text(encoding='utf-8'))

class EvaluationTests(unittest.TestCase):
    def test_worked_counts_and_paired_comparison(self):
        r=ev.compare(DATA)
        self.assertEqual(r['baseline']['successes'],5)
        for k,v in dict(successes=7,task_success=7/8,answer_coverage=7/8,answered_accuracy=6/7,false_answer_rate=.5,mean_evidence_units=39.75).items():self.assertEqual(r['candidate'][k],v)
        self.assertEqual([r['paired'][k] for k in ('wins','losses','ties','delta')],[3,1,4,.25])
        missing=ev.compare(DATA,slice_name='missing')
        self.assertEqual(missing['candidate']['task_success'],.5)
        self.assertIsNone(missing['candidate']['retrieval_recall'])

    def test_trace_diagnoses(self):
        q=ev.run_case(DATA,'Q5')
        self.assertFalse(q['success']);self.assertTrue(q['claims'][0]['supported'])
        self.assertEqual(q['claims'][0]['movie_id'],'M001')
        self.assertEqual(ev.run_case(DATA,'Q1','narrow')['diagnosis'],'Retrieval gap')
        self.assertEqual(ev.run_case(DATA,'Q1','tight')['diagnosis'],'Context packing gap')
        r=ev.compare(DATA,'tight')['candidate']
        self.assertEqual(r['retrieval_recall'],1);self.assertEqual(r['context_recall'],.5)

    def test_judgments_do_not_leak_into_pipeline(self):
        changed=copy.deepcopy(DATA);changed['cases'][0]['gold']=['M006:summary']
        self.assertEqual(ev.run_case(changed)['trace'],ev.run_case(DATA)['trace'])
        self.assertFalse(ev.run_case(changed)['success'])
        changed=copy.deepcopy(DATA);changed['cases'].reverse()
        self.assertEqual(ev.compare(changed)['candidate'],ev.compare(DATA)['candidate'])

    def test_undefined_denominators(self):
        changed=copy.deepcopy(DATA);changed['configurations'][1]['budget']=0
        r=ev.compare(changed)['candidate']
        self.assertEqual(r['task_success'],2/8);self.assertIsNone(r['quote_support']);self.assertIsNone(r['answered_accuracy'])
        changed['cases']=[q for q in changed['cases'] if q['gold']]
        self.assertIsNone(ev.compare(changed,slice_name='missing')['candidate']['task_success'])

    def test_citation_audit_limits(self):
        self.assertEqual(ev.audit(DATA,'partial')['metrics']['required_fact_coverage'],.5)
        m=ev.audit(DATA,'wrong_citation')['metrics']
        self.assertEqual(m['context_support'],1);self.assertEqual(m['valid_citation_ids'],1);self.assertEqual(m['citation_precision'],0)
        self.assertIsNone(ev.audit(DATA,'uncited')['metrics']['citation_precision'])
        self.assertEqual(ev.audit(DATA,'wrong_movie')['metrics']['required_fact_coverage'],0)
        self.assertEqual(ev.audit(DATA,'fabricated')['metrics']['context_support'],0)

    def test_bad_input(self):
        for call in (lambda:ev.compare(DATA,'bad'),lambda:ev.compare(DATA,slice_name='bad'),lambda:ev.run_case(DATA,'Q99'),lambda:ev.audit(DATA,'bad')):
            with self.assertRaises(ValueError):call()
        changed=copy.deepcopy(DATA);changed['cases'][0]['gold']=['absent']
        with self.assertRaises(ValueError):ev.compare(changed)

if __name__=='__main__':unittest.main()
