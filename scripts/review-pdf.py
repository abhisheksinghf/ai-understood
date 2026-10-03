from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import pdfplumber
import json
import sys

root = Path(__file__).resolve().parent.parent
chapter = int(sys.argv[1]) if len(sys.argv)>1 else 1
out = root / 'tmp' / 'qa' / f'chapter-{chapter:02d}'
out.mkdir(parents=True, exist_ok=True)
pdf_path = root/'output'/'pdf'/f'ai-handbook-chapter-{chapter:02d}.pdf'
with pdfplumber.open(pdf_path) as current_pdf:
    current_page_count = len(current_pdf.pages)
pages = sorted(out.glob('final-page-*.png'))[:current_page_count]
for group_start in range(0, len(pages), 15):
    group = pages[group_start:group_start+15]
    sheet = Image.new('RGB', (1200, 1080), '#d8ddd8')
    draw = ImageDraw.Draw(sheet)
    for i, file in enumerate(group):
        im = Image.open(file).convert('RGB')
        im.thumbnail((220, 325))
        x = 10 + (i % 5) * 240
        y = 20 + (i // 5) * 360
        sheet.paste(im, (x, y))
        draw.text((x, y+330), f'Page {group_start+i+1}', fill='#183422')
    sheet.save(out / f'final-contact-{group_start//15+1}.png')

with pdfplumber.open(pdf_path) as pdf:
    report = []
    all_text = ''
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ''
        all_text += text + '\n'
        outside = [c for c in page.chars if c['x0'] < 0 or c['x1'] > page.width + 1 or c['top'] < 0 or c['bottom'] > page.height + 1]
        report.append({'page':i+1,'words':len(text.split()),'outside_page':len(outside),'first_lines':text.splitlines()[:2]})
    required = ['What is artificial', 'Same scores.', 'Exercise 8', 'Answer: B.', 'Mini glossary', 'Sources and where we go next', 'personal learning assistant', 'N01']
    if chapter == 2:
        required = ['concepts connect.', 'Who chooses the next step?', 'Investigate', 'Exercise 5.', 'Answer: B.', 'Quick-reference glossary', 'Levels of AGI', 'study notes', 'overfitting']
    if chapter == 3:
        required = ['models learn.', 'Predict. Compare. Adjust.', 'Training experiment, printable results.', '8.2963', 'Exercise 5.', 'Answer: B.', 'Quick-reference glossary', 'Python for AI', 'price units', '1,000 sq ft']
    if chapter == 4:
        required = ['Python', 'for AI.', 'One row at a time.', '4.6667', 'price_report.json', 'Exercise 3:', 'Answer: A.', 'Quick-reference glossary', 'APIs']
    if chapter == 5:
        required = ['Software, APIs,', 'and data.', 'Same task. Different outcomes.', 'estimated_minutes', 'study_history.db', 'Exercise 3:', 'Answer: B.', 'Quick-reference glossary', 'linear algebra']
    if chapter == 6:
        required = ['linear algebra.', 'One vector. Five transformations.', '5.5', 'broadcasting', 'singular', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Probability and statistics']
    if chapter == 7:
        required = ['statistics for AI.', 'How much should you trust an alert?', '15.38%', '66.67%', 'Undefined', '0.568', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'information theory']
    if chapter == 8:
        required = ['information theory.', 'Same curve. Different step sizes.', '2.90625', '0.188722', 'antiderivative', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Prompting and context']
    if chapter == 9:
        required = ['context design.', 'Same evidence. Clearer instructions.', 'exam_date', 'Overfitting', '20', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 10']
    if chapter == 10:
        required = ['with Python.', 'One workflow. Different outcomes.', 'review_required', 'invalid_input', 'Idempotency', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 11']
    if chapter == 11:
        required = ['learning assistant.', 'What should I study next?', 'N01', 'no_match', 'review_required', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 12']
    if chapter == 12:
        required = ['for machine learning.', 'Same rows. Different preparation.', '110', '127.5', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 13']
    if chapter == 13:
        required = ['Numbers and classes.', 'One input. Two learning tasks.', '3.9286', '0.8202', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 14']
    if chapter == 14:
        required = ['Structure without labels.', 'Same movies. Different structures.', '51.1667', '69.97%', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 15']
    if chapter == 15:
        required = ['Measure. Compare. Improve.', 'Same predictions. Different decisions.', '83.33%', '0.9259', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 16']
    if chapter == 16:
        required = ['From words to results.', 'One query. Three ways to rank.', '2.1863', '66.67%', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 17']
    if chapter == 17:
        required = ['Find useful neighbors.', 'Same movies. A different representation.', '0.9939', '66.67%', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 18']
    if chapter == 18:
        required = ['Follow the evidence.', 'Same question. Different evidence.', 'M004:r1:card', 'insufficient_evidence', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 19']
    if chapter == 19:
        required = ['Measure what matters.', 'Better overall. Worse on one question.', '87.50%', '105', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 20']
    if chapter == 20:
        required = ['Built from first principles.', 'Same preferences. Different capacity.', '0.0027', '0.6372', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 21']
    if chapter == 21:
        required = ['Learn from the curves.', 'Lower training loss. Worse validation.', '0.0419', '0.1899', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 22']
    if chapter == 22:
        required = ['Structure meets learning.', 'Same building blocks. Different structure.', '0.7692', '0.5134', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 24']
    if chapter == 23:
        required = ['Learn what comes next.', 'Inspect the pieces. Predict the next one.', '1.4142', '4.2178', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 24']
    if chapter == 24:
        required = ['Understand the transformer.', 'Same words. Different connections.', '0.2483', '1.5816', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 25']
    if chapter == 25:
        required = ['Generate with fixed weights.', 'Same model. Two different jobs.', '0.0364', '1.1543', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 26']
    if chapter == 26:
        required = ['Keep the answers useful.', 'Smaller numbers. Different tradeoffs.', '15.5385', '0.9143', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 27']
    if chapter == 27:
        required = ['Start with the missing piece.', 'One request. Different missing pieces.', 'Inputs and actions covered', 'Trial candidate', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 28']
    if chapter == 28:
        required = ['Learn from examples and choices.', 'Small updates. Different learning signals.', '0.5312', '0.6931', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 29']
    if chapter == 29:
        required = ['Understand the path from noise.', 'Add noise. Estimate. Generate.', '0.5000', '1.7321', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 30']
    if chapter == 30:
        required = ['Keep the evidence connected.', 'Match meanings. Keep the timeline.', '980', '4.8', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 31']
    if chapter == 31:
        required = ['Make each step explicit.', 'Same request. Different paths.', 'receipt replayed', 'needs_reconciliation', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 32']
    if chapter == 32:
        required = ['Keep its decisions grounded.', 'One goal. Watch the next decision.', 'Harbor Lights', 'insufficient_evidence', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 33']
    if chapter == 33:
        required = ['Coordinate the work.', 'Same task. Different coordination.', 'Harbor Lights', 'insufficient_evidence', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 34']
    if chapter == 34:
        required = ['Look beyond the average.', 'A better average. A reason to pause.', '62.5%', '87.5%', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 35']
    if chapter == 35:
        required = ['Keep the person in view.', 'Same proposal. Different permission checks.', '3/8', '8/8', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 36']
    if chapter == 36:
        required = ['Keep the service reliable.', 'Twenty requests. A release decision.', '19/20', '16/20', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 37']
    if chapter == 37:
        required = ['Reason beyond prediction.', 'Rules first. Then reason under uncertainty.', '3.02', '3.776', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 38']
    if chapter == 38:
        required = ['Learn from experience.', 'Ask now. Recommend better later.', '3.175', '4.4', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 39']
    if chapter == 39:
        required = ['Make the task concrete.', 'Same cinema. Three different tasks.', '0.613147', '22.143', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 40']
    if chapter == 40:
        required = ['Follow the connections.', 'What changes when the connections change?', '0.03125', '0.996387', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 41']
    if chapter == 41:
        required = ['Follow the evidence.', 'What does this result actually establish?', '60.87%', '83.63%', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'Chapter 42']
    if chapter == 42:
        required = ['Build your movie assistant.', 'One assistant. Inspect every decision.', '4/8', '8/8', 'Exercise 3:', 'Answer: C.', 'Quick-reference glossary', 'continue practicing']
    checks = {s:s in all_text for s in required}
    (out/'pdf-text.txt').write_text(all_text, encoding='utf-8')
    (out/'pdf-report.json').write_text(json.dumps({'pages':report,'content_checks':checks}, indent=2), encoding='utf-8')
    print(json.dumps({'pages':len(pdf.pages),'content_checks':checks,'outside_page':sum(p['outside_page'] for p in report),'sparse_pages':[p for p in report if p['words']<100]}))
