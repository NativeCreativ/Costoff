# Comment Rules (AI + developers must follow)

1. Every comment is ONE line, max ~100 characters. No multi-line comments.
2. Explain WHY, not WHAT. If the code is self-explanatory, write no comment.
3. Never write block comments (/* ... */) or multi-line JSDoc. Use `// why` only.
4. No obvious comments (bad: `// set loading true`; good: `// retry once: API drops first call`).
5. Plain simple English, no jargon, no story, no history ("earlier we did...").
6. Do not comment every function. Comment only non-obvious logic, business rules, workarounds.
7. Business rule format: `// Rule: <short rule>` (e.g. `// Rule: company rounds are the source of truth`).
8. TODO format: `// TODO: <short task>` (one line, no names or dates).
9. Do not comment out old code; delete it (git keeps history).
10. When editing a file, keep existing comments one-line too; never expand them.
11. Directives (eslint-disable, ts-ignore) stay as-is with a short reason.