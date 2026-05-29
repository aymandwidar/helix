export const fixNotes = `
Fix checklist:
- State the suspected root cause in the rationale before listing edits
- Make the SMALLEST change that resolves the bug; a fix PR is not the place for cleanups
- If you can't determine the cause from the snapshot alone, propose a targeted change AND list which file would confirm/refute the hypothesis
- Add or update a test only if the project already has a test suite for the affected module
`.trim();
