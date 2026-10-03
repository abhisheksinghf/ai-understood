import copy
import json
import math
from pathlib import Path
import random
import unittest

import evaluate as e

DATA=json.loads((Path(__file__).parent/'movie_predictions.json').read_text(encoding='utf-8'))


class EvaluationTests(unittest.TestCase):
    def test_worked_counts_and_metrics(self):
        r=e.experiment(DATA)['validation']
        self.assertEqual(r['confusion'],{'tp':3,'fp':2,'tn':7,'fn':0})
        self.assertEqual(r['accuracy'],10/12)
        self.assertEqual(r['precision'],3/5)
        self.assertEqual(r['recall'],1)
        self.assertEqual(r['f1'],.75)
        self.assertEqual(r['total_cost'],2)
        self.assertAlmostEqual(r['auc'],25/27)
        self.assertAlmostEqual(r['brier'],.14375)
        self.assertAlmostEqual(r['log_loss'],.44854381798435927)

    def test_threshold_changes_decisions_not_probability_metrics(self):
        for candidate in ('a','b','baseline'):
            before=None
            for i in range(21):
                r=e.experiment(DATA,candidate,i/20)['validation']
                if before:
                    self.assertLessEqual(r['confusion']['tp'],before['confusion']['tp'])
                    self.assertLessEqual(r['confusion']['fp'],before['confusion']['fp'])
                    for key in ('auc','log_loss','brier'):
                        self.assertEqual(r[key],before[key])
                self.assertEqual(sum(r['confusion'].values()),12)
                before=r
        baseline=e.experiment(DATA,'baseline',.25)['validation']
        self.assertEqual(baseline['confusion']['tp'],3)
        self.assertEqual(baseline['confusion']['fp'],9)

    def test_undefined_ratios_and_endpoint_probabilities(self):
        r=e.experiment(DATA,'baseline')['validation']
        self.assertEqual(r['accuracy'],.75)
        self.assertIsNone(r['precision'])
        self.assertEqual(r['recall'],0)
        self.assertEqual(r['f1'],0)
        self.assertEqual(r['auc'],.5)
        rows=copy.deepcopy(DATA['rows'][:4])
        for row in rows: row['liked']=0;row['a']=0
        r=e.evaluate_rows(rows)
        for key in ('precision','recall','f1','auc','roc','balanced_accuracy'):
            self.assertIsNone(r[key])
        rows[0]['liked']=1
        rows[1]['a']=1
        r=e.evaluate_rows(rows)
        self.assertTrue(math.isfinite(r['log_loss']))
        self.assertEqual(r['rows'][0]['probability'],0)
        self.assertEqual(r['rows'][1]['probability'],1)
        self.assertEqual(r['brier'],.5)

    def test_roc_agrees_with_independent_pairwise_auc_and_ties(self):
        rng=random.Random(15)
        for _ in range(30):
            rows=copy.deepcopy(DATA['rows'][:6])
            for i,row in enumerate(rows): row['liked']=i%2;row['a']=rng.choice([.1,.3,.5,.8])
            r=e.evaluate_rows(rows)
            pos=[row['a'] for row in rows if row['liked']]
            neg=[row['a'] for row in rows if not row['liked']]
            expected=sum(1 if p>n else .5 if p==n else 0 for p in pos for n in neg)/(len(pos)*len(neg))
            self.assertAlmostEqual(r['auc'],expected)
            self.assertEqual(e.evaluate_rows(list(reversed(rows)))['roc'],r['roc'])
            self.assertEqual(r['roc'][0],{'fpr':0,'tpr':0})
            self.assertEqual(r['roc'][-1],{'fpr':1,'tpr':1})

    def test_cost_choice_changes_the_selected_policy(self):
        for cost,candidate,threshold in [('misses','a',.6),('unwanted','b',.7),('equal','a',.6)]:
            r=e.experiment(DATA,cost=cost)
            winner=r['selection']['winner']
            self.assertEqual((winner['candidate'],winner['threshold']),(candidate,threshold))
            self.assertEqual(winner['total_cost'],1)
            self.assertEqual(len(r['selection']['comparison']),10)
            self.assertEqual(winner['total_cost'],min(row['total_cost'] for row in r['selection']['comparison']))
        a=e.experiment(DATA,'a',.6)['validation']
        b=e.experiment(DATA,'b',.7)['validation']
        self.assertEqual(a['accuracy'],b['accuracy'])
        self.assertEqual((a['total_cost'],b['total_cost']),(1,3))

    def test_slices_partition_events_without_changing_selection(self):
        all_rows=e.experiment(DATA)
        short=e.experiment(DATA,slice_name='short')
        long=e.experiment(DATA,slice_name='long')
        self.assertEqual((short['validation']['n'],long['validation']['n']),(6,6))
        self.assertEqual(short['validation']['accuracy'],4/6)
        self.assertEqual(long['validation']['accuracy'],1)
        for key in ('tp','fp','tn','fn'):
            self.assertEqual(short['validation']['confusion'][key]+long['validation']['confusion'][key],all_rows['validation']['confusion'][key])
        self.assertEqual(short['selection'],all_rows['selection'])
        self.assertEqual(long['selection'],all_rows['selection'])

    def test_test_labels_cannot_influence_selection(self):
        changed=copy.deepcopy(DATA)
        for row in changed['rows']:
            if row['split']=='test': row['liked']=1-row['liked'];row['a']=1-row['a']
        self.assertEqual(e.experiment(DATA),e.experiment(changed))
        a=e.experiment(DATA,evaluate_test=True)
        b=e.experiment(changed,evaluate_test=True)
        self.assertEqual(a['selection'],b['selection'])
        self.assertNotEqual(a['final_test']['report'],b['final_test']['report'])
        self.assertEqual(a['final_test']['configuration'],{'candidate':'a','threshold':.6,'cost':'misses'})
        manual=e.experiment(DATA,'baseline',1,'short',evaluate_test=True)
        self.assertEqual(manual['final_test'],a['final_test'])
        self.assertNotIn('final_test',e.experiment(DATA))

    def test_repeatable_without_mutating_inputs_and_baseline_is_from_training(self):
        original=copy.deepcopy(DATA)
        a=e.experiment(DATA)
        self.assertEqual(a,e.experiment(DATA))
        self.assertEqual(DATA,original)
        changed=copy.deepcopy(DATA)
        for row in changed['rows']:
            if row['split']=='validation': row['liked']=0
        self.assertEqual(e.experiment(changed)['baseline_probability'],.25)

    def test_invalid_inputs_fail_explicitly(self):
        for value in (None,True,'0.5',float('nan'),float('inf'),-.1,1.1):
            bad=copy.deepcopy(DATA);bad['rows'][0]['a']=value
            with self.assertRaises(ValueError): e.experiment(bad)
        for threshold in (float('nan'),float('inf'),-.1,1.1,True):
            with self.assertRaises(ValueError): e.experiment(DATA,threshold=threshold)
        for problem in ('viewer','id','label','summary','extra','split'):
            bad=copy.deepcopy(DATA)
            if problem=='viewer': bad['rows'][-1]['viewer_id']='V001'
            if problem=='id': bad['rows'][1]['event_id']='E001'
            if problem=='label': bad['rows'][0]['liked']=True
            if problem=='summary': bad['training_summary']['total']=0
            if problem=='extra': bad['rows'][0]['future_feature']=4
            if problem=='split': bad['rows']=[r for r in bad['rows'] if r['split']=='test']
            with self.assertRaises(ValueError): e.experiment(bad)
        bad=copy.deepcopy(DATA)
        for r in bad['rows']: r['prior_ratings']=10
        with self.assertRaises(ValueError): e.experiment(bad,slice_name='short')


if __name__=='__main__':
    unittest.main()
