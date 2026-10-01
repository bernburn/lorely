export const preferenceOptions = {
  genre: ['Fantasy', 'Mystery', 'Sci-Fi', 'Adventure', 'Horror'],
  storytelling_style: ['Allegory', 'Grounded', 'You Decide'],
  interaction_mode: ['Just Read', 'Solve Along'],
  tone: ['Lighthearted', 'Serious', 'Funny', 'Dramatic'],
  length: ['Quick', 'Standard', 'Long'],
  education_level: ['Elementary', 'Junior High', 'Senior High', 'College'],
  complexity: ['Easy to Read', 'Balanced', 'Advanced'],
} as const
export type StoryPreferences = { [K in keyof typeof preferenceOptions]: typeof preferenceOptions[K][number] } & { core_plot: string }
// Backend omission/null inherits the previous Arc; genre and style stay read-only.
export type ContinuationPreferences = { [K in keyof Omit<StoryPreferences, 'genre' | 'storytelling_style'>]?: StoryPreferences[K] | null }
export const defaultPreferences: StoryPreferences = {
  genre: 'Adventure', storytelling_style: 'Grounded', interaction_mode: 'Just Read',
  tone: 'Dramatic', length: 'Standard', education_level: 'Senior High', complexity: 'Balanced', core_plot: '',
}
export interface EducationalConcept { id: string; term: string; definition: string; storyContext: string }
export interface AnswerChoices { choices: string[]; correctIndex: number; hint: string; explanation: string; relatedConceptIds: string[] }
export interface ParagraphBlock { type: 'paragraph'; text: string }
export interface DecisionBlock extends AnswerChoices { type: 'decision'; prompt: string }
export interface QuizQuestion extends AnswerChoices { question: string }
export type StoryBlock = ParagraphBlock | DecisionBlock
export interface StoryChapter { chapterNumber: number; title: string; blocks: StoryBlock[]; endQuiz: QuizQuestion[] }
export interface StoryCharacter { name: string; role: string; traits: string[]; relationships: string[]; importantHistory: string[] }
export interface CharacterUpdate { name: string; traits: string[]; relationships: string[]; importantHistory: string[] }
export interface ContinuityUpdate {
  arcSummary: string; newCharacters: StoryCharacter[]; characterUpdates: CharacterUpdate[];
  importantEvents: string[]; newEstablishedFacts: string[]; resolvedThreads: string[];
  unresolvedThreads: string[]; currentState: string; relationshipUpdates: string[]; toneNotes: string;
}
export interface StoryArc {
  arc_id: string; series_id: string; lesson_id: string; arc_number: number; preferences: StoryPreferences;
  title: string; summary: string; concepts: EducationalConcept[]; chapters: StoryChapter[];
  continuityUpdate: ContinuityUpdate; created_at: string;
}
export interface StorySeries {
  series_id: string; title: string; genre: StoryPreferences['genre']; storytelling_style: StoryPreferences['storytelling_style'];
  arc_ids: string[]; created_at: string; updated_at: string;
}
export interface StoryCreated { series_id: string; arc_id: string; arc_number: number }
export interface GenerateStoryRequest { lesson_id: string; preferences: StoryPreferences }
export interface ContinueStoryRequest { lesson_id: string; preferences: ContinuationPreferences }
export interface ApiErrorResponse { detail?: unknown }
