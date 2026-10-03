import copy
import json
import math
import unittest
from prepare_data import ROOT, read_csv, clean_rows, split_rows, fit_preprocessor, prepare_data

RAW = read_csv(ROOT/'raw_watch_events.csv')
PLAN = json.loads((ROOT/'split_plan.json').read_text(encoding='utf-8'))


class PreparationTests(unittest.TestCase):
    def test_audit_counts_and_normalization(self):
        result = prepare_data(RAW, PLAN)
        audit = result['audit']
        self.assertEqual((audit['raw_rows'], audit['kept_rows'], audit['duplicate_rows'], len(audit['quarantined']), len(audit['unlabeled'])), (13, 10, 1, 1, 1))
        self.assertEqual(result['splits']['train'][0]['genre'], 'adventure')
        self.assertEqual(audit['quarantined'][0]['event_id'], 'E11')
        self.assertEqual(audit['unlabeled'][0]['event_id'], 'E12')

    def test_hand_calculated_medians_and_mean(self):
        r = prepare_data(RAW, PLAN)
        self.assertEqual(r['state']['fill_value'], 110)
        self.assertAlmostEqual(r['state']['runtime_mean'], 670/6)
        self.assertAlmostEqual(r['prepared']['train']['X'][3][0], -0.1118033988749898)
        self.assertEqual(prepare_data(RAW, PLAN, 'mean')['state']['fill_value'], 112.5)
        self.assertEqual(prepare_data(RAW, PLAN, scope='all')['state']['fill_value'], 127.5)

    def test_group_isolation_and_fixed_shapes(self):
        r = prepare_data(RAW, PLAN)
        groups = [set(part['viewer_ids']) for part in r['prepared'].values()]
        self.assertFalse(groups[0] & groups[1] or groups[0] & groups[2] or groups[1] & groups[2])
        self.assertEqual([len(p['X']) for p in r['prepared'].values()], [6, 2, 2])
        self.assertEqual(len(r['state']['feature_names']), 8)
        for part in r['prepared'].values():
            for x in part['X']:
                self.assertEqual(len(x), 8)
                self.assertEqual(sum(x[2:]), 1)
                self.assertTrue(all(math.isfinite(v) for v in x))

    def test_held_out_changes_cannot_change_training_fit(self):
        edited = copy.deepcopy(RAW)
        for row in edited:
            if row['viewer_id'] in ['U04', 'U05']:
                row['runtime_minutes'] = '500'
                row['genre'] = 'fantasy'
        a, b = prepare_data(RAW, PLAN), prepare_data(edited, PLAN)
        self.assertEqual(a['state'], b['state'])
        self.assertEqual(a['prepared']['train'], b['prepared']['train'])
        self.assertNotEqual(prepare_data(RAW, PLAN, scope='all')['state'], prepare_data(edited, PLAN, scope='all')['state'])

    def test_target_and_future_review_are_not_features(self):
        edited = copy.deepcopy(RAW)
        for row in edited:
            if row['liked']:
                row['liked'] = str(1-int(row['liked']))
            row['review_after'] = 'Changed future review'
        a, b = prepare_data(RAW, PLAN), prepare_data(edited, PLAN)
        self.assertEqual(a['state'], b['state'])
        for split in ['train', 'validation', 'test']:
            self.assertEqual(a['prepared'][split]['X'], b['prepared'][split]['X'])
            self.assertNotEqual(a['prepared'][split]['y'], b['prepared'][split]['y'])

    def test_unknown_category_and_missing_indicator(self):
        r = prepare_data(RAW, PLAN)
        self.assertEqual(r['prepared']['validation']['X'][0][-1], 1)
        self.assertEqual(r['prepared']['train']['X'][3][1], 1)
        self.assertIsNone(r['splits']['train'][3]['runtime_minutes'])

    def test_conflicting_valid_events_quarantined(self):
        rows = copy.deepcopy(RAW[:10])
        rows.append({**rows[0], 'liked': '0'})
        cleaned = clean_rows(rows)
        self.assertEqual(len(cleaned['audit']['quarantined']), 2)
        self.assertEqual(len(cleaned['rows']), 9)
        self.assertNotIn('E01', [r['event_id'] for r in cleaned['rows']])

    def test_distinct_events_not_deduplicated_by_movie(self):
        rows = copy.deepcopy(RAW[:10])
        rows.append({**rows[0], 'event_id': 'E13'})
        self.assertEqual(len(clean_rows(rows)['rows']), 11)

    def test_invalid_splits_and_options(self):
        bad = copy.deepcopy(PLAN);bad['test'].append('U01')
        with self.assertRaises(ValueError):
            prepare_data(RAW, bad)
        bad = copy.deepcopy(PLAN);bad['train'].remove('U01')
        with self.assertRaises(ValueError):
            prepare_data(RAW, bad)
        for kwargs in [{'strategy': 'mode'}, {'scope': 'test'}]:
            with self.assertRaises(ValueError):
                prepare_data(RAW, PLAN, **kwargs)

    def test_all_missing_and_constant_training_runtime(self):
        train = split_rows(clean_rows(RAW)['rows'], PLAN)['train']
        for row in train:
            row['runtime_minutes'] = None
        with self.assertRaises(ValueError):
            fit_preprocessor(train)
        for row in train:
            row['runtime_minutes'] = 105
        state = fit_preprocessor(train)
        self.assertEqual((state['runtime_std'], state['runtime_scale']), (0, 1))

    def test_no_mutation_and_csv_json_agreement(self):
        before = copy.deepcopy(RAW)
        prepare_data(RAW, PLAN)
        self.assertEqual(RAW, before)
        self.assertEqual(RAW, json.loads((ROOT/'raw_watch_events.json').read_text(encoding='utf-8')))


if __name__ == '__main__':
    unittest.main()
