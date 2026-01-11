# Project Kickoff – Spec-Driven Soccer Prediction Engine

This project is **spec-driven** and **stateful via files**.

You must follow the specifications exactly and maintain progress logs so work can resume after interruptions or rate limits.

---

## Step 1: Read Specs (Mandatory)

Before writing, modifying, or suggesting any code, you MUST read and obey **all files** in `/specs`:

- /specs/ENGINE_SPEC.md
- /specs/DATA_CONTRACT.md
- /specs/IMPLEMENTATION_RULES.md
- /specs/DEVOPS_WORKFLOW.md
- /specs/TESTING_PLAYBOOK.md
- /specs/DEV_LOG.md

These files are the **source of truth**.

You must not deviate from them.
If anything is unclear, conflicting, or underspecified, STOP and ask before proceeding.

---

## Project Goal

Build a fully automated, rule-based soccer prediction system that:

- Pulls fixtures for a rolling **2-week window**
- Pulls Polymarket data for supported markets
- Uses **Groq** for per-market analysis (signals only)
- Uses **Gemini** strictly as a risk challenger (flags only)
- Applies **deterministic engine rules** to select:
  - 1 primary pick
  - optional safer alternative
  - or NO BET
- Enforces a hard cap of **5 bets per calendar day**
- Runs automatically via scheduled jobs
- Tracks **permanent, append-only history** with win/loss outcomes

This is:
- NOT a SaaS
- NOT auto-betting
- NOT real-time trading

UI is read-only and explanatory.

---

## Non-Negotiable Rules

- AI does NOT make final decisions
- AI outputs are **inputs/signals only**
- Final decisions are made by deterministic code
- History never expires and is never recomputed
- Settlement must be idempotent
- Cache is NOT history
- No manual triggers for core logic
- Deployment happens via GitHub → Vercel only

---

## AI Responsibilities (Strict)

### Groq
- Analyzes each market independently
- Provides reasoning, confidence signal, risk factors
- Does NOT choose bets
- Does NOT see Gemini output

### Gemini
- Challenges Groq output only
- Flags:
  - overconfidence
  - missing context
  - caution level
- Does NOT choose bets
- Does NOT rescore
- Does NOT feed back into Groq

Final evaluation is done by **engine code only**.

---

## Development Logging (Mandatory)

You must use `/specs/DEV_LOG.md` as a **persistent development log**.

Rules:
- Read DEV_LOG.md before starting any work
- Update DEV_LOG.md after each completed task
- Before stopping work (or if you suspect a rate limit), write:
  - what was completed
  - what is currently in progress
  - what remains next
- Append updates clearly; do NOT overwrite previous entries

This file is how progress survives interruptions.

---

## Required Implementation Order

Work in **small, verifiable steps** only.

1. Verify project structure and setup
2. Fixture ingestion (2-week window)
3. Polymarket data access
4. Engine scoring logic (per ENGINE_SPEC.md)
5. Groq integration (analysis only)
6. Gemini integration (risk flags only)
7. Deterministic selection logic
8. Settlement + history archiving
9. History analytics
10. UI rendering (last)

After each major step:
- Briefly summarize what was done
- Clearly state what comes next
- Update DEV_LOG.md

---

## Testing & Verification

- Use /specs/TESTING_PLAYBOOK.md to verify each feature
- A feature is not complete unless it can be verified
- Silent failures are considered broken

---

## Stop Conditions

If unsure about:
- a rule
- a threshold
- a data field
- an edge case
- deployment behavior

STOP and ask.
Do not assume defaults.

---

## Start Here (Required)

Before writing any code:

1. Confirm you have read and understood **all files in `/specs`**
2. Summarize the engine flow briefly in your own words
3. List the non-negotiable rules you will follow
4. Propose the **first concrete implementation step**

Do NOT write code yet.
