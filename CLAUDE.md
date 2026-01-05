# CLAUDE.md

This file defines how Claude should assist in this repository.
The goal is speed with intent, not automation without understanding.

Claude is used as a collaborator, not an autonomous agent.

---

## General Principles

- Prioritize clarity over cleverness
- Optimize for readability and learning
- Make minimal, intentional changes
- Avoid overengineering or premature abstractions

---

## Workflow & Safety

### 1. Skip permission prompts only in trusted repos

Command:
claude --dangerously-skip-permissions

Why:

- Speeds up iteration in personal or trusted projects
- Avoids constant confirmation prompts

Guideline:

- Use only in repos I fully control
- Treat like `sudo`: powerful, not casual

---

### 2. Enable multiline input for better prompts

Command:
/terminal-setup

Why:

- Enables Shift + Enter for new lines
- Prevents accidental submissions
- Makes structured prompts easier to write

Recommended to run once per environment.

---

## Code Style & Comments

### 3. Comment intent, not implementation

Rule:

- Comments should explain **why**, not **what**

Good comments capture:

- intent
- constraints
- tradeoffs
- non-obvious decisions

Bad comments restate code behavior.

Guideline:

- If removing the comment would cause confusion later, keep it
- Otherwise, let the code speak

---

## UI & Design Decisions

### 4. Prefer existing patterns over inventing new ones

Rule:

- Reuse existing components and UI patterns before creating new UI

Why:

- Maintains visual consistency
- Reduces decision fatigue
- Prevents UI drift

Guideline:

- Extend existing components when possible
- Build the simplest version first
- Avoid one-off styles unless justified

---

## Change Management

### 5. Do not refactor unless explicitly requested

Rule:

- Do not refactor existing code unless I ask for it

Why:

- Refactors can introduce subtle bugs
- I want control over structural changes
- Focus on incremental improvements

---

### 6. Prefer minimal diffs over ideal architecture

Rule:

- Make the smallest change that solves the problem

Why:

- Easier to review
- Easier to learn from
- Reduces accidental breakage

Avoid rewriting entire files unless necessary.

---

## Dependencies

### 7. Justify new dependencies before adding them

Rule:

- Before adding a new package or library, explain:
  - what problem it solves
  - why built-in or existing code is insufficient
  - the tradeoffs of adding it

Guideline:

- Prefer built-in tools and simple code first
- Add dependencies only when they clearly reduce complexity or risk

---

## Reasoning & Communication

### 8. Explain tradeoffs for non-obvious decisions

Rule:

- When making a non-trivial choice, explain why briefly

Examples:

- folder structure
- component boundaries
- data fetching approach

Keep explanations short and practical.

---

### 9. Optimize for readability over cleverness

Rule:

- Prefer clear, boring code over clever solutions

Why:

- This is a learning-focused project
- Readability matters more than micro-optimizations
- Future-me should understand this quickly

---

### 10. Flag uncertainty instead of guessing

Rule:

- If unsure about behavior or best approach, say so

Why:

- I prefer explicit uncertainty over silent assumptions
- Decisions should be shared, not inferred

---

## Final Note

Claude should:

- assist, not override
- suggest, not assume
- explain, not lecture

The goal is intentional progress and retained understanding.
