"""Pure Story Bible updates. Reject inconsistent changes before persistence."""
from app.schemas.series import ContinuityUpdate, StoryBible


def merge_entries(existing: list[str], additions: list[str]) -> list[str]:
    result = list(existing)
    known = {entry.casefold() for entry in result}
    for entry in additions:
        if entry.casefold() not in known:
            result.append(entry)
            known.add(entry.casefold())
    return result


def update_bible(bible: StoryBible, update: ContinuityUpdate, *, initial: bool = False) -> StoryBible:
    data = bible.model_dump()
    characters = {c["name"].casefold(): c for c in data["characters"]}
    for character in update.newCharacters:
        key = character.name.casefold()
        if key in characters and not initial:
            raise ValueError("New characters must not overwrite established characters")
        if key not in characters:
            characters[key] = character.model_dump()
        elif initial:
            for field in ("traits", "relationships", "importantHistory"):
                characters[key][field] = merge_entries(characters[key][field], getattr(character, field))
    for change in update.characterUpdates:
        key = change.name.casefold()
        if key not in characters:
            raise ValueError("Character updates must reference known characters")
        for field in ("traits", "relationships", "importantHistory"):
            characters[key][field] = merge_entries(characters[key][field], getattr(change, field))
    data["characters"] = list(characters.values())
    data["relationships"] = merge_entries(data["relationships"], update.relationshipUpdates)
    data["importantEvents"] = merge_entries(data["importantEvents"], update.importantEvents)
    data["establishedStoryFacts"] = merge_entries(data["establishedStoryFacts"], update.newEstablishedFacts)
    resolved = {thread.casefold() for thread in update.resolvedThreads}
    if not initial and not resolved <= {thread.casefold() for thread in bible.unresolvedThreads}:
        raise ValueError("Resolved threads must reference established unresolved threads")
    data["unresolvedThreads"] = merge_entries(
        [thread for thread in data["unresolvedThreads"] if thread.casefold() not in resolved], update.unresolvedThreads,
    )
    data["currentState"] = update.currentState
    if update.toneNotes:
        data["toneNotes"] = update.toneNotes
    return StoryBible.model_validate(data)


def initialize_bible(bible: StoryBible, update: ContinuityUpdate) -> StoryBible:
    return update_bible(bible, update, initial=True)
