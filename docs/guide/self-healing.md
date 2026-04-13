# Self-Healing

Helix includes an AI-powered self-healing system that automatically fixes build errors, invalid Prisma schemas, and syntax issues in generated code.

## How It Works

After the AI generates code, Helix runs `npm run build` in the generated project. If the build fails:

1. **Error capture** — The build output and error messages are captured
2. **AI repair** — The error is sent back to the AI with a targeted repair prompt
3. **Retry** — The fixed code is written and the build is attempted again
4. **Limit** — Up to 3 repair attempts are made before giving up

```
Phase 4: Code generation ──► Build ──► Error?
                                          │
                                   Yes ──► AI Repair ──► Retry (max 3)
                                          │
                                   No  ──► ✅ Done
```

## Blueprint Self-Healing

If the initial blueprint contains syntax errors or unsupported constructs, Helix repairs it before proceeding to code generation:

1. The blueprint is parsed with the Helix DSL parser
2. Parse errors are collected with line/column information
3. A repair prompt is sent to the AI with the errors and original blueprint
4. The repaired blueprint is re-parsed (up to 3 attempts)

## Prisma Self-Healing

Prisma schema issues (unsupported types, missing relations, migration errors) are similarly healed:

1. `prisma db push` is run
2. Errors are captured
3. The schema is repaired and re-pushed

## Configuration

Self-healing uses the same AI model as generation. The number of retry attempts is controlled by:

```typescript
// src/pipeline/types.ts
export const MAX_RETRY_ATTEMPTS = 3;
```

## When Self-Healing Fails

If all repair attempts fail, Helix:
1. Logs the final error with full context
2. Saves the partially-generated project so you can inspect it
3. Exits with a non-zero code and suggests next steps

You can then:
- Fix the prompt and re-run `helix spawn`
- Manually edit the generated `blueprint.helix` and run `helix generate`
- Run `helix doctor` to check for environment issues
