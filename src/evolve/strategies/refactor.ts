export const refactorNotes = `
Refactor checklist:
- Preserve external behavior — public exports, route shapes, component props
- When moving a file, include both the new "create" AND a "delete" of the old, plus edits to every import that referenced it
- Do not rename test files unless the source file name changed
- Update tsconfig paths / imports if the move crosses module boundaries
`.trim();
