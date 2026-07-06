import { MIN_GAP, STEP, needsRebalance, positionBetween } from './position';

describe('position algorithm', () => {
  it('appends when list empty', () => {
    expect(positionBetween(null, null)).toBe(STEP);
  });

  it('inserts before first', () => {
    expect(positionBetween(null, 1000)).toBe(1000 - STEP);
  });

  it('appends after last', () => {
    expect(positionBetween(1000, null)).toBe(1000 + STEP);
  });

  it('midpoints between neighbors', () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
  });

  it('flags rebalance when gap collapses', () => {
    expect(needsRebalance(1.0, 1.0 + MIN_GAP / 2)).toBe(true);
    expect(needsRebalance(1.0, 2.0)).toBe(false);
  });
});
