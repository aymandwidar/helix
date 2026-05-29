export const migrateNotes = `
Migrate checklist:
- Bump dependency versions in "packages" with op:"upgrade" — don't edit package.json directly
- Update config files (next.config, tsconfig) to match the new major version's defaults
- Replace deprecated/renamed APIs at every call site (use grep-style mental search across the snapshot)
- Call out breaking changes the user must verify manually in the rationale
- Include any required codemod or migration command in postCommands
`.trim();
