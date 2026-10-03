import copy
import itertools
import unittest
from adaptation import DATA, FLAGS, DESIGN_KEYS, plan, assess


def case(name):
    return dict(next(s['config'] for s in DATA['scenarios'] if s['id'] == name))


class DecisionRules(unittest.TestCase):
    def test_supplied_facts_need_no_external_role(self):
        self.assertEqual(plan(case('provided'))['methods'], ['prompt'])

    def test_fine_tuning_does_not_supply_external_capabilities(self):
        result = assess(case('hybrid'), dict(rag=False, readTool=False, writeTool=False, fineTune=True))
        self.assertEqual(result['missing'], ['rag', 'readTool', 'writeTool'])

    def test_each_training_prerequisite_matters(self):
        config = case('hybrid')
        self.assertEqual(plan(config)['fineTuning']['status'], 'Trial candidate')
        for key in ['baselineTested', 'examplesReady', 'evalReady']:
            result = plan(dict(config, **{key: False}))
            self.assertFalse(result['suggestedDesign']['fineTune'])
            self.assertEqual(result['fineTuning']['missing'], [key])

    def test_ready_data_without_a_gap_does_not_indicate_training(self):
        result = plan(dict(case('hybrid'), behaviorGap=False))
        self.assertEqual(result['fineTuning'], dict(status='Not indicated', missing=[]))

    def test_behavior_quality_is_separate_from_capability_coverage(self):
        result = assess(case('hybrid'), dict(rag=True, readTool=True, writeTool=True, fineTune=False))
        self.assertEqual(result['verdict'], 'Inputs and actions covered')

    def test_extra_components_are_explained(self):
        result = assess(case('provided'), dict(rag=True, readTool=False, writeTool=False, fineTune=True))
        self.assertEqual(result['extras'], ['rag', 'fineTune'])
        self.assertEqual(result['verdict'], 'Revisit adaptation choice')

    def test_all_suggested_designs_cover_external_requirements(self):
        for knowledge in [k['id'] for k in DATA['knowledge']]:
            for values in itertools.product([False, True], repeat=5):
                config = dict(knowledge=knowledge, **dict(zip(FLAGS, values)))
                result = assess(config, plan(config)['suggestedDesign'])
                self.assertEqual(result['missing'], [])
                self.assertFalse(result['adaptationIssue'])

    def test_results_do_not_mutate_inputs_or_data(self):
        before = copy.deepcopy(DATA)
        config = case('hybrid')
        result = plan(config)
        result['config']['knowledge'] = 'provided'
        result['checks'].append('mutation')
        result['suggestedDesign']['rag'] = False
        self.assertEqual(config, case('hybrid'))
        self.assertEqual(DATA, before)

    def test_invalid_inputs_fail(self):
        for config in [None, {}, dict(case('hybrid'), knowledge='memory'),
                       dict(case('hybrid'), writeAction=1), dict(case('hybrid'), unexpected=True)]:
            with self.assertRaises(ValueError):
                plan(config)
        for design in [None, {}, dict(rag=1, readTool=False, writeTool=False, fineTune=False)]:
            with self.assertRaises(ValueError):
                assess(case('hybrid'), design)


if __name__ == '__main__':
    unittest.main()
