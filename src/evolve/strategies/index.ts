/**
 * Strategy selector — maps an EvolveAction to its tailored planner prompt
 * suffix. Each strategy refines what kind of changes the planner should
 * propose; the planner itself is shared.
 */

import { EvolveAction } from "../types";
import { addFeatureNotes } from "./add_feature";
import { refactorNotes } from "./refactor";
import { fixNotes } from "./fix";
import { migrateNotes } from "./migrate";
import { optimizeNotes } from "./optimize";

export function getStrategyNotes(action: EvolveAction): string {
    switch (action) {
        case "add-feature": return addFeatureNotes;
        case "refactor":    return refactorNotes;
        case "fix":         return fixNotes;
        case "migrate":     return migrateNotes;
        case "optimize":    return optimizeNotes;
    }
}

export const SUPPORTED_ACTIONS: EvolveAction[] = [
    "add-feature", "refactor", "fix", "migrate", "optimize",
];
