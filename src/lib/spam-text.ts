/**
 * Catches the audit-form bot that types a browser proof and then fills the
 * required boxes with random tokens (PpGLJz0lct, JlDSdbF6Rp, g8cDAvrmd4).
 * Real names, facility brands, and cities use spaces, punctuation, or a
 * normal run of vowels, so they stay.
 */

function vowelRatio(letters: string): number {
  if (!letters) return 0;
  const vowels = letters.match(/[aeiouy]/gi);
  return (vowels ? vowels.length : 0) / letters.length;
}

function caseTransitions(letters: string): number {
  let transitions = 0;
  for (let i = 1; i < letters.length; i++) {
    const prevUpper = letters[i - 1] >= "A" && letters[i - 1] <= "Z";
    const curUpper = letters[i] >= "A" && letters[i] <= "Z";
    if (prevUpper !== curUpper) transitions++;
  }
  return transitions;
}

/** One box that is a machine token, not a name, brand, or place. */
export function looksLikeRandomToken(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 8 || s.length > 32) return false;
  // Spaces, hyphens, apostrophes, and commas are how people write these fields.
  if (!/^[A-Za-z0-9]+$/.test(s)) return false;

  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < 6) return false;

  const ratio = vowelRatio(letters);
  if (ratio < 0.2) return true;

  const hasDigit = /\d/.test(s);
  if (hasDigit && caseTransitions(letters) >= 3 && ratio < 0.4) return true;
  return false;
}

/**
 * Same bot, even if a later version sprinkles in a vowel: every required
 * field is a short mixed-case token with a digit and no spaces.
 */
function generatedTrio(name: string, facilityName: string, location: string): boolean {
  return [name, facilityName, location].every((value) => {
    const s = value.trim();
    return (
      s.length >= 8 &&
      s.length <= 16 &&
      /^[A-Za-z0-9]+$/.test(s) &&
      /\d/.test(s) &&
      /[A-Z]/.test(s) &&
      /[a-z]/.test(s)
    );
  });
}

export function leadTextIsAutomated(input: {
  name: string;
  facilityName?: string;
  location?: string;
}): boolean {
  const facilityName = input.facilityName?.trim() || "";
  const location = input.location?.trim() || "";
  if (looksLikeRandomToken(input.name)) return true;
  if (facilityName && looksLikeRandomToken(facilityName)) return true;
  if (location && looksLikeRandomToken(location)) return true;
  if (facilityName && location && generatedTrio(input.name, facilityName, location)) return true;
  return false;
}
