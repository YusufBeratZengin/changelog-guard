import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintChangelog } from '../src/linter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readFixture(name) {
  return fs.readFileSync(path.resolve(__dirname, 'fixtures', name), 'utf8');
}

describe('linter', () => {
  test('valid changelog produces zero errors', () => {
    const content = readFixture('valid-changelog.md');
    const result = lintChangelog(content);
    assert.equal(result.valid, true);
    assert.equal(result.diagnostics.length, 0);
  });

  test('heading structure rule catches invalid headings', () => {
    const content = readFixture('invalid-heading-changelog.md');
    const result = lintChangelog(content, { requireUnreleased: false });
    assert.equal(result.valid, false);
    const diagRules = result.diagnostics.map(d => d.rule);
    assert.equal(diagRules.includes('heading-structure'), true);
  });

  test('non-ISO date rule catches bad dates', () => {
    const content = readFixture('invalid-date-changelog.md');
    const result = lintChangelog(content);
    assert.equal(result.valid, false);
    const dateErrors = result.diagnostics.filter(d => d.rule === 'non-iso-date');
    assert.equal(dateErrors.length, 1);
    assert.match(dateErrors[0].message, /Expected ISO 8601/);
  });

  test('semver validity catches invalid versions', () => {
    const content = readFixture('invalid-semver-changelog.md');
    const result = lintChangelog(content);
    assert.equal(result.valid, false);
    const semverErrors = result.diagnostics.filter(d => d.rule === 'invalid-semver');
    assert.equal(semverErrors.length, 1);
  });

  test('versions not descending rule flags ordering issues', () => {
    const content = readFixture('not-descending-changelog.md');
    const result = lintChangelog(content);
    assert.equal(result.valid, false);
    const orderErrors = result.diagnostics.filter(d => d.rule === 'versions-not-descending');
    assert.equal(orderErrors.length, 1);
    assert.match(orderErrors[0].message, /1\.0\.0.*before.*1\.2\.0/);
  });

  test('duplicate version rule flags repeated version tags', () => {
    const content = readFixture('duplicate-version-changelog.md');
    const result = lintChangelog(content);
    assert.equal(result.valid, false);
    const dupErrors = result.diagnostics.filter(d => d.rule === 'duplicate-version');
    assert.equal(dupErrors.length, 1);
  });

  test('missing link references rule flags missing definitions', () => {
    const content = readFixture('missing-links-changelog.md');
    const result = lintChangelog(content);
    assert.equal(result.valid, false);
    const linkErrors = result.diagnostics.filter(d => d.rule === 'missing-link-reference');
    assert.equal(linkErrors.length, 1);
    assert.match(linkErrors[0].message, /Missing link reference for "\[1\.0\.0\]"/);
  });

  test('empty sections rule flags empty change types', () => {
    const content = readFixture('empty-sections-changelog.md');
    const result = lintChangelog(content);
    assert.equal(result.valid, false);
    const emptyErrors = result.diagnostics.filter(d => d.rule === 'empty-section');
    assert.equal(emptyErrors.length, 1);
    assert.match(emptyErrors[0].message, /has no items/);
  });

  test('unknown change type rule flags non-standard types', () => {
    const content = readFixture('unknown-change-type-changelog.md');
    const result = lintChangelog(content);
    assert.equal(result.valid, false);
    const unknownErrors = result.diagnostics.filter(d => d.rule === 'unknown-change-type');
    assert.equal(unknownErrors.length, 2);
  });

  test('unreleased missing rule flags changelog without unreleased section', () => {
    const content = readFixture('missing-unreleased-changelog.md');
    const result = lintChangelog(content);
    assert.equal(result.valid, false);
    const unreleasedErrors = result.diagnostics.filter(d => d.rule === 'unreleased-missing');
    assert.equal(unreleasedErrors.length, 1);

    // Should pass if requireUnreleased is false
    const lenientResult = lintChangelog(content, { requireUnreleased: false });
    assert.equal(lenientResult.valid, true);
  });

  test('empty sections rule flags empty released version section', () => {
    const content = '# Changelog\n\n## [Unreleased]\n- Notes.\n\n## [1.0.0] - 2026-10-23\n\n[Unreleased]: https://example.com/compare/v1.0.0...HEAD\n[1.0.0]: https://example.com/releases/tag/v1.0.0\n';
    const result = lintChangelog(content);
    assert.equal(result.valid, false);
    const emptyErrors = result.diagnostics.filter(d => d.rule === 'empty-section' && /Version section "1\.0\.0" is empty/.test(d.message));
    assert.equal(emptyErrors.length, 1);
  });
});
