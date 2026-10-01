import { useRef, useState } from 'react'
import type { AnswerChoices } from '../types/story'
export default function Question({ question, prompt, complete, onAnswer, onReview, label }: {
  question: AnswerChoices; prompt: string; complete: boolean; onAnswer: (choice: number) => void; onReview: (id: string) => void; label: string;
}) {
  const [wrong, setWrong] = useState<number | null>(null)
  const firstChoice = useRef<HTMLButtonElement>(null)
  return <section className={`question ${complete ? 'question-complete' : ''}`} aria-label={label}>
    <p className="question-prompt">{prompt}</p>
    <div className="choices">{question.choices.map((choice, i) => <button type="button" key={i} ref={i === 0 ? firstChoice : undefined} className={`choice ${complete && i === question.correctIndex ? 'choice-correct' : ''} ${!complete && wrong === i ? 'choice-incorrect' : ''}`} disabled={complete || wrong !== null}
      onClick={() => { if (i !== question.correctIndex) setWrong(i); else onAnswer(i) }}><span className="choice-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{choice}</span>{complete && i === question.correctIndex && <span className="choice-result">Correct</span>}</button>)}</div>
    <div className="answer-feedback" role="status" aria-live="polite">{complete ? <p><strong>Correct.</strong> {question.explanation}</p> : wrong !== null ? <><p><strong>Not quite.</strong> {question.hint}</p><div className="actions"><button className="secondary-button" onClick={() => { setWrong(null); window.setTimeout(() => firstChoice.current?.focus(), 0) }}>Retry answer</button>{question.relatedConceptIds.length > 0 && <button className="text-button" onClick={() => onReview(question.relatedConceptIds[0])}>Review Concept</button>}</div></> : null}</div>
  </section>
}
