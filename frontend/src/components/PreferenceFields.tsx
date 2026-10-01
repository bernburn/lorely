import { preferenceOptions, type StoryPreferences } from '../types/story'
const labels = { genre: 'Genre', storytelling_style: 'Story Style', interaction_mode: 'Interaction Mode', tone: 'Tone', length: 'Story Length', education_level: 'Education Level', complexity: 'Story Complexity' }
const descriptions: Record<string, string> = {
  Allegory: 'Turn lesson concepts into characters, places, objects, and parts of the story world.',
  Grounded: 'Follow characters using lesson concepts in realistic situations.',
  'You Decide': 'Step into the story as the main character.',
  'Just Read': 'Enjoy the story without interruptions, then answer a question at the end of each chapter to continue.',
  'Solve Along': 'Help solve problems during the story, then answer a question at the end of each chapter to continue.',
}
export default function PreferenceFields({ value, onChange, disabled, continuing = false }: {
  value: StoryPreferences; onChange: (value: StoryPreferences) => void; disabled: boolean; continuing?: boolean;
}) {
  return <fieldset className="preferences" disabled={disabled}>
    <legend className="visually-hidden">Story preferences</legend>
    <div className="preference-grid">{(Object.keys(preferenceOptions) as (keyof typeof preferenceOptions)[]).filter(k => !continuing || !['genre', 'storytelling_style'].includes(k)).map(key =>
      <div className={`field ${key === 'interaction_mode' ? 'field-wide' : ''}`} key={key}>
        <label htmlFor={`pref-${key}`}>{labels[key]}</label>
        <select id={`pref-${key}`} value={value[key]} aria-describedby={descriptions[value[key]] ? `help-${key}` : undefined}
          onChange={e => onChange({ ...value, [key]: e.target.value })}>
          {preferenceOptions[key].map(option => <option key={option}>{option}</option>)}
        </select>
        {descriptions[value[key]] && <p id={`help-${key}`} className="field-help">{descriptions[value[key]]}</p>}
      </div>)}
    </div>
    <div className="field plot-field"><label htmlFor="core-plot">{continuing ? 'Core Plot for this Arc' : 'Core Plot'} <span className="muted optional">Optional</span></label>
    <p className="field-help" id="plot-help">{continuing ? 'Have an idea for what should happen next?' : 'Have a story idea? Give Lorely a premise to build around.'}</p>
    <textarea id="core-plot" value={value.core_plot} maxLength={500} rows={3} aria-describedby="plot-help plot-count"
      placeholder="A group of students discovers something strange happening on their school's network..." onChange={e => onChange({ ...value, core_plot: e.target.value })} />
    <span id="plot-count" className="character-count muted small">{value.core_plot.length} / 500</span></div>
    <p className="small muted">Education Level sets the depth of the concepts. Story Complexity sets how the prose reads.</p>
  </fieldset>
}
