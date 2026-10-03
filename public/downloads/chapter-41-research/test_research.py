import itertools
import unittest
from research import DATA,CHOICES,evaluate,normalize,audit,wilson,uncertainty,ablate
class ResearchTests(unittest.TestCase):
    def test_audit(self):
        a,b=audit('all','keep'),audit('all','exclude')
        keys=['baseline','candidate','n','difference','wins','losses','ties']
        self.assertEqual([a[k] for k in keys],[6,9,12,.25,4,1,7])
        self.assertEqual([b[k] for k in keys],[6,5,8,-.125,0,1,7])
        self.assertEqual([r['id'] for r in b['rows'] if not r['included']],['Q01','Q02','Q05','Q09'])
        self.assertEqual([{k:v for k,v in r.items() if k!='included'} for r in b['rows']],DATA['cases'])
    def test_slices(self):
        self.assertEqual(audit('facts','exclude')['difference'],-.5)
        self.assertEqual(audit('preferences','exclude')['difference'],0)
        self.assertEqual(audit('tools','exclude')['n'],3)
        empty=audit('facts','exclude',[{**r,'overlap':True} for r in DATA['cases']])
        self.assertEqual(empty['n'],0)
        self.assertIsNone(empty['difference'])
    def test_wilson(self):
        self.assertEqual(wilson(20,25),dict(rate=.8,low=.608687,high=.911395,width=.302709))
        self.assertEqual(wilson(0,0),dict(rate=None,low=None,high=None,width=None))
        self.assertEqual(wilson(0,10)['low'],0)
        self.assertEqual(wilson(10,10)['high'],1)
        for k,n in [(-1,10),(11,10),(1,0),(.5,1),(True,1)]:
            with self.assertRaises(ValueError): wilson(k,n)
    def test_precision(self):
        rows=uncertainty(100)['rows']
        self.assertEqual([r['rate'] for r in rows],[.8,.8,.8])
        self.assertEqual([r['width'] for r in rows],[.302709,.155465,.078235])
        self.assertEqual(uncertainty(400)['selected']['high'],.836264)
    def test_ablation(self):
        self.assertEqual(ablate('matched','retrieval')['ablated']['id'],'reranker')
        self.assertEqual(ablate('matched','retrieval')['contrast'],.19)
        self.assertEqual(ablate('matched','reranker')['contrast'],.09)
        self.assertEqual(ablate('matched','both')['contrast'],.24)
        self.assertEqual(ablate('matched','both')['interaction'],.04)
    def test_budget(self):
        a=ablate('unequal','retrieval')
        self.assertFalse(a['matched'])
        self.assertEqual(a['contrast'],.25)
        self.assertIsNone(a['interaction'])
        self.assertEqual(a['full']['budget'],3000)
        self.assertEqual(DATA['ablations'][-1]['passed'],84)
    def test_all_settings(self):
        n=0
        for values in itertools.product(*CHOICES.values()):
            c=dict(zip(CHOICES,values));r=evaluate(c)
            self.assertEqual(r['audit'],evaluate({k:c[k] for k in ['scope','overlap']})['audit'])
            self.assertEqual(r['uncertainty'],evaluate(dict(sample=c['sample']))['uncertainty'])
            self.assertEqual(r['ablation'],evaluate({k:c[k] for k in ['protocol','remove']})['ablation'])
            self.assertEqual(r['audit']['wins']+r['audit']['losses']+r['audit']['ties'],r['audit']['n'])
            n+=1
        self.assertEqual(n,144)
    def test_invalid(self):
        for c in [[],dict(scope='hidden'),dict(sample=0),dict(sample='25'),dict(sample=True),dict(overlap=False),dict(protocol='causal'),dict(remove='model'),dict(unknown=1)]:
            with self.assertRaises(ValueError): normalize(c)
if __name__=='__main__': unittest.main()
