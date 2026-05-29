/**
 * Auto-trigger detector for Council deliberation in chat mode.
 *
 * The agent recognizes architectural-decision questions in user input and
 * surfaces them transparently to Council. This is intentionally heuristic —
 * a small set of high-precision patterns the user can override via
 * /council off or settings.
 */

export type TriggerCategory = "database" | "architecture" | "framework" | "security";

export interface CouncilTriggerMatch {
    matched: boolean;
    category?: TriggerCategory;
    /** The phrase that triggered the match. */
    snippet?: string;
    /** Suggested council preset, if any (e.g. "technical" for arch). */
    preset?: string;
}

interface TriggerRule {
    category: TriggerCategory;
    preset?: string;
    /**
     * Patterns are ALL expressed against lowercased input. Each rule
     * matches if at least one of its `signals` regexes hits AND at least
     * one of `decisionMarkers` is present (so plain mentions don't fire).
     */
    signals: RegExp[];
    decisionMarkers: RegExp[];
}

const DECISION_MARKERS = [
    /\bshould (?:i|we)\b/,
    /\bwhich .* should\b/,
    /\b(vs\.?|versus|or)\b/,
    /\b(better|best|recommend)\b/,
    /\bworth (using|switching|migrating)\b/,
    /\bdebate\b/,
    /\b(pros and cons|tradeoffs?|trade-offs?)\b/,
];

const RULES: TriggerRule[] = [
    {
        category: "database",
        preset: "technical",
        signals: [
            /\b(postgres|postgresql|mysql|mongodb|mongo|sqlite|supabase|firestore|dynamodb|cassandra|cockroach|planetscale|neon|redis)\b/,
            /\b(database|datastore|nosql|sql|relational)\b/,
        ],
        decisionMarkers: DECISION_MARKERS,
    },
    {
        category: "architecture",
        preset: "technical",
        signals: [
            /\b(monolith|microservices?|serverless|event[\s-]?driven|monorepo|polyrepo|saga|cqrs|hexagonal)\b/,
            /\b(architecture|design pattern|system design|topology)\b/,
        ],
        decisionMarkers: DECISION_MARKERS,
    },
    {
        category: "framework",
        preset: "technical",
        signals: [
            /\b(react\s*(?:1[5-9])?|vue|svelte|solid|next\.?js?|remix|nuxt|sveltekit|astro|qwik|angular)\b/,
            /\b(upgrade|migrate|switch)\s+to\b/,
        ],
        decisionMarkers: DECISION_MARKERS,
    },
    {
        category: "security",
        preset: "technical",
        signals: [
            /\b(jwt|oauth|saml|sso|csrf|xss|cors|sast|dast|hashing|argon2|bcrypt|password reset|session)\b/,
            /\b(secure|security)\s+(way|approach|pattern)\b/,
        ],
        decisionMarkers: DECISION_MARKERS,
    },
];

export function detectCouncilTrigger(input: string): CouncilTriggerMatch {
    const lc = input.toLowerCase();
    for (const rule of RULES) {
        const sigMatch = rule.signals.find(p => p.test(lc));
        const decMatch = rule.decisionMarkers.find(p => p.test(lc));
        if (sigMatch && decMatch) {
            return {
                matched: true,
                category: rule.category,
                snippet: extractSnippet(input, sigMatch),
                preset: rule.preset,
            };
        }
    }
    return { matched: false };
}

function extractSnippet(input: string, match: RegExp): string {
    const m = input.match(new RegExp(match.source, "i"));
    if (!m) return "";
    const start = Math.max(0, m.index! - 20);
    const end = Math.min(input.length, m.index! + m[0].length + 20);
    return input.slice(start, end).trim();
}
