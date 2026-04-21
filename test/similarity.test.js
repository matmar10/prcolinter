'use strict';

const { normalizeSubject, diceSimilarity, hasDoubleColon } = require('../src/similarity');

describe('normalizeSubject', () => {
  test('strips type prefix', () => {
    expect(normalizeSubject('fix: correct typo in README')).toBe('correct typo in readme');
  });

  test('strips type and scope prefix', () => {
    expect(normalizeSubject('feat(website): enable dark mode')).toBe('enable dark mode');
  });

  test('strips scope so different scopes with identical descriptions are equal', () => {
    const a = normalizeSubject('feat(website): enable ramadan1447 cc dashboard reporting');
    const b = normalizeSubject('feat(campaign): enable ramadan1447 cc dashboard reporting');
    expect(a).toBe(b);
  });

  test('handles double-colon typo in prefix', () => {
    const result = normalizeSubject('feat(auto-giving): : enable ramadan1447 cc dashboard reporting');
    expect(result).toBe('enable ramadan1447 cc dashboard reporting');
  });

  test('handles breaking-change marker (!)', () => {
    expect(normalizeSubject('feat(api)!: remove deprecated endpoint')).toBe('remove deprecated endpoint');
  });

  test('uses only the first line of multiline messages', () => {
    const msg = 'feat: add login\n\nThis adds OAuth login support.\nSee #42.';
    expect(normalizeSubject(msg)).toBe('add login');
  });

  test('lowercases the result', () => {
    expect(normalizeSubject('fix: Fix Broken LINK')).toBe('fix broken link');
  });

  test('collapses extra whitespace', () => {
    expect(normalizeSubject('fix:   too   many   spaces')).toBe('too many spaces');
  });

  test('returns empty string for a bare type prefix', () => {
    expect(normalizeSubject('chore:')).toBe('');
  });
});

describe('diceSimilarity', () => {
  test('identical strings score 1.0', () => {
    expect(diceSimilarity('enable dark mode', 'enable dark mode')).toBe(1.0);
  });

  test('completely different strings score near 0', () => {
    const score = diceSimilarity('enable dark mode', 'remove deprecated api');
    expect(score).toBeLessThan(0.3);
  });

  test('strings with one word different score high but not 1.0', () => {
    const score = diceSimilarity(
      'enable ramadan1447 cc dashboard reporting',
      'enable ramadan1447 cc dashboard analytics'
    );
    expect(score).toBeGreaterThan(0.7);
    expect(score).toBeLessThan(1.0);
  });

  test('empty-ish strings (length < 2) score 0.0', () => {
    expect(diceSimilarity('a', 'a')).toBe(1.0); // identical guard fires first
    expect(diceSimilarity('a', 'b')).toBe(0.0);
    expect(diceSimilarity('', 'hello')).toBe(0.0);
  });

  test('is symmetric', () => {
    const a = 'enable ramadan1447 cc dashboard reporting';
    const b = 'remove deprecated api endpoint from v2';
    expect(diceSimilarity(a, b)).toBeCloseTo(diceSimilarity(b, a), 10);
  });

  test('near-identical subjects from different scopes score >= 0.9 after normalisation', () => {
    const subjects = [
      'feat(website): enable ramadan1447 cc dashboard reporting',
      'feat(auto-giving): : enable ramadan1447 cc dashboard reporting',
      'feat(campaign): enable ramadan1447 cc dashboard reporting',
    ].map(normalizeSubject);

    for (let i = 0; i < subjects.length; i++) {
      for (let j = i + 1; j < subjects.length; j++) {
        expect(diceSimilarity(subjects[i], subjects[j])).toBeGreaterThanOrEqual(0.9);
      }
    }
  });

  test('unrelated commits from the example do not exceed 0.5 threshold', () => {
    const release = normalizeSubject('chore(monorepo): release 12.28.0');
    const feature = normalizeSubject('feat(website): remove campaign end dates when enabling rg plan');
    expect(diceSimilarity(release, feature)).toBeLessThan(0.5);
  });
});

describe('hasDoubleColon', () => {
  test('returns false for a normal type-only header', () => {
    expect(hasDoubleColon('fix: correct typo in README')).toBe(false);
  });

  test('returns false for a type+scope header', () => {
    expect(hasDoubleColon('feat(website): enable dark mode')).toBe(false);
  });

  test('returns false for a breaking-change header', () => {
    expect(hasDoubleColon('feat(api)!: remove deprecated endpoint')).toBe(false);
  });

  test('returns false when a colon appears later in the description', () => {
    expect(hasDoubleColon('fix: support JSON: objects')).toBe(false);
  });

  test('returns true for double colon with space — "fix: : description"', () => {
    expect(hasDoubleColon('fix: : description')).toBe(true);
  });

  test('returns true for double colon without space — "fix:: description"', () => {
    expect(hasDoubleColon('fix:: description')).toBe(true);
  });

  test('returns true for type+scope with double colon', () => {
    expect(hasDoubleColon('feat(auto-giving): : enable ramadan1447 cc dashboard reporting')).toBe(true);
  });

  test('returns true for breaking-change with double colon', () => {
    expect(hasDoubleColon('feat(api)!: : remove deprecated endpoint')).toBe(true);
  });

  test('only checks the first line of multiline messages', () => {
    const msg = 'fix: correct typo\n\nSee also: https://example.com for details: foo';
    expect(hasDoubleColon(msg)).toBe(false);
  });

  test('is case-insensitive for the type', () => {
    expect(hasDoubleColon('FIX: : description')).toBe(true);
  });
});
