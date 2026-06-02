/**
 * Helpers for working with strand fields during code generation.
 *
 * Generated apps always emit `id` (string), `createdAt`, `updatedAt`,
 * timestamps as boilerplate around the user-defined fields. If the AI puts
 * those names in the blueprint AST too — which it sometimes does — the
 * generated TypeScript ends up with duplicate identifiers:
 *
 *   interface Task {
 *     id: string;          // boilerplate
 *     id: string;          // user-defined dup
 *     createdAt: string;   // boilerplate
 *     createdAt: string;   // user-defined dup
 *   }
 *
 * The fix is one place: filter user fields against an auto-managed denylist
 * before splatting them into the template. Use `userFields(strand)` instead
 * of `strand.fields` everywhere a field list is rendered into TS interfaces,
 * Prisma columns, or React form state.
 *
 * `dedupeInterfaceLines()` is a final-stage safety net: regex-strip duplicate
 * `name: type;` lines from a rendered interface body, in case some emission
 * site we missed adds the same field twice.
 */

export interface FieldLike {
    name: string;
    [k: string]: unknown;
}

/** Field names always emitted by Helix's TS interface / Prisma boilerplate. */
export const AUTO_MANAGED_FIELDS = new Set<string>([
    "id",
    "createdAt",
    "updatedAt",
]);

/**
 * Return user-defined fields with auto-managed names filtered out, and any
 * accidental duplicates from the blueprint collapsed (first wins).
 */
export function userFields<T extends FieldLike>(strand: { fields?: T[] } | undefined): T[] {
    if (!strand?.fields || strand.fields.length === 0) return [];
    const seen = new Set<string>();
    const out: T[] = [];
    for (const field of strand.fields) {
        if (!field?.name) continue;
        if (AUTO_MANAGED_FIELDS.has(field.name)) continue;
        if (seen.has(field.name)) continue;
        seen.add(field.name);
        out.push(field);
    }
    return out;
}

/**
 * Final-stage safety net: take a rendered interface body and remove duplicate
 * `name: type;` lines. Keeps the FIRST occurrence of each name. Lines that
 * don't look like a property declaration are passed through unchanged.
 *
 * Robust to:
 *   - leading/trailing whitespace
 *   - optional `?` on the property name
 *   - whatever the value side looks like (object literal, union, etc.)
 *   - both `;` and `,` separators
 *
 * Does NOT understand nested braces — runs line-by-line. That's intentional
 * (handles `user?: { id: string; id: string }` only when the dups are on
 * separate lines; for the inline form, see `dedupeInlineFieldList`).
 */
export function dedupeInterfaceLines(body: string): string {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const line of body.split("\n")) {
        const m = line.match(/^\s*([A-Za-z_$][\w$]*)\??\s*:/);
        if (!m) {
            out.push(line);
            continue;
        }
        const name = m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        out.push(line);
    }
    return out.join("\n");
}

/**
 * Final-stage safety net for INLINE field lists like
 * `{ id: string; id: string; name: string }`. Keeps the first declaration of
 * each name and drops subsequent ones.
 *
 * Single-level only — does not recurse into nested braces. The inline shape
 * Helix emits ("{ id: string; firstField: string }") is shallow.
 */
export function dedupeInlineFieldList(body: string): string {
    return body.replace(/\{([^{}]*)\}/g, (_, inner) => {
        const parts = String(inner).split(/[;,]/).map(s => s.trim()).filter(Boolean);
        const seen = new Set<string>();
        const kept: string[] = [];
        for (const part of parts) {
            const m = part.match(/^([A-Za-z_$][\w$]*)\??\s*:/);
            if (!m) {
                kept.push(part);
                continue;
            }
            if (seen.has(m[1])) continue;
            seen.add(m[1]);
            kept.push(part);
        }
        return `{ ${kept.join("; ")} }`;
    });
}
