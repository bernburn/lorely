"""Deterministic UNIT/CONTRACT fixtures, never a live Gemini substitute."""
from copy import deepcopy
from types import SimpleNamespace

from bson import ObjectId


def generated_story(*, solve=False, continuation=False):
    character = {"name": "Mira", "role": "Student", "traits": ["analytical"],
                 "relationships": [], "importantHistory": ["Found an unknown device"]}
    update = {
        "arcSummary": "Mira traced the device's packets.",
        "newCharacters": [] if continuation else [character],
        "characterUpdates": [{"name": "Mira", "traits": ["persistent"], "relationships": [],
                              "importantHistory": ["Protected the school's network"]}] if continuation else [],
        "importantEvents": ["Device identified"], "newEstablishedFacts": ["The device belongs to the school"],
        "resolvedThreads": ["Who owns the device?"] if continuation else [],
        "unresolvedThreads": ["Where did the second signal originate?"] if continuation else ["Who owns the device?"],
        "currentState": "The network is secure" if continuation else "Mira investigates the device",
        "relationshipUpdates": [], "toneNotes": "Dramatic",
    }
    question = {"question": "Why inspect the routing table?", "choices": ["To find a route", "To change the screen"],
                "correctIndex": 0, "hint": "Think about the packet's destination", "explanation": "Routers need routes to forward packets.",
                "relatedConceptIds": ["router"]}
    chapters = [{"chapterNumber": i, "title": f"The discovery {i}",
                 "blocks": [{"type": "paragraph", "text": "Mira followed the packet through the router."}],
                 "endQuiz": [deepcopy(question)]} for i in (1, 2)]
    if solve:
        decision = deepcopy(question)
        decision["prompt"] = decision.pop("question")
        decision["type"] = "decision"
        chapters[0]["blocks"].append(decision)
        chapters[0]["blocks"].append({"type": "paragraph", "text": "The routing table revealed a missing route."})
    result = {"title": "The Unknown Device", "summary": "Students investigate a network mystery.",
              "concepts": [{"id": "router", "term": "Router", "definition": "Forwards packets between networks.",
                            "storyContext": "Mira inspects the routing table."}],
              "chapters": chapters, "continuityUpdate": update}
    if not continuation:
        result.update(seriesTitle="The School Network", initialStoryBible={
            "overallPremise": "Students investigate unusual network traffic", "setting": "A school",
            "characters": [character], "relationships": [], "importantEvents": [], "establishedStoryFacts": [],
            "unresolvedThreads": [], "currentState": "Mira investigates the device", "toneNotes": "Dramatic",
        })
    return result


class UnitCollection:
    def __init__(self, state, name):
        self.state, self.name = state, name
        self.fail_insert = None
        self.force_conflict = False

    async def create_index(self, *args, **kwargs):
        self.state.indexes.append((args, kwargs))

    async def find_one(self, query):
        document = self.state.documents[self.name].get(query["_id"])
        return deepcopy(document)

    async def insert_one(self, document, **kwargs):
        if self.fail_insert:
            raise self.fail_insert
        document = deepcopy(document)
        document.setdefault("_id", ObjectId())
        self.state.documents[self.name][document["_id"]] = document
        return SimpleNamespace(inserted_id=document["_id"])

    async def update_one(self, query, change, **kwargs):
        document = self.state.documents[self.name].get(query["_id"])
        matched = not self.force_conflict and document is not None and document["arc_ids"] == query["arc_ids"]
        if matched:
            document.update(deepcopy(change["$set"]))
        return SimpleNamespace(matched_count=int(matched))


class UnitSession:
    """Snapshot rollback model for contracts; DOES NOT prove MongoDB transactions."""
    def __init__(self, state):
        self.state = state

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def with_transaction(self, callback, **kwargs):
        before = deepcopy(self.state.documents)
        try:
            await callback(self)
            self.state.commits += 1
        except BaseException:
            self.state.documents = before
            self.state.aborts += 1
            raise


class UnitDatabase:
    def __init__(self):
        self.documents = {name: {} for name in ("lessons", "story_series", "story_arcs")}
        self.indexes, self.commits, self.aborts = [], 0, 0
        self.db = SimpleNamespace(**{name: UnitCollection(self, name) for name in self.documents})
        self.client = SimpleNamespace(start_session=lambda: UnitSession(self))

    def require(self):
        return self.db

    async def health(self):
        return "connected", None
