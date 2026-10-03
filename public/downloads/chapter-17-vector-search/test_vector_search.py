import copy
import json
import math
from pathlib import Path
import unittest
from vector_search import experiment,cosine,dot,distance,unit,validate_snapshot

DATA=json.loads(Path(__file__).with_name('vectors.json').read_text(encoding='utf-8'))
def ids(r):return [d['id'] for d in r['results']]


class VectorTests(unittest.TestCase):
    def test_arithmetic(self):
        self.assertAlmostEqual(cosine([1,0,0],[.9,.1,0]),.9/math.sqrt(.82))
        self.assertAlmostEqual(distance([1,0,0],[.9,.1,0]),math.sqrt(.02))
        self.assertEqual(ids(experiment(DATA)),['M004','M008','M007'])
        self.assertEqual(ids(experiment(DATA,metric='dot')),['M002','M008','M004'])
        self.assertEqual(ids(experiment(DATA,metric='euclidean')),['M004','M007','M008'])

    def test_normalization(self):
        for q in ['space','funny','quiet']:
            expected={d['id']:d['value'] for d in experiment(DATA,q,normalization='unit',k=8)['results']}
            for m in ['dot','euclidean']:
                rows=experiment(DATA,q,m,'unit',k=8)['results']
                for row in rows:
                    c=expected[row['id']]
                    self.assertAlmostEqual(row['value'] if m=='dot' else row['value']**2,c if m=='dot' else 2-2*c)
                scores=[expected[d['id']] for d in rows]
                self.assertTrue(all(a+1e-12>=b for a,b in zip(scores,scores[1:])))
        a,b=unit([.2,.8,1]),unit([.6,.4,.1])
        self.assertAlmostEqual(dot(a,b),cosine(a,b))
        self.assertAlmostEqual(distance(a,b)**2,2-2*dot(a,b))
        modified=copy.deepcopy(DATA);modified['movies'][6]['vector']=[8,2,0]
        self.assertEqual(ids(experiment(modified,k=8)),ids(experiment(DATA,k=8)))
        self.assertEqual(experiment(modified,metric='dot')['results'][0]['id'],'M007')

    def test_coarse_search(self):
        one=experiment(DATA,mode='probe1');two=experiment(DATA,mode='probe2')
        self.assertEqual(ids(one),['M004','M008'])
        self.assertEqual(one['index']['searched_candidates'],2)
        self.assertEqual(one['audit']['neighbor_recall_at_k'],2/3)
        self.assertEqual(ids(two),ids(experiment(DATA)))
        self.assertEqual(two['index']['searched_candidates'],7)
        for q in ['space','funny','quiet']:
            for limit in ['all','under120']:
                self.assertEqual(experiment(DATA,q,mode='probe3',limit=limit,k=5)['results'],experiment(DATA,q,limit=limit,k=5)['results'])

    def test_denominators(self):
        r=experiment(DATA,mode='probe1',limit='under120')
        self.assertEqual(r['audit']['exact_ids'],['M004','M008','M003'])
        self.assertEqual(r['audit']['neighbor_recall_at_k'],2/3)
        self.assertEqual(r['evaluation']['recall_at_k'],1)
        self.assertEqual(r['evaluation']['precision_at_k'],2/3)
        d=experiment(DATA,metric='dot')
        self.assertEqual(d['audit']['neighbor_recall_at_k'],1)
        self.assertEqual(d['evaluation']['recall_at_k'],2/3)
        modified=copy.deepcopy(DATA)
        for movie in modified['movies']:movie['runtime_minutes']=None
        empty=experiment(modified,limit='under120')
        self.assertEqual(empty['results'],[])
        self.assertIsNone(empty['audit']['neighbor_recall_at_k'])
        self.assertIsNone(empty['evaluation']['recall_at_k'])

    def test_label_isolation_and_baseline(self):
        modified=copy.deepcopy(DATA);modified['queries'][0]['relevant']=[]
        self.assertEqual(experiment(modified)['results'],experiment(DATA)['results'])
        self.assertAlmostEqual(experiment(DATA)['lexical']['results'][0]['score'],2.1862975961787265)
        funny=experiment(DATA,'funny',k=1)
        self.assertEqual(funny['evaluation']['precision_at_k'],0)
        self.assertEqual(funny['lexical']['evaluation']['precision_at_k'],1)

    def test_contract_errors(self):
        for v in [[0,0,0],[1,2],[1,float('nan'),0],[1,float('inf'),0],[True,1,0]]:
            modified=copy.deepcopy(DATA);modified['movies'][0]['vector']=v
            with self.assertRaises(ValueError):validate_snapshot(modified)
        modified=copy.deepcopy(DATA);modified['queries'][0]['space_id']='other-3d-space'
        with self.assertRaises(ValueError):validate_snapshot(modified)
        for args in [{'metric':'dot','mode':'probe1'},{'query_id':'unknown'},{'k':0},{'k':True}]:
            with self.assertRaises(ValueError):experiment(DATA,**args)


if __name__=='__main__':unittest.main()
