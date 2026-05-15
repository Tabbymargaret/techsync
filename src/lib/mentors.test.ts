/**
 * Unit tests for student–mentor tech stack match scoring.
 * Run: npm test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { calculateMatchScore } from './mentors';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('calculateMatchScore', () => {
  it('returns 0 when the student has no skills (avoids divide-by-zero)', () => {
    expect(calculateMatchScore([], ['react', 'node'])).toBe(0);
    expect(calculateMatchScore(['  ', ''], ['react'])).toBe(0);
  });

  it('returns 100 when every student skill appears on the mentor stack', () => {
    expect(calculateMatchScore(['react', 'node'], ['node', 'react', 'postgres'])).toBe(100);
  });

  it('returns half when half of the student skills match the mentor', () => {
    // 2 matches / 4 student skills = 50%
    expect(calculateMatchScore(['react', 'node', 'java', 'go'], ['react', 'node', 'python'])).toBe(
      50,
    );
  });

  it('matches case-insensitively so React and react count as the same skill', () => {
    expect(calculateMatchScore(['React', 'NODE'], ['react', 'node'])).toBe(100);
    expect(calculateMatchScore(['Go'], ['GO', 'rust'])).toBe(100);
  });

  it('does not penalize mentors with extra skills: denominator is student count only', () => {
    // Student has 1 skill; mentor lists many; the one match → 100%
    expect(
      calculateMatchScore(['typescript'], ['a', 'b', 'c', 'd', 'typescript', 'z']),
    ).toBe(100);
  });
});
