import copy
import json
import unittest
from movie_app import ROOT, DEFAULT, load_json, recommend, validate_catalog, build_sources, template_provider, add_draft
from evaluate import evaluate
from errors import ProviderError
from provider import OpenAIProvider

CATALOG = load_json((ROOT/'catalog.json').read_text(encoding='utf-8'))


class MovieTests(unittest.TestCase):
    def test_prepared_acceptance_cases(self):
        cases = load_json((ROOT/'eval_cases.json').read_text(encoding='utf-8'))
        report = evaluate(CATALOG, cases)
        self.assertEqual((report['passed'], report['total']), (12, 12))

    def test_every_eligible_movie_meets_constraints(self):
        for limit in range(30, 241):
            p = {**DEFAULT, 'max_minutes': limit, 'seen_ids': ['M001']}
            result = recommend(p, CATALOG)
            for mid in result['eligible_ids']:
                m = next(m for m in CATALOG['movies'] if m['id'] == mid)
                self.assertIn('adventure', m['genres'])
                self.assertIsNotNone(m['runtime_minutes'])
                self.assertLessEqual(m['runtime_minutes'], limit)
                self.assertNotIn(mid, p['seen_ids'])

    def test_missing_length_and_empty_catalog(self):
        for movies in ([], [CATALOG['movies'][-1]]):
            result = recommend(DEFAULT, {'version': 'test', 'movies': movies})
            self.assertEqual(result['status'], 'no_match')
            self.assertIsNone(result['recommendation'])

    def test_invalid_preferences(self):
        changes = [{'max_minutes': True}, {'max_minutes': 120.5}, {'max_minutes': 29}, {'max_minutes': 241}, {'genre': 'unknown'}, {'prefer_light': 'yes'}, {'seen_ids': ['M999']}, {'seen_ids': ['M001', 'M001']}, {'seen_ids': [None]}, {'extra': 1}]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                recommend({**DEFAULT, **change}, CATALOG)

    def test_bad_catalog_and_duplicate_keys(self):
        for change in [{'runtime_minutes': True}, {'runtime_minutes': -1}, {'genres': ['adventure', 'adventure']}, {'title': ''}, {'streaming_service': 42}, {'id': 'S1'}]:
            data = copy.deepcopy(CATALOG)
            data['movies'][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_catalog(data)
        data = copy.deepcopy(CATALOG)
        data['movies'].append(data['movies'][0])
        with self.assertRaises(ValueError):
            validate_catalog(data)
        with self.assertRaises(ValueError):
            load_json('{"genre":"action","genre":"adventure"}')

    def test_tie_break_and_no_mutation(self):
        data = copy.deepcopy(CATALOG)
        twin = {**data['movies'][0], 'id': 'M008', 'title': 'Twin Map'}
        data['movies'].insert(0, twin)
        before = copy.deepcopy(data)
        self.assertEqual(recommend(DEFAULT, data)['recommendation']['movie_id'], 'M001')
        self.assertEqual(data, before)

    def test_sources_and_template_draft(self):
        result = recommend(DEFAULT, CATALOG)
        sources = build_sources(result)
        self.assertIn('M001', sources[1]['text'])
        self.assertNotIn('City Sprint', sources[1]['text'])
        final = add_draft(result, template_provider(result))
        self.assertEqual(final['draft']['status'], 'review_required')
        self.assertIsNone(final['draft']['candidate']['streaming_service'])

    def test_unsupported_draft_does_not_overwrite_card(self):
        result = recommend(DEFAULT, CATALOG)
        final = add_draft(result, template_provider(result, unsupported=True))
        self.assertEqual(final['draft']['status'], 'review_required')
        self.assertEqual(final['draft']['candidate']['streaming_service'], 'ExampleFlix [S1]')
        self.assertIsNone(final['recommendation']['streaming_service'])

    def test_no_match_makes_zero_calls(self):
        class Never:
            def generate(self, request):
                raise AssertionError('A provider must not be called')
        result = recommend({**DEFAULT, 'max_minutes': 90}, CATALOG)
        self.assertEqual(add_draft(result, Never())['draft']['attempts'], 0)

    def test_provider_failure_preserves_card(self):
        class Broken:
            model = 'fake'
            calls = 0
            def generate(self, request):
                self.calls += 1
                raise ProviderError('connection_or_timeout', True)
        provider = Broken()
        result = recommend(DEFAULT, CATALOG)
        final = add_draft(result, provider)
        self.assertEqual(provider.calls, 1)
        self.assertEqual(final['draft']['status'], 'service_error')
        self.assertEqual(final['recommendation'], result['recommendation'])

    def test_live_adapter_with_fake_http_only(self):
        result = recommend(DEFAULT, CATALOG)
        envelope = template_provider(result).generate({})
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return json.dumps(envelope).encode()
        def transport(request, timeout):
            self.assertEqual(timeout, 30)
            payload = json.loads(request.data)
            self.assertTrue(payload['text']['format']['strict'])
            self.assertFalse(payload['store'])
            self.assertEqual(json.loads(payload['input'][0]['content'])['sources'], build_sources(result))
            return Response()
        final = add_draft(result, OpenAIProvider('dummy-test-key', 'fake-model', transport))
        self.assertEqual(final['draft']['status'], 'review_required')


if __name__ == '__main__':
    unittest.main()
