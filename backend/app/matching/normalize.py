"""Intake normalization - turn messy free text into structured, comparable fields.

This module is the deterministic backbone behind several of the hard matching
edge cases:

* **Cross-language clothing colour** - "safed" / "vellai" / "shada" / "pandhra"
  all normalise to ``white``. A finite colour vocabulary across Indian languages.
* **Stable vs transient descriptors** - a walking stick, blindness, a hearing aid
  or a rudraksha mala are *stable* (high value); clothing colour is *transient*
  (drifts through the day) and is scored separately and weighted down.
* **Nicknames** - "Raju" expands to {raj, rajesh, rajendra, rajkumar, raju}.
  Deterministic for the common pet-names; the LLM layer reasons about the rest.
* **Child age in free text** - "about 6 years" → age_band ``0-12``.

Everything here runs offline with no model. The optional LLM enrichment in
``app/matching/engine.py`` only *adds* to what this produces; it is never required.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional

import jellyfish

# --------------------------------------------------------------------------
# Cross-language clothing colour lexicon -> canonical English colour.
# Transliterated tokens across Hindi/Marathi/Bengali/Telugu/Tamil/Gujarati/
# Kannada/Malayalam/Punjabi/Urdu + the dataset's Maithili/Bhojpuri/Awadhi.
# --------------------------------------------------------------------------
COLOR_LEXICON: Dict[str, str] = {}
def _reg(canon: str, *words: str) -> None:
    for w in words:
        COLOR_LEXICON[w.lower()] = canon

_reg("white", "white", "safed", "saphed", "vellai", "shada", "sada", "dhavala", "pandhra", "pandhara",
     "tella", "bili", "vella", "chitta", "ujla", "ujjwal")
_reg("black", "black", "kala", "kaala", "karuppu", "kalo", "nalla", "kappu", "karutha", "kaali", "krishna")
_reg("red", "red", "lal", "laal", "sivappu", "erra", "kempu", "chuvappu", "rakta", "tambada")
_reg("green", "green", "hara", "haraa", "pachai", "shobuj", "pacha", "hasiru", "hari", "hirva")
_reg("blue", "blue", "neela", "neelaa", "nila", "nil", "neeli", "aakash", "nila")
_reg("yellow", "yellow", "peela", "peelaa", "manjal", "holud", "pasupu", "haladi", "manja", "arisina", "pivla", "pivala")
_reg("saffron", "saffron", "orange", "kesari", "kesariya", "bhagwa", "bhagva", "narangi", "kavi", "geru", "santra")
_reg("pink", "pink", "gulabi", "gulaabi")
_reg("brown", "brown", "bhura", "bhoora", "badami", "khaki")
_reg("grey", "grey", "gray", "ash", "dhusar", "sleti", "rakhi")
_reg("purple", "purple", "baingani", "jamuni", "behangi")

# --------------------------------------------------------------------------
# Stable physical / accessory descriptors -> canonical tag. These barely change
# between two sightings of the same person, so they are strong matching signal.
# --------------------------------------------------------------------------
STABLE_LEXICON: Dict[str, str] = {}
def _regs(canon: str, *words: str) -> None:
    for w in words:
        STABLE_LEXICON[w.lower()] = canon

_regs("walking_stick", "walking stick", "stick", "lathi", "cane", "kathi", "support stick")
_regs("wheelchair", "wheelchair", "wheel chair")
_regs("crutches", "crutch", "crutches")
_regs("blind", "blind", "andha", "cannot see", "no vision", "visually impaired")
_regs("deaf_hearing_aid", "hearing aid", "deaf", "cannot hear", "bahira")
_regs("spectacles", "spectacles", "glasses", "chashma", "chasma")
_regs("bald", "bald", "ganja", "no hair")
_regs("beard", "beard", "daadhi", "dadhi")
_regs("white_beard", "white beard", "grey beard", "safed daadhi")
_regs("limp", "limp", "limping", "langda")
_regs("rudraksha", "rudraksha", "rudraksh", "mala")
_regs("tilak", "tilak", "tika", "tikka")
_regs("bindi", "bindi", "bottu")
_regs("sindoor", "sindoor", "sindur", "vermilion")
_regs("turban", "turban", "pagdi", "pagri", "safa")
_regs("cap", "topi", "cap", "skullcap")
_regs("widow_marks", "widow", "widow marks", "white saree widow")
_regs("memory_loss", "cannot remember", "forgets", "confused", "alzheimer", "dementia", "keeps asking")
_regs("mute", "cannot speak", "mute", "unable to speak", "speech")
_regs("child_crying", "crying", "weeping")
_regs("pregnant", "pregnant")
_regs("burqa", "burqa", "burkha", "hijab")

# Garment tokens (context only; not heavily weighted).
GARMENT_TOKENS = {
    "kurta", "dhoti", "saree", "sari", "frock", "shirt", "pant", "pants", "vest",
    "uniform", "salwar", "kameez", "lungi", "shawl", "sweater", "jacket", "blouse",
    "skirt", "burqa",
}

# --------------------------------------------------------------------------
# Nickname / pet-name expansion. Common Indian diminutives -> formal roots.
# --------------------------------------------------------------------------
NICKNAME_MAP: Dict[str, List[str]] = {
    "raju": ["raj", "rajesh", "rajendra", "rajkumar", "raju"],
    "raj": ["raj", "rajesh", "rajendra", "rajkumar", "raju"],
    "sonu": ["sonu", "sohan", "sona"],
    "monu": ["monu", "manoj", "mohan"],
    "chhotu": ["chhotu", "chotu"],
    "munna": ["munna", "manish", "manoj"],
    "pappu": ["pappu", "prashant", "pradeep"],
    "bittu": ["bittu", "bipin", "vinod"],
    "chintu": ["chintu", "chetan", "chitranjan"],
    "golu": ["golu", "gopal", "govind"],
    "tinku": ["tinku", "tarun"],
    "rinku": ["rinku", "rajni"],
    "babli": ["babli", "babita"],
    "gudiya": ["gudiya", "gudia"],
    "pinky": ["pinky", "priya", "pinki"],
    "ramu": ["ramu", "ram", "ramesh", "ramkumar"],
    "shyamu": ["shyamu", "shyam", "shyamlal"],
    "lalu": ["lalu", "lal", "lalit"],
    "kaku": ["kaku", "kamal"],
}

_AGE_PAT = re.compile(r"(\d{1,2})\s*(?:-\s*(\d{1,2}))?\s*year", re.IGNORECASE)
_WORD = re.compile(r"[a-zA-Z]+")


def age_to_band(age: int) -> str:
    if age <= 12:
        return "0-12"
    if age <= 17:
        return "13-17"
    if age <= 40:
        return "18-40"
    if age <= 60:
        return "41-60"
    if age <= 70:
        return "61-70"
    if age <= 80:
        return "71-80"
    return "80+"


def name_keys(name: Optional[str]) -> List[str]:
    """Phonetic + nickname-expanded keys for a (possibly informal) name."""
    if not name:
        return []
    keys: set[str] = set()
    for raw in _WORD.findall(name.lower()):
        if len(raw) < 2:
            continue
        keys.add(raw)
        for expanded in NICKNAME_MAP.get(raw, []):
            keys.add(expanded)
        try:
            keys.add("MP:" + jellyfish.metaphone(raw))
            keys.add("SX:" + jellyfish.soundex(raw))
        except Exception:
            pass
    return sorted(keys)


def extract_descriptors(text: Optional[str]) -> Dict[str, object]:
    """Pull canonical colours, stable descriptors, garments and any stated age."""
    res: Dict[str, object] = {"colors": [], "stable": [], "garments": [], "age_years": None}
    if not text:
        return res
    low = " " + text.lower() + " "

    colors: set[str] = set()
    for token, canon in COLOR_LEXICON.items():
        if re.search(r"\b" + re.escape(token) + r"\b", low):
            colors.add(canon)
    res["colors"] = sorted(colors)

    stable: set[str] = set()
    for token, canon in STABLE_LEXICON.items():
        if token in low:
            stable.add(canon)
    res["stable"] = sorted(stable)

    garments = {g for g in GARMENT_TOKENS if re.search(r"\b" + re.escape(g) + r"\b", low)}
    res["garments"] = sorted(garments)

    m = _AGE_PAT.search(text)
    if m:
        lo = int(m.group(1))
        hi = int(m.group(2)) if m.group(2) else lo
        res["age_years"] = (lo + hi) // 2
    return res


def build_normalized(
    *,
    person_name: Optional[str],
    age_band: Optional[str],
    physical_description: Optional[str],
) -> Dict[str, object]:
    """Compute the structured ``normalized`` blob stored on each Case."""
    desc = extract_descriptors(physical_description)
    inferred_band = None
    if desc["age_years"] is not None:
        inferred_band = age_to_band(int(desc["age_years"]))
    return {
        "name_keys": name_keys(person_name),
        "colors": desc["colors"],
        "stable": desc["stable"],
        "garments": desc["garments"],
        "age_years": desc["age_years"],
        # If free text states a child age and the structured band is blank/wrong,
        # surface the inferred band so blocking can use it.
        "inferred_age_band": inferred_band,
    }
