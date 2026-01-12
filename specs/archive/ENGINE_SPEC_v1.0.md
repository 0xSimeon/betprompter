# ENGINE_SPEC.md

## Purpose
Defines the betting engine logic. This document is the source of truth.
Do not deviate. Ask if anything is unclear.

---

## Core Principles (Non-Negotiable)

- Engine is rule-based and deterministic
- AI models do not make decisions
- AI outputs are signals only
- Final decisions are made by code
- Same inputs must always produce same outputs
- History is permanent and append-only

---

## Supported Competitions
- EPL
- La Liga
- Serie A
- Bundesliga
- Ligue 1
- Champions League

---

## Fixture Scope
- Rolling 2-week window
- Fixtures grouped by calendar day (GMT+1)

---

## Supported Markets (Only These)
- Match Result (ML): Home / Draw / Away
- Double Chance: 1X, X2
- Over 1.5 Goals
- Over 2.5 Goals

No other markets allowed.

---

## Automation Model

- All core processes run automatically via scheduled jobs
- No manual triggers for:
  - fixture ingestion
  - engine execution
  - settlement
  - history archiving
- UI is strictly read-only
- Cron jobs must be safe to re-run (idempotent)


## Data Flow (Locked)

1. Fetch fixtures (2-week window)
2. Fetch Polymarket data for fixtures
   - probabilities
   - volume / liquidity
3. For each fixture and market:
   - pass PM data to Groq
4. Pass Groq output + PM data to Gemini
5. Gemini returns risk flags only
6. Engine applies deterministic scoring
7. Engine selects primary, alternative, or NO BET
8. Show results on website
9. Settled results written to history

---

## AI Responsibilities

### Groq (Primary Analyst)
Evaluates each market independently and outputs:
- qualitative reasoning
- confidence signal
- risk factors
- failure conditions

Groq does not:
- decide bets
- see Gemini output
- know final rules

---

### Gemini (Risk Challenger)
Receives Groq output + PM data.
Answers only:
- Is this overconfident?
- What is being ignored?
- Is caution warranted?

Outputs:
- overconfidence: true/false
- missing_context: true/false
- caution_level: none | mild | strong

Gemini does not:
- choose markets
- rescore
- decide outcomes
- feed back into Groq

---

## Scoring Model (Engine-Owned)

Each market:
- gets a base score
- receives penalties from Gemini flags

### Base Inputs
- PM probability
- PM volume threshold
- market risk weight

### Gemini Penalties (Example)
- Overconfidence: -10
- Missing context: -15
- Mild caution: -5
- Strong caution: -20

Values are tunable constants.

---

## Market Risk Bias
Lowest to highest variance:
1. Over 1.5
2. Double Chance
3. Over 2.5
4. ML

Favor lower variance when scores are close.

---

## Selection Logic (Per Fixture)

1. Rank markets by final score
2. If highest < threshold → NO BET
3. Primary pick = highest score
4. Alternative pick:
   - second-highest score
   - within margin
   - usually lower variance
5. NO BET should be rare

---

## Daily Cap Rule
- Max 5 bets per calendar day
- If more qualify:
  - keep top 5
  - discard rest

---

## Output Requirements

For each bet:
- Primary pick:
  - market
  - engine probability
  - 3–4 sentence rationale
- Alternative pick (if any):
  - market
  - engine probability
  - shorter rationale
- Risk note:
  - 1 sentence from Gemini concern

---

## Explicitly Forbidden
- AI deciding final picks
- ML-only gatekeeping
- Lineups or team news (v1)
- Recomputing past predictions
- Overwriting history
- TTL on history
