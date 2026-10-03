import copy
import itertools
import unittest
from applications import DATA, CHOICES, evaluate, iou, detect, recommend, backtest, normalize

class ApplicationsTests(unittest.TestCase):
    def test_geometry_and_matching(self):
        self.assertEqual(iou([0,0,10,10],[0,0,10,10]),1)
        self.assertEqual(iou([0,0,10,10],[20,0,30,10]),0)
        self.assertAlmostEqual(iou([0,0,10,10],[2,0,12,10]),2/3)
        r=detect(.6)
        self.assertEqual([r[k] for k in ['tp','fp','fn','precision','recall']],[3,2,1,.6,.75])
        self.assertEqual(next(p for p in r['rows'] if p['id']=='P2')['outcome'],'FP: duplicate')
        self.assertEqual(r['missed'],['B2'])
        self.assertEqual(detect(.3)['recall'],1)
        self.assertEqual([detect(.9)[k] for k in ['tp','fp','fn']],[1,1,3])
        self.assertIsNone(detect(1)['precision'])

    def test_ranking_and_position(self):
        r=recommend(.5,2)
        self.assertEqual([m['id'] for m in r['rows']],['M003','M005','M002','M004','M006'])
        self.assertEqual(r['rows'][0]['score'],.75)
        self.assertEqual((r['precision'],r['recall'],r['ndcg']),(.5,.5,.613147))
        self.assertEqual(recommend(0,2)['ndcg'],.386853)
        self.assertEqual(recommend(.5,3)['ndcg'],.919721)
        self.assertEqual([m['id'] for m in r['excluded']],['M001','M007'])

    def test_relevance_is_evaluator_only(self):
        changed=copy.deepcopy(DATA['recommendations'])
        for m in changed['movies']: m['relevant']=False
        r=recommend(.5,2,changed)
        self.assertEqual([(m['id'],m['score']) for m in r['rows']],[(m['id'],m['score']) for m in recommend(.5,2)['rows']])
        self.assertIsNone(r['recall'])
        self.assertIsNone(r['ndcg'])

    def test_forecast_arithmetic(self):
        r=backtest('seasonal7')
        self.assertEqual((r['mae'],r['rmse']),(5,5))
        self.assertEqual(r['rows'][0],dict(day=15,origin=14,sourceDays=[8],prediction=45,actual=50,error=5))
        self.assertEqual(backtest('last')['mae'],22.142857)
        self.assertEqual(backtest('mean3')['mae'],31.904762)
        self.assertEqual(backtest('last')['rows'][1]['prediction'],50)

    def test_information_cutoff(self):
        changed=DATA['demand'][:]
        changed[14:]=[v+1000 for v in changed[14:]]
        for method in CHOICES['forecast']:
            self.assertEqual(backtest(method,changed,15)['rows'][0]['prediction'],backtest(method)['rows'][0]['prediction'])
            for row in backtest(method)['rows']:
                self.assertTrue(all(d<=row['origin'] and d<row['day'] for d in row['sourceDays']))

    def test_all_settings(self):
        count=0
        for values in itertools.product(*CHOICES.values()):
            c=dict(zip(CHOICES,values))
            r=evaluate(c)
            self.assertEqual(r['vision']['tp']+r['vision']['fn'],4)
            self.assertEqual(r['vision']['tp']+r['vision']['fp'],len(r['vision']['rows']))
            self.assertEqual(sum(m['selected'] for m in r['recommendations']['rows']),c['k'])
            self.assertTrue(0<=r['recommendations']['ndcg']<=1)
            self.assertEqual(r['vision'],evaluate(dict(threshold=c['threshold']))['vision'])
            self.assertEqual(r['forecast'],evaluate(dict(forecast=c['forecast']))['forecast'])
            count+=1
        self.assertEqual(count,54)

    def test_invalid(self):
        for c in [[],dict(threshold=0),dict(weight='0.5'),dict(k=0),dict(k=True),dict(forecast='future'),dict(extra=1)]:
            with self.assertRaises(ValueError): normalize(c)

if __name__=='__main__': unittest.main()
