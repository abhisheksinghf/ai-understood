import copy
import math
import unittest
from lifecycle import softmax,examples,initial,loss_gradient,train,generate


class LifecycleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.run_default=train()

    def test_targets(self):
        self.assertEqual(sum(map(len,examples())),30)
        self.assertEqual(sum(map(len,examples('sft','all'))),28)
        rows=examples('sft')[0]
        self.assertEqual([r['selected'] for r in rows],[False,False,False,True,True,True,True])
        self.assertEqual(rows[3]['context'],'comedy <assistant>')
        self.assertEqual(rows[-1]['target'],'<eos>')

    def test_baseline(self):
        self.assertAlmostEqual(loss_gradient(initial(),examples())['loss'],math.log(15))
        self.assertEqual(softmax([1000,1000]),[.5,.5])
        self.assertEqual(softmax([-1000,-1000]),[.5,.5])

    def test_gradient(self):
        for mask in ('reply','all'):
            ds=examples('sft',mask)
            w=copy.deepcopy(self.run_default['checkpoints']['pretrained'])
            g=loss_gradient(w,ds)['gradient']
            for key,j in [('comedy <assistant>',11),('<bos> <bos>',1),('Map .',0)]:
                old,e=w[key][j],1e-5
                w[key][j]=old+e
                a=loss_gradient(w,ds)['loss']
                w[key][j]=old-e
                b=loss_gradient(w,ds)['loss']
                w[key][j]=old
                self.assertAlmostEqual(g[key][j],(a-b)/(2*e),places=8)

    def test_optimization(self):
        for mask in ('reply','all'):
            for steps in (20,80):
                r=train(mask,steps)
                for history in r['history'].values():
                    self.assertLess(history[-1]['loss'],history[0]['loss'])
                    for a,b in zip(history,history[1:]): self.assertLessEqual(b['loss'],a['loss']+1e-12)

    def test_checkpoint(self):
        r=train(steps=0)
        self.assertEqual(r['checkpoints']['pretrained'],r['checkpoints']['adapted'])
        r['checkpoints']['adapted']['<bos> <bos>'][0]+=1
        self.assertNotEqual(r['checkpoints']['pretrained'],r['checkpoints']['adapted'])

    def test_mask_effect(self):
        r,a=self.run_default,train('all')
        self.assertEqual(r['sft_targets'],16)
        self.assertEqual(a['sft_targets'],28)
        self.assertAlmostEqual(r['stages'][1]['pretrain_loss'],r['stages'][2]['pretrain_loss'])
        self.assertGreater(a['stages'][2]['pretrain_loss'],a['stages'][1]['pretrain_loss'])
        self.assertEqual(r['checkpoints']['pretrained']['<bos> <bos>'],r['checkpoints']['adapted']['<bos> <bos>'])

    def test_generation(self):
        w=self.run_default['checkpoints']['adapted']
        self.assertEqual(generate(w)['tokens'],['Moonlight','Map','.','<eos>'])
        self.assertEqual(generate(w,'drama')['tokens'],['Quiet','Harbor','.','<eos>'])
        self.assertEqual(generate(w,limit=1)['stop'],'Token limit')
        self.assertEqual(generate(w,limit=4)['stop'],'End token')

    def test_frozen_weights(self):
        w=copy.deepcopy(self.run_default['checkpoints']['adapted'])
        snapshot=copy.deepcopy(w)
        a,b=generate(w,temperature=.75),generate(w,temperature=1.5)
        self.assertEqual(a['tokens'],b['tokens'])
        self.assertNotEqual(a['trace'][0]['probabilities'],b['trace'][0]['probabilities'])
        self.assertEqual(w,snapshot)

    def test_sampling(self):
        a=generate(initial(),method='sample')
        self.assertEqual(a,generate(initial(),method='sample'))
        self.assertAlmostEqual(a['trace'][0]['draw'],1083814273/2**32)
        self.assertTrue(any(not r['known_context'] for r in a['trace']))
        for r in a['trace']:
            for p in r['probabilities']: self.assertAlmostEqual(p,1/15)

    def test_options(self):
        for a in [('bad',80),('reply',1)]:
            with self.assertRaises(ValueError): train(*a)
        for a in [('bad',),('comedy','bad'),('comedy','greedy',0),('comedy','greedy',1,0)]:
            with self.assertRaises(ValueError): generate(initial(),*a)


if __name__=='__main__': unittest.main()
