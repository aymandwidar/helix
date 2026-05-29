/**
 * Type definitions for the Council deliberation client.
 *
 * The shapes mirror what `Council`'s MCP server returns. We're permissive
 * about extra fields — the formatter ignores anything it doesn't recognize.
 */

export interface CouncilModelOpinion {
    model: string;
    response: string;
    confidence?: number;
    /** Optional structured rationale ("for"/"against"/etc). */
    reasoning?: string;
}

export interface CouncilVerdict {
    /** The synthesized answer across all models. */
    verdict: string;
    /** Optional consensus score 0..1. */
    consensus?: number;
    /** Per-model opinions. */
    opinions: CouncilModelOpinion[];
    /** Models the deliberation actually used (subset of available). */
    models?: string[];
    /** Optional preset name when the call used one. */
    preset?: string;
    /** Free-form notes from the synthesis step. */
    synthesis?: string;
}

export interface CouncilPreset {
    name: string;
    description?: string;
    models?: string[];
}

export interface DeliberateOptions {
    /** Pre-configured composition (e.g. "technical", "design"). */
    preset?: string;
    /** Manual model list (overrides preset). */
    models?: string[];
    /** Maximum tokens per model. */
    maxTokens?: number;
}
