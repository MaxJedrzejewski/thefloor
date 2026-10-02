import { describe, it, expect } from 'vitest';
import { formatClock } from '../formatClock';

describe('formatClock', () => {
  it('shows seconds and tenths under a minute', () => {
    expect(formatClock(31_400)).toBe('31.4');
    expect(formatClock(45_000)).toBe('45.0');
    expect(formatClock(1_000)).toBe('1.0');
  });

  it('rounds up so the clock only reads 0.0 when time is truly gone', () => {
    expect(formatClock(1)).toBe('0.1');
    expect(formatClock(0)).toBe('0.0');
  });

  it('never renders a negative clock', () => {
    expect(formatClock(-5_000)).toBe('0.0');
  });

  it('switches to minutes above a minute', () => {
    expect(formatClock(65_000)).toBe('1:05.0');
    expect(formatClock(60_000)).toBe('1:00.0');
  });
});
