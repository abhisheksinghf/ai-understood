import copy
import unittest
from security import DATA, authorize, evaluate, normalize

class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.case = copy.deepcopy(DATA['cases'][1])
        self.host = {**self.case['host'], 'catalogIds': DATA['catalogIds']}
    def test_default_preserves_useful_requests(self):
        r = evaluate()
        self.assertEqual(r['full'], dict(total=8, allowed=3, violations=0, falseBlocks=0, correct=8))
    def test_keyword_misses_attacks_and_blocks_dialogue(self):
        r = evaluate(dict(mode='keyword'))
        self.assertEqual(r['full'], dict(total=8, allowed=6, violations=4, falseBlocks=1, correct=3))
    def test_missing_or_stale_grant_waits_for_review(self):
        for value in ('missing', 'stale'):
            self.assertEqual(evaluate(dict(approval=value))['rows'][1]['decision'], 'review')
            self.assertEqual(evaluate(dict(mode='keyword', approval=value))['full']['violations'], 5)
    def test_model_claim_is_not_an_approval(self):
        self.assertEqual(authorize(self.case['proposal'], self.host, None)['decision'], 'review')
    def test_all_grant_fields_are_bound(self):
        for key in ('principal', 'requestId', 'tool', 'movieId'):
            grant = {**self.case['grant'], key: 'different'}
            self.assertNotEqual(authorize(self.case['proposal'], self.host, grant)['decision'], 'allow')
    def test_schema_and_unknown_tools_fail_closed(self):
        for p in (None, {}, {**self.case['proposal'], 'extra': True}, {**self.case['proposal'], 'claimedApproval': 1}, {**self.case['proposal'], 'tool': 'shell'}):
            self.assertEqual(authorize(p, self.host, self.case['grant'])['decision'], 'block')
    def test_public_and_private_read_targets(self):
        for owner, movie in (('viewer-B', 'M003'), ('public', 'M999')):
            p = dict(tool='read_catalog', owner=owner, movieId=movie, claimedApproval=True)
            self.assertEqual(authorize(p, self.host, None)['decision'], 'block')
        p = dict(tool='read_history', owner='viewer-A', movieId='', claimedApproval=True)
        self.assertEqual(authorize(p, self.host, None)['decision'], 'block')
        self.assertEqual(authorize(p, {**self.host, 'historyRequested': True}, None)['decision'], 'allow')
    def test_filters_do_not_hide_full_suite_violations(self):
        r = evaluate(dict(mode='keyword', slice='legitimate'))
        self.assertEqual(r['visible']['violations'], 0)
        self.assertEqual(r['full']['violations'], 4)
    def test_minimization_is_separate_from_action_gate(self):
        r = evaluate(dict(context='excessive'))
        self.assertEqual(r['unnecessaryPrivateFields'], 2)
        self.assertEqual(r['full']['violations'], 0)
    def test_config_rejects_unknown_values(self):
        for c in ({'mode':'magic'}, {'approval':'yes'}, {'anything':True}, []):
            with self.assertRaises(ValueError): normalize(c)

if __name__ == '__main__':
    unittest.main()
