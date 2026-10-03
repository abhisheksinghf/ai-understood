import { useState } from 'react';
const defaultQuestions = [
  {q:'Which statement describes AI most accurately?', options:['Every program that automates a task is AI.', 'AI includes methods based on search, rules, and learning.', 'AI and chatbots mean the same thing.'], correct:1, explanation:'AI is a broad field. Chatbots are one application, and simple automation alone does not establish an AI method. Rules and search can be part of classical AI.'},
  {q:'A model assigns a score of 0.82. What can we conclude?', options:['The event has exactly an 82% chance of occurring.', 'The application must automatically act.', 'We need the score definition and decision policy to interpret it.'], correct:2, explanation:'Scores need a defined meaning. Probability calibration is a separate property, and an action is chosen by an application policy.'},
  {q:'Which operation is training?', options:['Adjusting model parameters using examples and an objective.', 'Supplying a new document in the input.', 'Moving a decision threshold from 0.70 to 0.40.'], correct:0, explanation:'Training fits parameters. New context changes the information supplied, while changing a cutoff changes the policy around an output.'},
  {q:'A study note defines overfitting but gives no exam date. What should the assistant say?', options:['The exam must be this Friday.', 'Explain overfitting using the note; keep the exam date unknown.', 'Reading the note guarantees mastery.'], correct:1, explanation:'The note supports the definition. It does not establish an exam date or guarantee learning outcomes.'},
  {q:'What is the best initial approach to adding known amounts?', options:['A large language model with no checking.', 'A classifier trained on invoices.', 'A deterministic calculation in code or a spreadsheet.'], correct:2, explanation:'The arithmetic operation is precisely specified. Exact computation provides a clear, checkable baseline without needing a learned model.'},
];
export type Question = {q:string; options:string[]; correct:number; explanation:string};
export default function Quiz({questions=defaultQuestions}:{questions?:Question[]}) {
  const [answers,setAnswers]=useState<Record<number,number>>({});
  const [checked,setChecked]=useState(false);
  const attempted=Object.keys(answers).length;
  const score=questions.filter((q,i)=>answers[i]===q.correct).length;
  return <div className="quiz">
    {questions.map((q,i)=><fieldset key={q.q} className="quiz-question"><legend><span>{String(i+1).padStart(2,'0')}</span>{q.q}</legend>
      <div className="screen-only">{q.options.map((option,j)=><label key={option} className={`quiz-option ${checked && answers[i]===j ? (j===q.correct?'correct':'incorrect'):''}`}>
        <input type="radio" name={`question-${i}`} value={j} checked={answers[i]===j} onChange={()=>{setAnswers({...answers,[i]:j});setChecked(false);}}/>{option}
      </label>)}</div>
      <ol type="A" className="print-only">{q.options.map(o=><li key={o}>{o}</li>)}</ol>
      {checked && <p className="quiz-explanation screen-only"><strong>{answers[i]===q.correct?'Correct.':'Revisit this idea.'}</strong> {q.explanation}</p>}
      <p className="print-only"><strong>Answer: {String.fromCharCode(65+q.correct)}.</strong> {q.explanation}</p>
    </fieldset>)}
    <div className="quiz-actions screen-only"><button className="primary-button" disabled={attempted<questions.length} onClick={()=>setChecked(true)}>Check my answers</button><button className="small-button" onClick={()=>{setAnswers({});setChecked(false);}}>Try again</button><span role="status">{checked?`${score}/${questions.length} correct. Read the explanations above.`:`${attempted}/${questions.length} answered`}</span></div>
    <noscript><p>Enable JavaScript to use the quiz, or download the PDF for all questions and explained answers.</p></noscript>
  </div>;
}
