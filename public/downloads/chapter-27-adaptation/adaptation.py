"""Transparent teaching rules, not a model or benchmark. Python 3.10+."""
import argparse
import json
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
DESIGN_KEYS = ['rag', 'readTool', 'writeTool', 'fineTune']
FLAGS = ['writeAction', 'behaviorGap', 'baselineTested', 'examplesReady', 'evalReady']


def plan(config):
    if (not isinstance(config, dict) or set(config) != {'knowledge', *FLAGS}
            or config['knowledge'] not in [k['id'] for k in DATA['knowledge']]
            or any(type(config[k]) is not bool for k in FLAGS)):
        raise ValueError('Invalid requirement configuration.')
    docs = config['knowledge'] in ('documents', 'documents_live')
    live = config['knowledge'] in ('live', 'documents_live')
    missing = [k for k in ['baselineTested', 'examplesReady', 'evalReady']
               if not config[k]] if config['behaviorGap'] else []
    if not config['behaviorGap']:
        status = 'Not indicated'
    elif not config['baselineTested']:
        status = 'Build the baseline'
    elif missing:
        status = 'Prepare evidence'
    else:
        status = 'Trial candidate'
    suggested = dict(rag=docs, readTool=live, writeTool=config['writeAction'],
                     fineTune=status == 'Trial candidate')
    requirements = [dict(id='prompt', label='Instructions and supplied context', covered=True)]
    for needed, key, label in [(docs, 'rag', 'Document evidence'),
                               (live, 'readTool', 'Current external state'),
                               (config['writeAction'], 'writeTool', 'Authorized state change')]:
        if needed:
            requirements.append(dict(id=key, label=label, covered=False))
    checks = list(DATA['commonChecks'])
    for needed, key in [(docs, 'documentChecks'), (live, 'liveChecks'),
                        (config['writeAction'], 'actionChecks'), (config['behaviorGap'], 'behaviorChecks')]:
        if needed:
            checks.extend(DATA[key])
    return dict(config=dict(config), methods=['prompt']+[k for k in DESIGN_KEYS if suggested[k]],
                suggestedDesign=suggested, fineTuning=dict(status=status, missing=missing),
                requirements=requirements, checks=checks)


def assess(config, design):
    if (not isinstance(design, dict) or set(design) != set(DESIGN_KEYS)
            or any(type(design[k]) is not bool for k in DESIGN_KEYS)):
        raise ValueError('Invalid design selection.')
    p = plan(config)
    requirements = [dict(r, covered=r['id'] == 'prompt' or design[r['id']])
                    for r in p['requirements']]
    missing = [r['id'] for r in requirements if not r['covered']]
    extras = [k for k in DESIGN_KEYS if design[k] and not p['suggestedDesign'][k]]
    issue = design['fineTune'] and p['fineTuning']['status'] != 'Trial candidate'
    verdict = ('Missing required capability' if missing else
               'Revisit adaptation choice' if issue else 'Inputs and actions covered')
    return dict(design=dict(design), requirements=requirements, missing=missing,
                extras=extras, adaptationIssue=issue, verdict=verdict)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scenario', choices=[s['id'] for s in DATA['scenarios']], default='hybrid')
    parser.add_argument('--design', default='', help='Comma-separated rag,readTool,writeTool,fineTune; prompt is always included.')
    parser.add_argument('--ready', action='store_true', help='Mark all three training prerequisites ready; no training is performed.')
    args = parser.parse_args()
    chosen = args.design.split(',') if args.design else []
    if any(k not in DESIGN_KEYS for k in chosen) or len(chosen) != len(set(chosen)):
        parser.error('Choose distinct component names from rag,readTool,writeTool,fineTune.')
    config = dict(next(s['config'] for s in DATA['scenarios'] if s['id'] == args.scenario))
    if args.ready:
        config.update(baselineTested=True, examplesReady=True, evalReady=True)
    design = {k: k in chosen for k in DESIGN_KEYS}
    print(json.dumps(dict(plan=plan(config), assessment=assess(config, design)), indent=2))


if __name__ == '__main__':
    main()
