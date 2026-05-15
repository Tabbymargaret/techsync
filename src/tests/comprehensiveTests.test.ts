/**
 * Broader unit tests for documentation / thesis screenshots.
 * Run: npm test (runs all *.test.ts files)
 */
import { describe, expect, it } from 'vitest';
import { calculateMilestoneProgressPercent } from '../lib/milestoneProgress';
import { deadlineStatusRelativeToToday } from '../lib/deadlineRelative';
import {
  isValidMeetingLink,
  MEETING_LINK_HTTP_SCHEME_REGEX,
  normalizeMeetingLinkInput,
} from '../lib/meetingLink';

describe('Progress calculation — milestone roadmap completion percentage', () => {
  it('returns 0% when there are no milestones (avoids division by zero)', () => {
    expect(calculateMilestoneProgressPercent(0, 0)).toBe(0);
    expect(calculateMilestoneProgressPercent(3, 0)).toBe(0);
  });

  it('returns 100% when completed count equals the total milestone count', () => {
    expect(calculateMilestoneProgressPercent(5, 5)).toBe(100);
    expect(calculateMilestoneProgressPercent(1, 1)).toBe(100);
  });

  it('returns 50% when exactly half of the milestones are counted as complete', () => {
    expect(calculateMilestoneProgressPercent(2, 4)).toBe(50);
  });

  it('rounds to the nearest whole percent when the ratio is not an integer', () => {
    expect(calculateMilestoneProgressPercent(1, 3)).toBe(33);
    expect(calculateMilestoneProgressPercent(2, 3)).toBe(67);
  });

  it('clamps completion count into range so display never exceeds 100%', () => {
    expect(calculateMilestoneProgressPercent(99, 10)).toBe(100);
    expect(calculateMilestoneProgressPercent(-2, 5)).toBe(0);
  });
});

describe('Meeting link URL validation — HTTP(S) scheme regex and full provider check', () => {
  it('regex: accepts strings that already begin with http:// (any case)', () => {
    expect(MEETING_LINK_HTTP_SCHEME_REGEX.test('http://meet.google.com/abc')).toBe(true);
    expect(MEETING_LINK_HTTP_SCHEME_REGEX.test('HTTP://zoom.us/j/123')).toBe(true);
  });

  it('regex: accepts strings that already begin with https:// (any case)', () => {
    expect(MEETING_LINK_HTTP_SCHEME_REGEX.test('https://meet.google.com/abc')).toBe(true);
    expect(MEETING_LINK_HTTP_SCHEME_REGEX.test('HTTPS://teams.microsoft.com/l/meet')).toBe(true);
  });

  it('regex: rejects bare hostnames until normalizeMeetingLinkInput prepends https://', () => {
    expect(MEETING_LINK_HTTP_SCHEME_REGEX.test('meet.google.com/xyz')).toBe(false);
    expect(normalizeMeetingLinkInput('meet.google.com/xyz')).toBe('https://meet.google.com/xyz');
  });

  it('isValidMeetingLink: accepts allowed providers after normalization (Google Meet example)', () => {
    expect(isValidMeetingLink('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isValidMeetingLink('meet.google.com/abc-defg-hij')).toBe(true);
  });

  it('isValidMeetingLink: rejects non-meeting URLs even when the shape is valid http(s)', () => {
    expect(isValidMeetingLink('https://example.com/not-a-meeting')).toBe(false);
    expect(isValidMeetingLink('https://github.com/user/repo')).toBe(false);
  });
});

describe('Deadline status — due date relative to today (past, today, or future)', () => {
  it('reports past when the due date is strictly before the reference calendar day', () => {
    const ref = new Date('2026-06-15T10:00:00');
    expect(deadlineStatusRelativeToToday('2026-06-14', ref)).toBe('past');
    expect(deadlineStatusRelativeToToday('2026-01-01', ref)).toBe('past');
  });

  it('reports today when the due date matches the reference calendar day', () => {
    const ref = new Date('2026-06-15T23:30:00');
    expect(deadlineStatusRelativeToToday('2026-06-15', ref)).toBe('today');
  });

  it('reports future when the due date is strictly after the reference calendar day', () => {
    const ref = new Date('2026-06-15T08:00:00');
    expect(deadlineStatusRelativeToToday('2026-06-16', ref)).toBe('future');
    expect(deadlineStatusRelativeToToday('2026-12-31', ref)).toBe('future');
  });

  it('uses local midnight so the same calendar day is "today" morning or evening', () => {
    const morning = new Date('2026-03-10T01:00:00');
    const evening = new Date('2026-03-10T22:00:00');
    expect(deadlineStatusRelativeToToday('2026-03-10', morning)).toBe('today');
    expect(deadlineStatusRelativeToToday('2026-03-10', evening)).toBe('today');
  });

  it('treats blank due input as future-safe default (no accidental “past”)', () => {
    expect(deadlineStatusRelativeToToday('', new Date('2026-06-01'))).toBe('future');
    expect(deadlineStatusRelativeToToday('   ', new Date('2026-06-01'))).toBe('future');
  });
});
