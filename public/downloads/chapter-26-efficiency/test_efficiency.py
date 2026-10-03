import unittest
from efficiency import memory, compression, quantize, round_away


class EfficiencyTests(unittest.TestCase):
    def test_default_memory(self):
        r = memory()
        self.assertEqual(r['weightsBytes'], 14e9)
        self.assertEqual(r['cachePerToken'], 131072)
        self.assertEqual(r['cacheBytes'], 536870912)
        self.assertEqual(r['totalBytes'], 16684354560)
        self.assertTrue(r['withinEstimate'])
        self.assertEqual(r['maxSequences'], 1)

    def test_units_and_reserve(self):
        self.assertAlmostEqual(memory()['gib']['weights'], 14e9/2**30)
        self.assertEqual(memory()['reserveBytes'], 2*2**30)
        self.assertEqual(memory(budget=8)['maxSequences'], 0)

    def test_length_and_concurrency(self):
        self.assertEqual(memory(batch=4)['cacheBytes'], 4*memory()['cacheBytes'])
        self.assertEqual(memory(tokens=8192)['cacheBytes'], 2*memory()['cacheBytes'])
        self.assertEqual(memory(batch=8)['weightsBytes'], memory()['weightsBytes'])

    def test_cache_heads_and_precision(self):
        self.assertEqual(memory(kv_heads=32)['gib']['cache'], 2)
        self.assertEqual(memory(kv_heads=1)['gib']['cache'], .0625)
        self.assertEqual(memory(cache_bits=8)['gib']['cache'], .25)
        self.assertFalse(memory(kv_heads=32)['withinEstimate'])

    def test_weight_precision_and_headroom(self):
        self.assertEqual(memory(weight_bits=4)['weightsBytes'], 3.5e9)
        self.assertEqual(memory(weight_bits=4)['cacheBytes'], memory()['cacheBytes'])
        self.assertLess(memory(kv_heads=32)['headroomBytes'], 0)
        self.assertEqual(memory(weight_bits=4)['maxSequences'], 21)

    def test_codes_and_rounding(self):
        self.assertEqual([r['code'] for r in compression()['rows']], [-7,-3,-1,1,3,7])
        self.assertEqual([round_away(x) for x in [.5,-.5,-1.5]], [1,-1,-2])

    def test_zero_and_storage(self):
        self.assertEqual([r['code'] for r in quantize([0,0])['rows']], [0,0])
        self.assertEqual(quantize([0,0])['scales'], [1])
        self.assertAlmostEqual(quantize([3])['rows'][0]['restored'], 3)
        self.assertEqual(quantize([1,2,3],4,2)['totalBytes'], 10)
        self.assertEqual(compression()['totalBytes'], 7)
        self.assertEqual(compression(grouping='pairs')['totalBytes'], 15)

    def test_worked_score(self):
        q = compression()
        self.assertAlmostEqual(q['originalScore'], .882)
        self.assertAlmostEqual(q['restoredScore'], 32/35)
        self.assertAlmostEqual(q['mae'], .023095238095238103)
        self.assertAlmostEqual(q['maxError'], .06285714285714285)

    def test_weight_error_is_not_task_error(self):
        a, b = compression('outlier'), compression('outlier',4,'pairs')
        self.assertLess(b['mae'], a['mae'])
        self.assertGreater(abs(b['scoreChange']), abs(a['scoreChange']))
        for preset in ['balanced','outlier']:
            for bits in [4,8]:
                for grouping in ['tensor','pairs']:
                    for r in compression(preset,bits,grouping)['rows']:
                        self.assertLessEqual(abs(r['error']), r['scale']/2+1e-12)

    def test_invalid_inputs_and_no_mutation(self):
        for args in [(3,), (16,3)]:
            with self.assertRaises(ValueError): memory(*args)
        for args in [([],), ([float('nan')],), ([1],4,0)]:
            with self.assertRaises(ValueError): quantize(*args)
        with self.assertRaises(ValueError): compression('missing')
        first = compression()
        compression('outlier',8,'pairs')
        self.assertEqual(compression(), first)


if __name__ == '__main__':
    unittest.main()
