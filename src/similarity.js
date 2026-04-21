'use strict';

function normalizeSubject(message) {
  return message
    .split('\n')[0]
    .replace(/^[a-z]+(\([^)]+\))?!?:+\s*/i, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function diceSimilarity(a, b) {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;
  const bigramsA = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
  }
  let intersect = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigramsA.get(bg) || 0;
    if (count > 0) {
      bigramsA.set(bg, count - 1);
      intersect++;
    }
  }
  return (2 * intersect) / (a.length + b.length - 2);
}

// Returns true when the commit header has a stray colon immediately after the
// type(scope): separator, e.g. "fix: : description" or "feat(scope): : foo".
function hasDoubleColon(message) {
  return /^[a-z]+(\([^)]+\))?!?:\s*:/i.test(message.split('\n')[0]);
}

module.exports = { normalizeSubject, diceSimilarity, hasDoubleColon };
