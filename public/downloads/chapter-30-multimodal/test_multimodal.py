import itertools
import math
import unittest
from multimodal import DATA, cosine, match, patch_count, sample_video


class MultimodalTests(unittest.TestCase):
    def test_cosine_geometry(self):
        self.assertAlmostEqual(cosine([3, 4], [1, 0]), .6)
        self.assertAlmostEqual(cosine([3, 4], [0, 1]), .8)
        self.assertAlmostEqual(cosine([1, 0], [-1, 0]), -1)
        a, b = [1, 2, 3], [3, 1, 2]
        self.assertAlmostEqual(cosine(a, b), cosine([5*v for v in a], b))
        self.assertAlmostEqual(cosine(a, b), cosine([a[2], a[0], a[1]], [b[2], b[0], b[1]]))

    def test_alignment_changes_rank(self):
        self.assertEqual(match()['winner'], 'M001')
        self.assertEqual(match(space='mismatched')['winner'], 'M031')

    def test_temperature_changes_shares_not_ranking(self):
        cool, warm = match(temperature=.1), match(temperature=1)
        self.assertEqual([r['id'] for r in cool['rows']], [r['id'] for r in warm['rows']])
        self.assertGreater(cool['rows'][0]['share'], warm['rows'][0]['share'])

    def test_single_candidate_is_not_confidence(self):
        row = match('space', candidates='moon')['rows'][0]
        self.assertEqual(row['share'], 1)
        self.assertLess(row['score'], .2)
        self.assertEqual(match('space')['winner'], 'M031')

    def test_all_matching_configurations_normalize(self):
        for args in itertools.product(['calm', 'chase', 'space'], ['aligned', 'mismatched'], [.1, .5, 1], ['all', 'earth', 'moon']):
            report = match(*args)
            self.assertAlmostEqual(sum(r['share'] for r in report['rows']), 1)
            self.assertTrue(all(0 < r['share'] <= 1 for r in report['rows']))
            self.assertTrue(all(-1 <= r['score'] <= 1 for r in report['rows']))

    def test_sampling_phase_and_event_boundaries(self):
        a, b = sample_video(), sample_video(phase=.25)
        self.assertEqual([f['time'] for f in a['frames']], [0, 4, 8, 12, 16])
        self.assertEqual([f['time'] for f in b['frames']], [1, 5, 9, 13, 17])
        self.assertFalse(a['observed'])
        self.assertEqual(b['hitTimes'], [5])
        frames = sample_video(interval=1)['frames']
        self.assertTrue(frames[5]['event'])
        self.assertFalse(frames[6]['event'])
        self.assertEqual(frames[6]['scene'], 'City')

    def test_resolution_changes_budget_not_times(self):
        a, b = sample_video(), sample_video(resolution=448)
        self.assertEqual(patch_count(224, 224), 196)
        self.assertEqual(a['totalPatches'], 980)
        self.assertEqual(b['totalPatches'], 3920)
        self.assertEqual(a['frames'], b['frames'])

    def test_audio_source_clock(self):
        good, bad = sample_video(phase=.25), sample_video(phase=.25, align_audio=False)
        self.assertEqual(good['audio']['overlapFrames'], [5])
        self.assertEqual(bad['audio']['overlapFrames'], [1])
        self.assertAlmostEqual(good['audio']['start'], 4.8)
        self.assertAlmostEqual(good['audio']['end'], 6.2)
        self.assertEqual(good['frames'], bad['frames'])

    def test_all_video_schedules_are_ordered_and_bounded(self):
        for args in itertools.product([1, 2, 4, 5], [0, .25, .5, .75], [224, 448], [False, True]):
            report = sample_video(*args)
            times = [f['time'] for f in report['frames']]
            self.assertTrue(all(0 <= t < 20 for t in times))
            self.assertTrue(all(b-a == args[0] for a, b in zip(times, times[1:])))
            self.assertEqual(report['observed'], any(5 <= t < 6 for t in times))
            self.assertEqual(report['totalPatches'], len(times)*(args[2]//16)**2)

    def test_reports_do_not_mutate_data(self):
        import json
        before = json.dumps(DATA)
        match()['queryVector'][0] = 999
        match()['rows'][0]['vector'][0] = 999
        sample_video()['frames'][0]['caption'] = 'changed'
        self.assertEqual(json.dumps(DATA), before)

    def test_invalid_input(self):
        for a, b in [([], []), ([0, 0], [1, 0]), ([1], [1, 2]), ([math.nan], [1])]:
            with self.assertRaises(ValueError):
                cosine(a, b)
        for args in [('bad',), ('calm', 'bad'), ('calm', 'aligned', 0), ('calm', 'aligned', .5, 'bad')]:
            with self.assertRaises(ValueError):
                match(*args)
        for args in [(3,), (4, 1), (4, 0, 100), (4, 0, 224, 'yes')]:
            with self.assertRaises(ValueError):
                sample_video(*args)
        with self.assertRaises(ValueError):
            patch_count(225, 224)


if __name__ == '__main__':
    unittest.main()
