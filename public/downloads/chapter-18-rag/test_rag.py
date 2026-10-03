import copy
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import rag

DATA = json.loads(Path(__file__).with_name('sources.json').read_text(encoding='utf-8-sig'))

class RagTests(unittest.TestCase):
    def test_boundaries_and_budget(self):
        self.assertEqual(len(rag.chunk_sources(DATA)), 8)
        self.assertEqual(len(rag.chunk_sources(DATA, 'section')), 16)
        self.assertEqual(rag.experiment(DATA)['context']['used'], 43)
        for k, budget, status in [(1,120,'insufficient_evidence'),(3,50,'evidence_ready'),(3,20,'insufficient_evidence')]:
            r = rag.experiment(DATA, chunking='section', k=k, budget=budget)
            self.assertEqual(r['validation']['status'], status)
            self.assertLessEqual(r['context']['used'], budget)
        small = rag.experiment(DATA, query_id='space', budget=21)
        self.assertEqual([c['movie_id'] for c in small['context']['selected']], ['M004'])

    def test_missing_evidence_and_filters(self):
        self.assertEqual(rag.experiment(DATA, query_id='streaming')['validation']['status'], 'insufficient_evidence')
        self.assertEqual(rag.experiment(DATA, budget=0)['context']['selected'], [])
        r = rag.experiment(DATA, query_id='runtime', k=8, limit='under120')
        self.assertTrue(all(c['runtime_minutes'] is not None and c['runtime_minutes'] < 120 for c in r['candidates']))
        self.assertEqual(r['validation']['evidence'][0]['quote'], 'Runtime: 110 minutes.')

    def test_checks_and_their_limits(self):
        r = rag.experiment(DATA)
        for fault in ('bad_id', 'bad_quote'):
            self.assertEqual(rag.experiment(DATA, fault=fault)['validation']['status'], 'blocked')
        for candidate in (None, [], {}, {'status':'answer','claims':[]}, {'status':'answer','claims':[None]}):
            self.assertEqual(rag.check_candidate(candidate, r['context']['selected'])['status'], 'blocked')
        self.assertEqual(rag.check_candidate(r['candidate'], [])['status'], 'blocked')
        wrong = dict(status='answer', claims=[dict(source_id='M006:r1:card', quote=DATA['movies'][5]['summary'])])
        self.assertEqual(rag.check_candidate(wrong, r['context']['selected'])['status'], 'evidence_ready')

    def test_revision_and_input_errors(self):
        changed = copy.deepcopy(DATA)
        changed['movies'][3].update(revision=2, runtime_minutes=112)
        r = rag.experiment(changed, query_id='runtime')
        self.assertEqual(r['validation']['evidence'][0]['source_id'], 'M004:r2:card')
        self.assertEqual(r['validation']['evidence'][0]['quote'], 'Runtime: 112 minutes.')
        for kw in (dict(query_id='missing'), dict(k=0), dict(budget=-1), dict(fault='bad')):
            with self.assertRaises(ValueError):
                rag.experiment(DATA, **kw)
        changed['movies'][0]['revision'] = 0
        with self.assertRaises(ValueError):
            rag.experiment(changed)

    def test_local_adapter_with_mocked_transport(self):
        r = rag.experiment(DATA)
        envelope = dict(done=True, done_reason='stop', message=dict(content=json.dumps(r['candidate'])))
        with patch('rag.build_opener') as factory:
            factory.return_value.open.return_value.__enter__.return_value.read.return_value = json.dumps(envelope).encode()
            self.assertEqual(rag.generate_local(r['prompt'], 'installed-test-model'), r['candidate'])
            request = factory.return_value.open.call_args.args[0]
            self.assertEqual(request.full_url, 'http://127.0.0.1:11434/api/chat')
            payload = json.loads(request.data)
            self.assertFalse(payload['stream'])
            self.assertEqual(payload['format'], rag.SCHEMA)
            self.assertIn('M004:r1:card', payload['messages'][1]['content'])
        for envelope in ({}, {'done':False}, {'done':True,'done_reason':'length','message':{'content':'{}'}}, {'done':True,'message':{'content':'not JSON'}}):
            with self.assertRaises(ValueError):
                rag.parse_response(envelope)

    def test_cli_does_not_disguise_model_failure_or_call_without_evidence(self):
        with patch('sys.argv', ['rag.py','--ollama-model','test']), patch('rag.generate_local', side_effect=OSError('unavailable')), patch('sys.stdout', new_callable=io.StringIO) as out:
            self.assertEqual(rag.main(), 3)
            self.assertEqual(json.loads(out.getvalue())['status'], 'generation_error')
        with patch('sys.argv', ['rag.py','--ollama-model','test','--budget','0']), patch('rag.generate_local') as generate, patch('sys.stdout', new_callable=io.StringIO) as out:
            self.assertEqual(rag.main(), 0)
            generate.assert_not_called()
            self.assertEqual(json.loads(out.getvalue())['validation']['status'], 'insufficient_evidence')

if __name__ == '__main__':
    unittest.main()
