/**
 * Desktop notification — lazy-loads node-notifier; silent fallback on missing dep.
 */

export function notify(title: string, message: string): void {
    try {
        // Dynamic require so the module is optional.
        const notifier = require("node-notifier");
        notifier.notify({ title, message });
    } catch {
        // node-notifier not installed — do nothing.
    }
}
