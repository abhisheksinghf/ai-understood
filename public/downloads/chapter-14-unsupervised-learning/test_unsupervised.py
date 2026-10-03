import copy
import json
import math
from pathlib import Path
import unittest

import unsupervised as u

DATA = json.loads((Path(__file__).parent/'movie_features.json').read_text(encoding='utf-8'))
POINTS = [[m['action'],m['humor']] for m in DATA['movies']]


class StructureTests(unittest.TestCase):
    def test_hand_calculated_default(self):
        r=u.experiment(DATA)
        self.assertEqual(r['state']['step'],1)
        self.assertEqual(r['trace'][0]['inertia'],75)
        self.assertAlmostEqual(r['state']['inertia'],307/6)
        self.assertEqual(r['state']['centers'],[[23/6,14/6],[2,9],[8.5,8.5]])
        self.assertEqual(r['state']['assignments'],[0,0,0,0,1,0,0,2,2])

    def test_all_configurations_reduce_objective_and_reach_means(self):
        original=copy.deepcopy(DATA)
        for k in (2,3):
            for start in ('spread','first'):
                for weight in (1,3):
                    r=u.experiment(DATA,k=k,start=start,humor_weight=weight)
                    self.assertEqual(r,u.experiment(DATA,k=k,start=start,humor_weight=weight))
                    points=[[x,y*weight] for x,y in POINTS]
                    for state in r['trace']:
                        self.assertEqual(state['assignments'],u.nearest(points,state['centers']))
                        self.assertEqual(len(state['assignments']),len(points))
                        self.assertTrue(all(0<=a<k for a in state['assignments']))
                        self.assertAlmostEqual(state['inertia'],sum(min(u.distance2(p,c) for c in state['centers']) for p in points))
                    for before,after in zip(r['trace'],r['trace'][1:]):
                        self.assertLessEqual(after['inertia'],before['inertia']+1e-10)
                    state=r['state']
                    self.assertTrue(state['converged'])
                    for j,center in enumerate(state['centers']):
                        group=[p for p,a in zip(points,state['assignments']) if a==j]
                        self.assertTrue(group)
                        for d in (0,1):
                            self.assertAlmostEqual(center[d],sum(p[d] for p in group)/len(group))
        self.assertEqual(DATA,original)

    def test_partial_steps_empty_groups_and_ties(self):
        points=[[x,y*3] for x,y in POINTS]
        full=u.cluster_trace(points,3,'first')
        self.assertEqual(len(full),4)
        self.assertFalse(full[1]['converged'])
        for steps in range(4):
            self.assertEqual(u.cluster_trace(points,3,'first',steps),full[:steps+1])
        self.assertEqual(u.nearest([[1,0]],[[0,0],[2,0]]),[0])
        identical=[[2,2],[2,2],[2,2]]
        last=u.cluster_trace(identical)[-1]
        self.assertEqual(last['clusters_found'],1)
        self.assertEqual(last['centers'],identical)
        self.assertEqual(last['inertia'],0)
        self.assertTrue(last['converged'])

    def test_initialization_and_label_permutations(self):
        spread=u.experiment(DATA)['state']
        first=u.experiment(DATA,start='first')['state']
        self.assertAlmostEqual(first['inertia'],166/3)
        self.assertNotEqual(spread['assignments'],first['assignments'])
        a=u.experiment(DATA,k=2,humor_weight=3)['state']['assignments']
        b=u.experiment(DATA,k=2,start='first',humor_weight=3)['state']['assignments']
        self.assertNotEqual(a,b)
        self.assertEqual([[x==y for y in a] for x in a],[[x==y for y in b] for x in b])

    def test_feature_weight_changes_geometry(self):
        self.assertEqual(u.distance2([2,3],[3,4]),2)
        self.assertEqual(u.distance2([2,9],[3,12]),10)
        a=u.experiment(DATA,k=2)['state']['assignments']
        b=u.experiment(DATA,k=2,humor_weight=3)['state']['assignments']
        self.assertNotEqual(a[4],a[7])
        self.assertEqual(b[4],b[7])
        self.assertEqual(u.experiment(DATA,mode='pca'),u.experiment(DATA,mode='pca',k=2,start='first',humor_weight=3,steps=0))

    def test_pca_hand_calculation_and_variance(self):
        r=u.fit_pca([[1,1],[2,2],[3,3]])
        self.assertEqual(r['center'],[2,2])
        for a in r['axis']:
            self.assertAlmostEqual(a,1/math.sqrt(2))
        self.assertAlmostEqual(r['scores'][2],math.sqrt(2))
        self.assertAlmostEqual(r['explained_ratio'],1)
        self.assertAlmostEqual(r['mean_squared_residual'],0)
        for p,q in zip([[1,1],[2,2],[3,3]],r['reconstructed']):
            for a,b in zip(p,q):
                self.assertAlmostEqual(a,b)

    def test_pca_projection_and_eigenvector_invariants(self):
        r=u.fit_pca(POINTS)
        self.assertAlmostEqual(sum(v*v for v in r['axis']),1)
        self.assertAlmostEqual(sum(r['scores']),0)
        self.assertAlmostEqual(r['explained_ratio'],.6997313492235084)
        self.assertAlmostEqual(r['mean_squared_residual'],r['eigenvalues'][1])
        self.assertEqual(max(range(len(POINTS)),key=lambda i:r['residuals'][i]),4)
        centered=[[p[d]-r['center'][d] for d in (0,1)] for p in POINTS]
        covariance=[[sum(p[i]*p[j] for p in centered)/len(POINTS) for j in (0,1)] for i in (0,1)]
        for d in (0,1):
            self.assertAlmostEqual(sum(covariance[d][j]*r['axis'][j] for j in (0,1)),r['eigenvalues'][0]*r['axis'][d])
        for p,q in zip(POINTS,r['reconstructed']):
            self.assertAlmostEqual(sum((p[d]-q[d])*r['axis'][d] for d in (0,1)),0)
        shifted=u.fit_pca([[x+11,y-5] for x,y in POINTS])
        for a,b in zip(r['scores'],shifted['scores']):
            self.assertAlmostEqual(a,b)

    def test_pca_edge_cases(self):
        self.assertEqual(u.fit_pca([[1,0],[-1,0],[0,1],[0,-1]])['axis'],[1,0])
        vertical=u.fit_pca([[2,1],[2,2],[2,3]])
        self.assertAlmostEqual(vertical['axis'][0],0)
        self.assertAlmostEqual(vertical['axis'][1],1)
        negative=u.fit_pca([[1,3],[2,2],[3,1]])
        self.assertGreater(negative['axis'][0],0)
        self.assertLess(negative['axis'][1],0)
        self.assertAlmostEqual(negative['mean_squared_residual'],0)
        for points in ([[1,1]],[[2,2],[2,2]]):
            with self.assertRaises(ValueError):
                u.fit_pca(points)

    def test_invalid_inputs_fail_explicitly(self):
        for value in (None,True,'3',float('nan'),float('inf'),-1,11):
            bad=copy.deepcopy(DATA)
            bad['movies'][0]['action']=value
            with self.assertRaises(ValueError):
                u.experiment(bad)
        for edit in ('duplicate','unknown','few','title'):
            bad=copy.deepcopy(DATA)
            if edit=='duplicate': bad['movies'][1]['id']='M001'
            if edit=='unknown': bad['movies'][0]['genre']='comedy'
            if edit=='few': bad['movies']=bad['movies'][:2]
            if edit=='title': bad['movies'][0]['title']=' '
            with self.assertRaises(ValueError): u.validate_dataset(bad)
        for steps in (-1,51,1.5,True):
            with self.assertRaises(ValueError): u.cluster_trace(POINTS,steps=steps)
        for k in (1,4,True):
            with self.assertRaises(ValueError): u.initial_state(POINTS,k=k)


if __name__=='__main__':
    unittest.main()
