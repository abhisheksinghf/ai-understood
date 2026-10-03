import copy
import json
import math
import unittest
import supervised as s


class SupervisedTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((s.ROOT/'movie_learning.json').read_text(encoding='utf-8'))
        self.rows = s.validate_dataset(self.data)['train']

    def test_closed_form_and_hand_calculations(self):
        r = s.experiment(self.data)
        self.assertAlmostEqual(r['model']['w'], 13/7)
        self.assertAlmostEqual(r['model']['b'], 3)
        self.assertAlmostEqual(r['query']['prediction'], 55/14)
        self.assertAlmostEqual(r['reports']['train']['model']['mse'], 2/35)
        self.assertAlmostEqual(r['reports']['validation']['baseline']['mse'], 8/3)
        self.assertNotIn('test', r['reports'])

    def test_loss_and_sigmoid_numerical_stability(self):
        self.assertAlmostEqual(s.sigmoid(0), .5)
        self.assertAlmostEqual(s.sigmoid(1), .7310585786300049)
        self.assertAlmostEqual(s.logistic_loss(math.log(4), 1), -math.log(.8))
        for z in (-1000, 1000):
            self.assertTrue(0 <= s.sigmoid(z) <= 1)
            for y in (0, 1):
                self.assertTrue(math.isfinite(s.logistic_loss(z, y)))

    def test_gradient_matches_objective_and_fit_is_stationary(self):
        xs = [s.feature(r['history_like_fraction']) for r in self.rows]
        for strength in s.STRENGTHS:
            def objective(w, b):
                return s.mean([s.logistic_loss(w*x+b, r['liked']) for x, r in zip(xs, self.rows)])+strength*w*w/2
            w, b, h = .7, -.4, 1e-5
            errors = [s.sigmoid(w*x+b)-r['liked'] for x, r in zip(xs, self.rows)]
            self.assertAlmostEqual((objective(w+h,b)-objective(w-h,b))/(2*h), s.mean([e*x for e,x in zip(errors,xs)])+strength*w, places=8)
            self.assertAlmostEqual((objective(w,b+h)-objective(w,b-h))/(2*h), s.mean(errors), places=8)
            fitted = s.fit_model(self.rows, 'classification', strength)
            self.assertLess(objective(fitted['w'],fitted['b']), objective(0,0))
            self.assertLess(abs((objective(fitted['w']+h,fitted['b'])-objective(fitted['w']-h,fitted['b']))/(2*h)), 1e-7)

    def test_threshold_changes_decision_not_fit(self):
        a = s.experiment(self.data, 'classification', threshold=.5)
        b = s.experiment(self.data, 'classification', threshold=.9)
        self.assertEqual(a['model'], b['model'])
        self.assertEqual(a['query']['prediction'], b['query']['prediction'])
        self.assertEqual((a['query']['predicted_class'], b['query']['predicted_class']), (1, 0))
        self.assertEqual(a['reports']['validation']['model']['log_loss'], b['reports']['validation']['model']['log_loss'])
        p = a['query']['prediction']
        self.assertEqual(s.decide(p,p), 1)

    def test_held_out_edits_cannot_change_training(self):
        changed = copy.deepcopy(self.data)
        for row in changed['rows'][6:]:
            row.update(history_like_fraction=.33, rating=5, liked=1-row['liked'])
        for task in ('regression','classification'):
            a, b = s.experiment(self.data,task), s.experiment(changed,task)
            self.assertEqual(a['model'], b['model'])
            self.assertEqual(a['reports']['train'], b['reports']['train'])
            self.assertNotEqual(a['reports']['validation'], b['reports']['validation'])

    def test_labels_belong_to_their_own_task(self):
        changed = copy.deepcopy(self.data)
        for row in changed['rows'][:6]:
            row['liked'] = 1-row['liked']
        self.assertEqual(s.experiment(self.data)['model'], s.experiment(changed)['model'])
        self.assertNotEqual(s.experiment(self.data,'classification')['model'], s.experiment(changed,'classification')['model'])
        for row in changed['rows'][:6]:
            row['liked'] = 1-row['liked']
            row['rating'] = 5
        self.assertEqual(s.experiment(self.data,'classification')['model'], s.experiment(changed,'classification')['model'])

    def test_regularization_and_test_reporting(self):
        for task in ('regression','classification'):
            weights = [abs(s.experiment(self.data,task,strength)['model']['w']) for strength in s.STRENGTHS]
            self.assertGreater(weights[0],weights[1])
            self.assertGreater(weights[1],weights[2])
            self.assertIn('test',s.experiment(self.data,task,evaluate_test=True)['reports'])

    def test_invalid_data_and_controls(self):
        for field, value in [('history_like_fraction',None),('history_like_fraction',float('nan')),('rating',True),('liked',2),('split','unknown')]:
            changed = copy.deepcopy(self.data)
            changed['rows'][0][field] = value
            with self.assertRaises(ValueError):
                s.experiment(changed)
        changed = copy.deepcopy(self.data)
        changed['rows'][6]['viewer_id'] = 'V01'
        with self.assertRaises(ValueError):
            s.experiment(changed)
        changed = copy.deepcopy(self.data)
        changed['rows'].append(changed['rows'][0])
        with self.assertRaises(ValueError):
            s.experiment(changed)
        for kwargs in [dict(history=-.1),dict(threshold=float('inf')),dict(strength=-1),dict(task='unknown')]:
            with self.assertRaises(ValueError):
                s.experiment(self.data,**kwargs)

    def test_degenerate_training_and_no_mutation(self):
        original = copy.deepcopy(self.data)
        s.experiment(self.data,'classification')
        self.assertEqual(self.data,original)
        for row in self.rows:
            row['history_like_fraction'] = .5
        with self.assertRaises(ValueError):
            s.fit_model(self.rows)
        self.assertEqual(s.fit_model(self.rows,strength=1)['w'],0)
        for row in self.rows:
            row['liked'] = 0
        with self.assertRaises(ValueError):
            s.fit_model(self.rows,'classification')


if __name__ == '__main__':
    unittest.main()
