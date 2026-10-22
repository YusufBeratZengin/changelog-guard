/**
 * Keep a Changelog 1.1 Linter.
 * Zero external dependencies.
 */

import { parseChangelog, STANDARD_CHANGE_TYPES } from './parser.js';
import * as semver from './semver.js';

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Validates whether a date string is a real calendar ISO date (YYYY-MM-DD).
 * @param {string} dateStr
 * @returns {boolean}
 */
function isValidIsoDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.match(ISO_DATE_REGEX);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  return (
    dateObj.getUTCFullYear() === year &&
    dateObj.getUTCMonth() === month - 1 &&
    dateObj.getUTCDate() === day
  );
}

/**
 * Runs all lint rules on a parsed Changelog AST or raw string.
 * @param {string|object} input
 * @param {object} [options]
 * @returns {{ valid: boolean, diagnostics: Array<{ rule: string, message: string, line: number, column: number, severity: 'error'|'warning' }> }}
 */
export function lintChangelog(input, options = {}) {
  const ast = typeof input === 'string' ? parseChangelog(input) : input;
  const diagnostics = [];

  const {
    requireUnreleased = true,
    allowEmptyUnreleased = false,
    checkLinkReferences = true,
    checkOrphanLinks = false
  } = options;

  function addDiag(rule, message, line = 1, column = 1, severity = 'error') {
    diagnostics.push({ rule, message, line, column, severity });
  }

  // 1. Heading Structure
  const headings = ast.headings;
  if (headings.length === 0) {
    addDiag('heading-structure', 'CHANGELOG must contain at least a top-level # heading', 1, 1);
    return { valid: false, diagnostics };
  }

  // Check top-level heading (H1)
  const h1Headings = headings.filter(h => h.level === 1);
  if (h1Headings.length === 0) {
    addDiag('heading-structure', 'CHANGELOG must start with a level 1 heading (e.g., "# Changelog")', 1, 1);
  } else if (h1Headings.length > 1) {
    for (let i = 1; i < h1Headings.length; i++) {
      addDiag(
        'heading-structure',
        `Duplicate top-level heading "${h1Headings[i].text}". A CHANGELOG should only have one H1.`,
        h1Headings[i].line,
        1
      );
    }
  }

  // Verify heading levels order
  let seenH1 = false;
  let seenH2 = false;
  for (const h of headings) {
    if (h.level === 1) {
      seenH1 = true;
    } else if (h.level === 2) {
      if (!seenH1) {
        addDiag('heading-structure', `Level 2 heading "${h.text}" appears before top-level H1.`, h.line, 1);
      }
      seenH2 = true;
    } else if (h.level === 3) {
      if (!seenH2) {
        addDiag('heading-structure', `Level 3 heading "${h.text}" appears outside any version (H2) section.`, h.line, 1);
      }
    } else if (h.level > 3) {
      addDiag('heading-structure', `Unexpected level ${h.level} heading "${h.text}". Keep a Changelog uses H2 for versions and H3 for change types.`, h.line, 1);
    }
  }

  // 2. Unreleased missing
  const unreleasedVersion = ast.versions.find(v => v.isUnreleased);
  if (requireUnreleased && !unreleasedVersion) {
    addDiag(
      'unreleased-missing',
      'Missing [Unreleased] section. Keep a Changelog requires an ## [Unreleased] section to track upcoming changes.',
      ast.title ? ast.title.line : 1,
      1
    );
  }

  // If Unreleased exists, check if it's the first version
  if (unreleasedVersion && ast.versions.length > 0 && ast.versions[0] !== unreleasedVersion) {
    addDiag(
      'unreleased-missing',
      'The ## [Unreleased] section must be the first version entry in the CHANGELOG.',
      unreleasedVersion.line,
      1
    );
  }

  // 3. Version checking: semver validity, non-ISO dates, duplicates, descending order
  const releasedVersions = [];
  const seenVersionTags = new Set();

  for (const v of ast.versions) {
    // Unreleased section
    if (v.isUnreleased) {
      if (seenVersionTags.has('unreleased')) {
        addDiag('duplicate-version', 'Duplicate [Unreleased] section found.', v.line, 1);
      }
      seenVersionTags.add('unreleased');

      // Check empty unreleased section
      if (!allowEmptyUnreleased) {
        const hasContent = v.types.length > 0 || v.items.length > 0 || v.bodyLines.length > 0;
        if (!hasContent) {
          addDiag('empty-section', 'The [Unreleased] section is empty.', v.line, 1);
        }
      }
      continue;
    }

    // Released version:
    const tag = v.version;

    // Duplicate check
    if (seenVersionTags.has(tag.toLowerCase())) {
      addDiag('duplicate-version', `Duplicate version "${tag}" found.`, v.line, 1);
    }
    seenVersionTags.add(tag.toLowerCase());

    // SemVer validity
    if (!semver.isValid(tag)) {
      addDiag('invalid-semver', `Version "${tag}" is not a valid Semantic Version (MAJOR.MINOR.PATCH[-prerelease][+build]).`, v.line, 1);
    } else {
      releasedVersions.push(v);
    }

    // Non-ISO dates
    if (!v.date) {
      addDiag('non-iso-date', `Version "${tag}" is missing a release date. Expected format: "## [${tag}] - YYYY-MM-DD".`, v.line, 1);
    } else if (!isValidIsoDate(v.date)) {
      addDiag('non-iso-date', `Version "${tag}" has invalid date "${v.date}". Expected ISO 8601 format YYYY-MM-DD (e.g., 2026-10-22).`, v.line, 1);
    }

    // Check empty version section
    const hasContent = v.types.length > 0 || v.items.length > 0 || v.bodyLines.length > 0;
    if (!hasContent) {
      addDiag('empty-section', `Version section "${tag}" is empty.`, v.line, 1);
    }
  }

  // 4. Versions not descending
  for (let i = 0; i < releasedVersions.length - 1; i++) {
    const current = releasedVersions[i];
    const next = releasedVersions[i + 1];

    try {
      const cmp = semver.compare(current.version, next.version);
      if (cmp <= 0) {
        addDiag(
          'versions-not-descending',
          `Versions are not in descending order: "${current.version}" is listed before "${next.version}".`,
          current.line,
          1
        );
      }
    } catch {
      // Ignored if invalid semver, already caught
    }
  }

  // 5. Change types check & empty change type sections
  for (const v of ast.versions) {
    const seenTypes = new Set();
    for (const t of v.types) {
      // Unknown change type
      if (!STANDARD_CHANGE_TYPES.includes(t.type)) {
        addDiag(
          'unknown-change-type',
          `Unknown change type "${t.type}" in version "${v.version}". Allowed types: ${STANDARD_CHANGE_TYPES.join(', ')}.`,
          t.line,
          1
        );
      } else {
        if (seenTypes.has(t.type)) {
          addDiag(
            'heading-structure',
            `Duplicate change type "${t.type}" in version "${v.version}".`,
            t.line,
            1
          );
        }
        seenTypes.add(t.type);
      }

      // Empty change type section
      if (t.items.length === 0) {
        addDiag(
          'empty-section',
          `Change type section "### ${t.type}" in version "${v.version}" has no items.`,
          t.line,
          1
        );
      }
    }
  }

  // 6. Link references check
  if (checkLinkReferences) {
    for (const v of ast.versions) {
      if (v.hasBrackets) {
        const linkKey = v.isUnreleased ? 'Unreleased' : v.version;
        // Search case-insensitively or exact match
        let found = ast.linkReferences.has(linkKey);
        if (!found) {
          for (const k of ast.linkReferences.keys()) {
            if (k.toLowerCase() === linkKey.toLowerCase()) {
              found = true;
              break;
            }
          }
        }

        if (!found) {
          addDiag(
            'missing-link-reference',
            `Missing link reference for "[${linkKey}]" at the bottom of the changelog.`,
            v.line,
            1
          );
        }
      }
    }

    if (checkOrphanLinks) {
      for (const [tag, ref] of ast.linkReferences.entries()) {
        const isMatched = ast.versions.some(v =>
          (v.isUnreleased && tag.toLowerCase() === 'unreleased') ||
          v.version.toLowerCase() === tag.toLowerCase()
        );
        if (!isMatched) {
          addDiag(
            'orphan-link-reference',
            `Link reference "[${tag}]" does not correspond to any version heading.`,
            ref.line,
            1,
            'warning'
          );
        }
      }
    }
  }

  // Sort diagnostics by line then column
  diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);

  const errorCount = diagnostics.filter(d => d.severity === 'error').length;
  return {
    valid: errorCount === 0,
    diagnostics
  };
}
