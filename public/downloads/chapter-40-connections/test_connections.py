import copy
import itertools
import unittest
from connections import DATA, CHOICES, evaluate, propagate, standardize, query_reviews, entropy, normalize

class ConnectionsTests(unittest.TestCase):
    def test_propagation(self):
        self.assertEqual([n['final'] for n in propagate(1,'chain')['rows']],[.5,.25,0,0,.4])
        self.assertEqual([n['final'] for n in propagate(3,'chain')['rows']],[.3125,.234375,.09375,.03125,.4])
        self.assertEqual([n['final'] for n in propagate(1,'shortcut')['rows']],[.5,.25,0,.25,.4])
        self.assertEqual([n['final'] for n in propagate(0,'chain')['rows']],[1,0,0,0,.4])
        self.assertEqual(propagate(0,'chain')['updates'],[])

    def test_simultaneous_updates(self):
        changed=copy.deepcopy(DATA['graph'])
        changed['nodes'].reverse()
        self.assertEqual(propagate(3,'chain')['history'],propagate(3,'chain',changed)['history'])
        b=next(u for u in propagate(1,'chain')['updates'] if u['id']=='B')
        self.assertEqual((b['old'],b['neighborMean'],b['updated']),(0,.5,.25))

    def test_standardization(self):
        r=standardize('unbalanced',.5)
        self.assertEqual([r[k] for k in ['crudeWith','crudeWithout','crudeDifference']],[.68,.42,.26])
        self.assertEqual([r[k] for k in ['adjustedWith','adjustedWithout','adjustedDifference']],[.5,.6,-.1])
        self.assertEqual([g['difference'] for g in r['rows']],[-.1,-.1])
        self.assertEqual(standardize('balanced',.5)['crudeDifference'],-.1)

    def test_target_weights(self):
        lo,hi=standardize('unbalanced',.25),standardize('unbalanced',.75)
        self.assertEqual((lo['adjustedWith'],lo['adjustedWithout']),(.35,.45))
        self.assertEqual((hi['adjustedWith'],hi['adjustedWithout']),(.65,.75))
        self.assertEqual(lo['crudeDifference'],hi['crudeDifference'])

    def test_entropy_queries(self):
        self.assertEqual((entropy(0),entropy(1),entropy(.5)),(0,0,1))
        r=query_reviews('uncertain',2)
        self.assertEqual(r['selected'],['R1','R2'])
        self.assertEqual(r['meanEntropy'],.996387)
        self.assertEqual([q['id'] for q in r['rows']],['R1','R2','R3','R4','R6','R5'])
        self.assertTrue(all(q['annotation'] is None for q in r['rows'] if not q['selected']))
        c=query_reviews('confident',2)
        self.assertEqual(c['selected'],['R5','R6'])
        self.assertEqual(c['meanEntropy'],.111117)
        self.assertEqual(c['rows'][0]['annotation'],0)

    def test_annotations_are_excluded(self):
        changed=[{**r,'label':1-r['label']} for r in DATA['reviews']]
        for strategy in CHOICES['strategy']:
            a,b=query_reviews(strategy,2),query_reviews(strategy,2,changed)
            self.assertEqual(a['selected'],b['selected'])
            self.assertEqual([(r['id'],r['entropy']) for r in a['rows']],[(r['id'],r['entropy']) for r in b['rows']])

    def test_all_settings(self):
        count=0
        for values in itertools.product(*CHOICES.values()):
            c=dict(zip(CHOICES,values))
            r=evaluate(c)
            self.assertEqual(r['graph'],evaluate({k:c[k] for k in ['steps','topology']})['graph'])
            self.assertEqual(r['causal'],evaluate({k:c[k] for k in ['allocation','targetHigh']})['causal'])
            self.assertEqual(r['active'],evaluate({k:c[k] for k in ['strategy','budget']})['active'])
            self.assertEqual(len(r['graph']['history']),c['steps']+1)
            self.assertEqual(sum(q['annotation'] is not None for q in r['active']['rows']),c['budget'])
            count+=1
        self.assertEqual(count,144)

    def test_invalid(self):
        for c in [[],dict(steps=2),dict(steps=True),dict(targetHigh='0.5'),dict(allocation='randomized'),dict(strategy='labels'),dict(budget=0),dict(extra=1)]:
            with self.assertRaises(ValueError): normalize(c)

if __name__=='__main__': unittest.main()
