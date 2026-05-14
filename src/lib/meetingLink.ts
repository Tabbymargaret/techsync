/**
 * If the user omitted a scheme, prepend https:// so URL parsing and provider checks work.
 */
export function normalizeMeetingLinkInput(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function isKnownMeetingHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'meet.google.com') return true;
  if (h === 'zoom.us' || h === 'www.zoom.us') return true;
  if (h.endsWith('.zoom.us')) return true;
  if (h === 'zoom.com' || h === 'www.zoom.com') return true;
  if (h.endsWith('.zoom.com')) return true;
  if (h === 'teams.microsoft.com' || h.endsWith('.teams.microsoft.com')) return true;
  if (h === 'teams.live.com' || h.endsWith('.teams.live.com')) return true;
  if (h === 'webex.com' || h.endsWith('.webex.com')) return true;
  return false;
}

/**
 * True when the string is a valid URL after optional https normalization and the host
 * is a recognized meeting provider (Meet, Zoom, Teams, Webex).
 */
export function isValidMeetingLink(url: string): boolean {
  const normalized = normalizeMeetingLinkInput(url);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return isKnownMeetingHost(parsed.hostname);
  } catch {
    return false;
  }
}
