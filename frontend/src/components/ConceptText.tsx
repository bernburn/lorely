import type { EducationalConcept } from '../types/story'
// Match longest terms first, including repeated occurrences, with Unicode word boundaries.
export function tokenizeConcepts(text: string, concepts: EducationalConcept[]): { text: string; concept?: EducationalConcept }[] {
  const terms = [...concepts].sort((a, b) => b.term.length - a.term.length)
  if (!terms.length) return [{ text }]
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${terms.map(c => escape(c.term)).join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
  const result: { text: string; concept?: EducationalConcept }[] = []
  let offset = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index
    if (index > offset) result.push({ text: text.slice(offset, index) })
    result.push({ text: match[0], concept: terms.find(c => c.term.toLowerCase() === match[0].toLowerCase()) })
    offset = index + match[0].length
  }
  if (offset < text.length) result.push({ text: text.slice(offset) })
  return result
}
export default function ConceptText({ text, concepts, onConcept }: { text: string; concepts: EducationalConcept[]; onConcept: (id: string) => void }) {
  return <>{tokenizeConcepts(text, concepts).map((part, i) => part.concept ? <button key={i} className="concept-term" onClick={() => onConcept(part.concept!.id)} aria-label={`Review concept: ${part.concept.term}`}>{part.text}</button> : <span key={i}>{part.text}</span>)}</>
}
