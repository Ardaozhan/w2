import type { DiffCapture } from "./types.js";

function changedFiles(status: string): string[] {
  return status.split(/\r?\n/).filter(Boolean).map((line) => line.length > 3 ? line.slice(3).trim().replace(/^"|"$/g, "") : line.trim());
}

function totals(numstat: string): { additions: number; deletions: number } {
  return numstat.split(/\r?\n/).filter(Boolean).reduce((total, line) => {
    const [added, deleted] = line.split(/\s+/);
    if (/^\d+$/.test(added) && /^\d+$/.test(deleted)) {
      total.additions += Number(added);
      total.deletions += Number(deleted);
    }
    return total;
  }, { additions: 0, deletions: 0 });
}

export function captureDiff(statusBefore: string, statusAfter: string, diff: string, numstat: string): DiffCapture {
  const sums = totals(numstat);
  return { status_before: statusBefore, status_after: statusAfter, changed_files: changedFiles(statusAfter), ...sums, unified_diff: diff };
}
