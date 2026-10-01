import { useEffect, useRef } from 'react'
import type { EducationalConcept } from '../types/story'
export default function ConceptDialog({ concepts, selected, onSelect, onClose }: {
  concepts: EducationalConcept[]; selected: string | null; onSelect: (id: string) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]') ?? [])
    focusable()[0]?.focus()
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key === 'Tab') {
        const items = focusable(); const first = items[0]; const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.removeEventListener('keydown', keyboard); document.body.style.overflow = oldOverflow; previous?.focus() }
  }, [onClose])
  const concept = concepts.find(c => c.id === selected)
  return <div className="dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div ref={dialog} className="concept-dialog" role="dialog" aria-modal="true" aria-labelledby="concept-heading">
      <div className="dialog-heading"><p className="eyebrow">From your lesson</p><button className="text-button" onClick={onClose} aria-label="Close concepts">Close ×</button></div>
      <h2 id="concept-heading">{concept?.term ?? 'Concepts in this arc'}</h2>
      {concept ? <><h3>Lesson Definition</h3><p>{concept.definition}</p><h3>In This Story</h3><p>{concept.storyContext}</p>
      <button className="text-button" onClick={() => onSelect('')}>View all concepts</button></> : <ul className="concept-list">{concepts.map(c => <li key={c.id}><button onClick={() => onSelect(c.id)}>{c.term}<span aria-hidden="true">→</span></button></li>)}</ul>}
    </div>
  </div>
}
