# IMPLEMENTATION_RULES.md

## Purpose
Defines how Claude must implement this project.

---

## Absolute Rules
- Follow ENGINE_SPEC.md strictly
- Respect DATA_CONTRACT.md exactly
- Ask before changing logic
- No silent assumptions
- No unapproved “improvements”

---

## Architecture Rules
- KV / cache = operational only
- History = append-only, no TTL
- Settlement must be idempotent
- Cron failure must not lose data

---

## Development Workflow
1. Implement engine logic
2. Implement settlement
3. Implement history persistence
4. Implement UI

---

## Evaluation Rules
- Never recompute past predictions
- History reflects belief at prediction time
- Engine versioning is mandatory

---

## Final Reminder
AI informs  
Rules decide  
History judges
