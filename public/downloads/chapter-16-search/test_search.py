import copy
import json
import math
from pathlib import Path
import unittest
from search import build_index, ranking_metrics, search, term_weight, tokenize

DATA = json.loads(Path(__file__).with_name('movies.json').read_text(encoding='utf-8'))


class SearchTests(unittest.TestCase):
    def test_postings(self):
        index = build_index(DATA)
        self.assertEqual(index['average_length'], 94/8)
        self.assertEqual(len(index['postings']['space']), 3)
        self.assertEqual(index['postings']['space']['M008'], [1, 9])
        self.assertEqual(tokenize('Space, RESCUE!'), ['space', 'rescue'])

    def test_scores(self):
        r = search(DATA)
        self.assertEqual([d['id'] for d in r['results']], ['M008', 'M004', 'M005'])
        self.assertAlmostEqual(r['results'][1]['score'], 1.743859411164185)
        t = search(DATA, method='tfidf')['results'][1]
        self.assertAlmostEqual(t['score'], math.log(8/3) + math.log(2))
        self.assertEqual([d['id'] for d in search(DATA, method='overlap')['results']], ['M004', 'M008', 'M001'])

    def test_matching(self):
        self.assertEqual([d['id'] for d in search(DATA, mode='all')['results']], ['M008', 'M004'])
        self.assertEqual(search(DATA, 'space unknownword', mode='all')['results'], [])
        self.assertEqual([d['id'] for d in search(DATA, 'space unknownword')['results']], [d['id'] for d in search(DATA, 'space')['results']])
        self.assertEqual(search(DATA, '')['results'], [])
        self.assertEqual(search(DATA, 'hilarious quest')['results'], [])

    def test_filter_and_statistics(self):
        a = search(DATA, 'rescue', k=10)
        b = search(DATA, 'rescue', limit='under120', k=10)
        self.assertIn('M002', [d['id'] for d in a['results']])
        self.assertNotIn('M002', [d['id'] for d in b['results']])
        self.assertEqual(search(DATA, 'astronauts', limit='under120')['results'], [])
        for d in b['results']:
            self.assertEqual(d['score'], next(x['score'] for x in a['results'] if x['id'] == d['id']))
        self.assertEqual(search(DATA, limit='under120')['evaluation']['recall_at_k'], 1)

    def test_label_isolation_and_duplicates(self):
        modified = copy.deepcopy(DATA)
        modified['queries'][0]['relevant'] = []
        self.assertEqual(search(modified)['results'], search(DATA)['results'])
        self.assertIsNone(search(modified)['evaluation']['recall_at_k'])
        self.assertEqual(search(DATA, 'space space rescue')['results'], search(DATA)['results'])
        self.assertIsNone(search(DATA, 'new words')['evaluation'])
        common = search(DATA, 'a', method='tfidf', k=10)
        self.assertEqual(len(common['results']), 8)
        self.assertTrue(all(d['score'] == 0 for d in common['results']))

    def test_bm25_limits(self):
        def s(tf):
            return term_weight('bm25', tf, 3, 8, 10, 10)
        self.assertGreater(s(2)-s(1), s(3)-s(2))
        self.assertGreater(s(3), s(2))
        self.assertEqual(term_weight('bm25', 2, 3, 8, 10, 10, 0, 1), term_weight('bm25', 100, 3, 8, 30, 10, 0, 1))
        self.assertEqual(term_weight('bm25', 1, 3, 8, 10, 10, 1.2, 0), term_weight('bm25', 1, 3, 8, 30, 10, 1.2, 0))
        self.assertGreater(term_weight('bm25', 1, 3, 8, 10, 10), term_weight('bm25', 1, 3, 8, 30, 10))
        self.assertEqual(term_weight('bm25', 0, 3, 8, 10, 10, 0, 0), 0)

    def test_metrics(self):
        r = ranking_metrics(['a', 'b'], ['b', 'c'], 3)
        self.assertEqual((r['precision_at_k'], r['recall_at_k'], r['reciprocal_rank_at_k']), (1/3, .5, .5))
        self.assertIsNone(ranking_metrics([], [], 3)['recall_at_k'])
        self.assertEqual(search(DATA, mode='all')['evaluation']['precision_at_k'], 2/3)

    def test_invalid_inputs(self):
        for options in ({'method':'bad'}, {'k':0}, {'k':True}, {'k1':float('nan')}, {'b':1.1}, {'query':'x'*201}):
            with self.assertRaises(ValueError):
                search(DATA, **options)
        for change in ('duplicate', 'missing', 'judgment'):
            modified = copy.deepcopy(DATA)
            if change == 'duplicate':
                modified['movies'][1]['id'] = 'M001'
            elif change == 'missing':
                del modified['movies'][0]['runtime_minutes']
            else:
                modified['queries'][0]['relevant'] = ['M999']
            with self.assertRaises(ValueError):
                search(modified)


if __name__ == '__main__':
    unittest.main()
