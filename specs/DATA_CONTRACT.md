# DATA_CONTRACT.md

## Purpose
Defines all data shapes. Do not invent or mutate fields.

---

## Fixture Object
- fixture_id
- league
- home_team
- away_team
- kickoff_time (GMT+1)
- match_date

---

## Polymarket Market Object
- fixture_id
- market_type
- option
- probability
- volume

---

## Groq Output (Per Market)
- fixture_id
- market_type
- confidence_signal (0–100)
- reasoning
- risk_factors
- failure_conditions

---

## Gemini Output (Per Market)
- fixture_id
- market_type
- overconfidence (boolean)
- missing_context (boolean)
- caution_level (none | mild | strong)
- note (optional)

---

## Engine Evaluation Output
- fixture_id
- market_type
- base_score
- penalties_applied
- final_score

---

## Final Pick Object
- fixture_id
- primary_market
- primary_probability
- primary_rationale
- alternative_market (optional)
- alternative_probability (optional)
- alternative_rationale (optional)
- risk_note
- engine_version
- ruleset_id

---

## History Record (Append-Only)
- fixture_id
- league
- kickoff_time
- primary_market
- alternative_market (if any)
- rationale_snapshot
- final_result (win | loss | push)
- engine_version
- ruleset_id
- settlement_date
