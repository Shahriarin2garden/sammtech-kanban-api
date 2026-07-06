/**
 * Fractional position algorithm.
 *
 * Each task holds a Float `position`. To move a task between `prev` and `next`,
 * we set its position to the midpoint (prev + next) / 2. This gives O(1) reorder
 * with zero writes to sibling tasks — the whole point of the design.
 *
 * The catch: repeated midpoint insertions in the same spot shrink the gap
 * exponentially. Float64 has ~15 significant digits, so ~50 consecutive
 * inserts at the same location exhaust precision. We defend with a threshold
 * (MIN_GAP): when neighbors are closer than MIN_GAP, the caller rebalances
 * the whole column to evenly-spaced integers (STEP apart).
 *
 * Alternatives considered:
 *  - Integer positions with shifts: O(n) writes per reorder.
 *  - LexoRank strings (Jira): richer but heavier; overkill for a take-home.
 *  - Linked list (prev/next FKs): needs multi-row transaction per move.
 *
 * Floats with rebalance were chosen because they are the simplest scheme that
 * meets the "PATCH /tasks/:id/position" O(1)-typical requirement while staying
 * numerically safe.
 */

export const STEP = 1000;
export const MIN_GAP = 1e-4;

export function positionBetween(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return STEP;
  if (prev === null && next !== null) return next - STEP;
  if (prev !== null && next === null) return prev + STEP;
  return (prev! + next!) / 2;
}

export function needsRebalance(prev: number | null, next: number | null): boolean {
  if (prev === null || next === null) return false;
  return Math.abs(next - prev) < MIN_GAP;
}
