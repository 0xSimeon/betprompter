# TESTING_PLAYBOOK.md

## Purpose
Defines how to verify that the system works correctly at every layer:
- data ingestion
- AI integrations
- engine logic
- automation
- history and analytics

This is a verification playbook, not a unit test suite.

---

## Testing Philosophy

- Prefer deterministic checks over opinions
- Test layers independently
- Do not trust AI output without structure validation
- History correctness > UI polish
- If something fails silently, treat it as broken

---

## Layer 1: Fixture Ingestion

### What to Verify
- Fixtures are fetched for a rolling 2-week window
- Dates are correct (GMT+1)
- Fixture IDs are stable

### How to Test
- Log number of fixtures fetched per day
- Pick one date and manually confirm fixtures exist
- Confirm no duplicate fixtures across runs

### Expected Outcome
- Fixture counts make sense
- No missing days
- No duplication

---

## Layer 2: Polymarket Data

### What to Verify
- Markets exist for some fixtures (not all)
- Probabilities are numeric
- Volume is present

### How to Test
- Log PM markets for 1–2 fixtures
- Confirm probabilities sum correctly per market
- Confirm volume threshold logic filters thin markets

### Expected Outcome
- PM data aligns with fixtures
- Low-liquidity matches are skipped gracefully

---

## Layer 3: Groq Integration

### What to Verify
- Requests are sent successfully
- Responses follow DATA_CONTRACT.md
- Output is market-specific

### How to Test
- Run Groq on one fixture, one market
- Log raw response
- Validate required fields exist

### Expected Outcome
- Reasoning is present
- Confidence signal exists
- No hallucinated fields

Quality is NOT judged here, only structure.

---

## Layer 4: Gemini Integration

### What to Verify
- Gemini receives Groq output + PM data
- Gemini returns flags only

### How to Test
- Log Gemini raw response
- Confirm only allowed fields are returned

### Expected Outcome
- overconfidence flag present
- caution_level valid
- No market suggestions or decisions

---

## Layer 5: Engine Logic (Critical)

### What to Verify
- Deterministic behavior
- Penalties apply correctly
- Primary + alternative selection logic works
- NO BET triggers only when justified

### How to Test
- Freeze inputs (fixture + PM + Gemini flags)
- Run engine multiple times
- Change one input at a time

### Expected Outcome
- Same input → same output
- Penalties reduce scores predictably
- Alternative appears when score gap is small

This is the most important test layer.

---

## Layer 6: Daily Cap Enforcement

### What to Verify
- Max 5 bets per calendar day
- Excess qualified bets are discarded

### How to Test
- Simulate more than 5 qualifying fixtures on same day
- Log selected bets

### Expected Outcome
- Exactly 5 bets selected
- Highest scores retained

---

## Layer 7: Automation / Cron Jobs

### What to Verify
- Jobs run without manual triggers
- Jobs are idempotent
- Failures do not lose data

### How to Test
- Manually invoke cron handlers locally
- Run settlement twice on same data

### Expected Outcome
- No duplicate history records
- Unfinished matches remain unsettled
- Finished matches settle once

---

## Layer 8: History Persistence

### What to Verify
- History records never expire
- Records are append-only
- Past predictions are never recomputed

### How to Test
- Complete a fixture
- Run settlement
- Inspect history store

### Expected Outcome
- One immutable history record per match
- Correct win/loss evaluation
- Rationale snapshot preserved

---

## Layer 9: Analytics Validation

### What to Verify
- History page displays records
- Win/loss counts are correct
- Market breakdowns make sense

### How to Test
- Compare history records with displayed stats
- Manually verify a few outcomes

### Expected Outcome
- Stats match raw history
- No missing or duplicated entries

---

## Debug Mode (Recommended)

When DEBUG_MODE is enabled:
- Log raw API responses
- Log AI inputs and outputs
- Log engine scores per market

DEBUG_MODE must be disabled in production.

---

## When to Stop and Investigate

Stop immediately if:
- History page is empty after settled matches
- AI outputs contain unexpected fields
- Engine output changes with same input
- Cron jobs delete or overwrite data

These indicate structural bugs.

---

## Final Rule
If a feature cannot be verified using this playbook,
it is not considered complete.
