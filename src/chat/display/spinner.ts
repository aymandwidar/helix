/**
 * Spinner wrapper. Uses ora when available, otherwise prints a static line.
 */

export interface SpinnerHandle {
    stop(): void;
    succeed(text?: string): void;
    fail(text?: string): void;
    update(text: string): void;
}

export function startSpinner(text: string): SpinnerHandle {
    try {
        const ora = require("ora");
        const spinner = ora(text).start();
        return {
            stop: () => spinner.stop(),
            succeed: (t?: string) => spinner.succeed(t),
            fail: (t?: string) => spinner.fail(t),
            update: (t: string) => { spinner.text = t; },
        };
    } catch {
        process.stdout.write(`… ${text}\n`);
        return {
            stop: () => {},
            succeed: (t?: string) => { if (t) process.stdout.write(`✓ ${t}\n`); },
            fail: (t?: string) => { if (t) process.stdout.write(`✗ ${t}\n`); },
            update: (t: string) => process.stdout.write(`… ${t}\n`),
        };
    }
}
