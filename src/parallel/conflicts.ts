/**
 * Detect overlapping file edits across worktrees.
 *
 * A conflict here means: two or more workers touched the same file. We don't
 * try to determine whether the changes are textually compatible — even if
 * they are, we surface the file so the user can decide how to merge.
 */

import { ConflictReport, WorkerOutcome } from "./types";

export function detectConflicts(workers: WorkerOutcome[]): ConflictReport {
    const fileToWorkers = new Map<string, Set<string>>();
    for (const worker of workers) {
        if (!worker.success) continue;
        for (const file of worker.changedFiles) {
            const set = fileToWorkers.get(file) || new Set<string>();
            set.add(worker.task.label || worker.task.prompt.slice(0, 40));
            fileToWorkers.set(file, set);
        }
    }

    const overlapping: Array<{ file: string; workers: string[] }> = [];
    for (const [file, workersSet] of fileToWorkers.entries()) {
        if (workersSet.size > 1) {
            overlapping.push({ file, workers: [...workersSet].sort() });
        }
    }
    overlapping.sort((a, b) => a.file.localeCompare(b.file));

    return {
        overlappingFiles: overlapping,
        clean: overlapping.length === 0,
    };
}

export function formatConflictReport(report: ConflictReport): string {
    if (report.clean) return "✓ no conflicts";
    const lines: string[] = [`⚠ ${report.overlappingFiles.length} overlapping file(s):`];
    for (const o of report.overlappingFiles) {
        lines.push(`  ${o.file}  ←  ${o.workers.join(", ")}`);
    }
    return lines.join("\n");
}
