export const addFeatureNotes = `
Add-feature checklist:
- Identify the natural insertion point: existing route, layout, model, or component
- Add new files first, then minimal edits to wire them in (navigation links, parent layouts, schema additions)
- If a Prisma model is involved, update prisma/schema.prisma AND emit "npx prisma generate" in postCommands
- If the feature requires a new env var, list it in the rationale (don't try to write secrets to .env)
- Prefer composing existing components over duplicating styles
`.trim();
