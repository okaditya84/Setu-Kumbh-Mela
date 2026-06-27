"""Realistic case generator.

The official 2,500-row CSV is all *missing* reports — so found↔missing matching
has nothing to match against. This generator produces a larger, diverse, and
realistic population: both MISSING and FOUND reports, real-looking Indian names
(by region + gender), valid mobiles, multilingual descriptions, real centers and
gazetteer locations, timestamps clustered on Amrit Snan days — plus deliberately
**planted true cross-center pairs** (a missing report + the matching found report
at another center) so genuine reunions and notifications occur in the demo.

Deterministic given a seed, so runs are reproducible.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from app.geo.gazetteer import GAZETTEER

# --- name pools (common, realistic, pan-India) ---
MALE = ["Ramesh", "Suresh", "Mahesh", "Rajesh", "Mohan", "Sohan", "Vijay", "Ajay", "Anil", "Sunil",
        "Manoj", "Sanjay", "Arun", "Vinod", "Prakash", "Dinesh", "Mukesh", "Ashok", "Gopal", "Govind",
        "Shyam", "Ram", "Bharat", "Kishan", "Madan", "Naresh", "Hari", "Shankar", "Deepak", "Pramod",
        "Bhaskar", "Raghunath", "Narayan", "Devendra", "Hemant", "Kailash", "Lakshman", "Murali", "Satish", "Tukaram"]
FEMALE = ["Savita", "Sunita", "Kavita", "Lata", "Geeta", "Sita", "Radha", "Kamla", "Vimla", "Sushila",
          "Anita", "Rekha", "Pushpa", "Shanti", "Sarla", "Usha", "Meena", "Lakshmi", "Parvati", "Durga",
          "Sarita", "Mamta", "Asha", "Nirmala", "Saraswati", "Janaki", "Gita", "Kalpana", "Indira", "Vandana",
          "Manju", "Shobha", "Leela", "Yashoda", "Anjali", "Bhagyashree", "Chandrakala", "Damayanti", "Ratna", "Sundari"]
SURNAMES = ["Sharma", "Verma", "Gupta", "Patel", "Reddy", "Nair", "Iyer", "Rao", "Singh", "Yadav",
            "Kumar", "Desai", "Joshi", "Pawar", "Patil", "Deshmukh", "Naik", "Shah", "Mehta", "Das",
            "Roy", "Banerjee", "Mukherjee", "Pillai", "Menon", "Chauhan", "Jadhav", "Shinde", "Gaikwad",
            "Kulkarni", "Trivedi", "Mishra", "Pandey", "Tiwari", "Dubey", "Agarwal", "Jain", "Bhosale", "More", "Sawant"]

# Plausible (state, districts, primary languages) tuples.
REGIONS = [
    ("Maharashtra", ["Nashik", "Pune", "Nagpur", "Aurangabad", "Solapur"], ["Marathi", "Hindi"]),
    ("Uttar Pradesh", ["Varanasi", "Prayagraj", "Lucknow", "Gorakhpur"], ["Hindi", "Awadhi", "Bhojpuri"]),
    ("Bihar", ["Patna", "Gaya", "Nalanda", "Darbhanga"], ["Hindi", "Maithili", "Bhojpuri"]),
    ("Gujarat", ["Ahmedabad", "Surat", "Anand", "Rajkot"], ["Gujarati", "Hindi"]),
    ("Rajasthan", ["Jaipur", "Jodhpur", "Udaipur", "Ajmer"], ["Hindi", "Marwari"]),
    ("Madhya Pradesh", ["Bhopal", "Indore", "Jabalpur", "Rewa"], ["Hindi"]),
    ("West Bengal", ["Kolkata", "Howrah", "Darjeeling"], ["Bengali", "Hindi"]),
    ("Tamil Nadu", ["Chennai", "Madurai", "Coimbatore"], ["Tamil"]),
    ("Karnataka", ["Bengaluru", "Mysuru", "Hubli"], ["Kannada"]),
    ("Andhra Pradesh", ["Vijayawada", "Guntur", "Tirupati"], ["Telugu"]),
    ("Kerala", ["Kochi", "Thrissur", "Kozhikode"], ["Malayalam"]),
    ("Odisha", ["Bhubaneswar", "Cuttack", "Puri"], ["Odia", "Hindi"]),
    ("Punjab", ["Amritsar", "Ludhiana", "Patiala"], ["Punjabi", "Hindi"]),
    ("Assam", ["Guwahati", "Dibrugarh"], ["Assamese", "Hindi"]),
]

CENTERS = [
    "Ramkund Kho-Ya-Paya Kendra", "Trimbakeshwar Kho-Ya-Paya Kendra", "Panchavati Center",
    "Adgaon Kho-Ya-Paya", "Nashik Road Center", "Sadhugram Lost Found", "Central Control Room",
    "Bharat Bharati Control Room", "Police Main Control Room", "Rajur Bahula Center", "Tapovan Help Desk",
]
AGE_WEIGHTED = ["0-12"] * 8 + ["13-17"] * 3 + ["18-40"] * 10 + ["41-60"] * 18 + \
               ["61-70"] * 28 + ["71-80"] * 21 + ["80+"] * 12  # elderly-heavy, like reality

# Clothing colours (sometimes in another language, like real reports).
COLOR_VARIANTS = {
    "white": ["white", "safed", "pandhra saree", "vellai"], "saffron": ["saffron", "bhagwa", "kesari"],
    "red": ["red", "lal"], "green": ["green", "hara"], "yellow": ["yellow", "peela"],
    "blue": ["blue", "neela"], "brown": ["brown", "khaki"],
}
MALE_GARMENTS = ["dhoti kurta", "kurta pajama", "white vest and dhoti", "shirt and pant", "lungi"]
FEMALE_GARMENTS = ["saree", "salwar kameez", "nine-yard saree", "cotton saree"]
TRAITS = ["has a walking stick", "wears thick spectacles", "hard of hearing, has a hearing aid",
          "rudraksha mala", "tilak on forehead", "cannot remember the way back", "keeps asking for the ghat",
          "limps slightly", "white beard", "bald", "vermilion sindoor", "widow, white clothes", ""]

LOCATIONS = list(GAZETTEER.keys())


def _mobile(rng: random.Random) -> str:
    return "+91 " + str(rng.choice("6789")) + "".join(rng.choice("0123456789") for _ in range(9))


def _person(rng: random.Random):
    gender = rng.choice(["Male", "Female"])
    name = f"{rng.choice(MALE if gender == 'Male' else FEMALE)} {rng.choice(SURNAMES)}"
    state, districts, langs = rng.choice(REGIONS)
    return {
        "gender": gender, "name": name, "state": state,
        "district": rng.choice(districts), "language": rng.choice(langs),
        "age_band": rng.choice(AGE_WEIGHTED),
    }


def _describe(p: Dict, rng: random.Random) -> str:
    g = p["gender"]
    age_word = "elderly" if p["age_band"] in ("61-70", "71-80", "80+") else ("child" if p["age_band"] == "0-12" else "")
    noun = "man" if g == "Male" else "woman"
    if p["age_band"] == "0-12":
        noun = "boy" if g == "Male" else "girl"
    color = rng.choice(list(COLOR_VARIANTS))
    color_word = rng.choice(COLOR_VARIANTS[color])
    garment = rng.choice(MALE_GARMENTS if g == "Male" else FEMALE_GARMENTS)
    trait = rng.choice(TRAITS)
    parts = [f"{age_word} {noun}".strip(), f"in {color_word} {garment}"]
    if trait:
        parts.append(trait)
    return ", ".join(parts)


# Amrit Snan-like spike days within the mela window.
_SNAN = [datetime(2027, 7, 14, tzinfo=timezone.utc), datetime(2027, 7, 28, tzinfo=timezone.utc),
         datetime(2027, 8, 11, tzinfo=timezone.utc), datetime(2027, 8, 26, tzinfo=timezone.utc)]
_WINDOW_START = datetime(2027, 7, 1, tzinfo=timezone.utc)


def _ts(rng: random.Random) -> datetime:
    if rng.random() < 0.45:  # cluster on snan days
        base = rng.choice(_SNAN)
        return base + timedelta(hours=rng.uniform(-6, 14))
    return _WINDOW_START + timedelta(days=rng.uniform(0, 75), hours=rng.uniform(0, 24))


def _row(p: Dict, case_type: str, rng: random.Random, *, loc: Optional[str] = None,
         center: Optional[str] = None, mobile: bool = True, name: bool = True,
         ts: Optional[datetime] = None) -> Dict:
    return {
        "case_type": case_type,
        "person_name": p["name"] if name else None,
        "gender": p["gender"], "age_band": p["age_band"], "state": p["state"],
        "district": p["district"], "language": p["language"],
        "last_seen_location": loc or rng.choice(LOCATIONS),
        "physical_description": _describe(p, rng),
        "reporting_center": center or rng.choice(CENTERS),
        "reporter_mobile": _mobile(rng) if mobile else None,
        "reported_at": ts or _ts(rng),
    }


def generate(n: int, found_ratio: float, planted_pairs: int, seed: int = 2027) -> List[Dict]:
    """Return n synthetic case dicts incl. `planted_pairs` true missing/found pairs."""
    rng = random.Random(seed)
    rows: List[Dict] = []

    # Planted true pairs: same person, two centers, found a bit after missing.
    for _ in range(planted_pairs):
        p = _person(rng)
        loc_m, loc_f = rng.sample(LOCATIONS, 2) if len(LOCATIONS) > 1 else (LOCATIONS[0], LOCATIONS[0])
        c_m, c_f = rng.sample(CENTERS, 2)
        t = _ts(rng)
        # Family report often has the name; found report often does not.
        rows.append(_row(p, "missing", rng, loc=loc_m, center=c_m, ts=t))
        rows.append(_row(p, "found", rng, loc=loc_f, center=c_f, name=rng.random() < 0.3,
                         mobile=False, ts=t + timedelta(hours=rng.uniform(0.5, 20))))

    # Remaining independent cases (mix of missing/found).
    remaining = max(0, n - len(rows))
    for _ in range(remaining):
        p = _person(rng)
        ctype = "found" if rng.random() < found_ratio else "missing"
        # Realistic missingness: ~15% no name, ~20% no mobile.
        rows.append(_row(p, ctype, rng, name=rng.random() > 0.15, mobile=rng.random() > 0.20))

    rng.shuffle(rows)
    return rows
