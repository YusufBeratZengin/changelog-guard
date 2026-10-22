import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { executeRelease, releaseFile } from '../src/release.js';
import { lintChangelog } from '../src/linter.js';

describe('release', () => {
  const sampleChangelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Awesome new CLI feature.

### Fixed
- Small edge case bug.

## [1.0.0] - 2026-10-01

### Added
- Initial release.

[Unreleased]: https://github.com/YusufBeratZengin/changelog-guard/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/YusufBeratZengin/changelog-guard/releases/tag/v1.0.0
`;

  test('moves unreleased entries to new dated version and updates links', () => {
    const res = executeRelease(sampleChangelog, '1.1.0', { date: '2026-10-22' });

    assert.equal(res.releaseVersion, '1.1.0');
    assert.equal(res.previousVersion, '1.0.0');
    assert.equal(res.releaseDate, '2026-10-22');

    // Verify content includes new unreleased section and new version section
    assert.match(res.content, /## \[Unreleased\]\n\n## \[1\.1\.0\] - 2026-10-22/);

    // Verify unreleased items moved under 1.1.0
    const v110Part = res.content.slice(res.content.indexOf('## [1.1.0]'));
    assert.match(v110Part, /Awesome new CLI feature/);

    // Verify link references updated
    assert.match(res.content, /\[Unreleased\]: https:\/\/github\.com\/YusufBeratZengin\/changelog-guard\/compare\/v1\.1\.0\.\.\.HEAD/);
    assert.match(res.content, /\[1\.1\.0\]: https:\/\/github\.com\/YusufBeratZengin\/changelog-guard\/compare\/v1\.0\.0\.\.\.v1\.1\.0/);

    // The output should be valid changelog (allowing empty unreleased)
    const lintRes = lintChangelog(res.content, { allowEmptyUnreleased: true });
    assert.equal(lintRes.valid, true);
  });

  test('throws if unreleased section is empty', () => {
    const emptyUnreleased = `# Changelog

## [Unreleased]

## [1.0.0] - 2026-10-01

### Added
- First version.

[Unreleased]: https://example.com/compare/v1.0.0...HEAD
[1.0.0]: https://example.com/releases/tag/v1.0.0
`;

    assert.throws(() => {
      executeRelease(emptyUnreleased, '1.1.0');
    }, /Cannot release: ## \[Unreleased\] section has no entries/);
  });

  test('throws if new version is not greater than previous version', () => {
    assert.throws(() => {
      executeRelease(sampleChangelog, '0.9.0');
    }, /must be greater than previous version/);
  });

  test('releaseFile writes to disk or performs dry-run', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-release-test-'));
    const testFile = path.join(tmpDir, 'CHANGELOG.md');
    fs.writeFileSync(testFile, sampleChangelog, 'utf8');

    // Dry run does not modify file
    const dryResult = releaseFile(testFile, '1.1.0', { dryRun: true, date: '2026-10-22' });
    assert.equal(dryResult.written, false);
    assert.equal(fs.readFileSync(testFile, 'utf8'), sampleChangelog);

    // Actual write modifies file
    const liveResult = releaseFile(testFile, '1.1.0', { dryRun: false, date: '2026-10-22' });
    assert.equal(liveResult.written, true);
    assert.notEqual(fs.readFileSync(testFile, 'utf8'), sampleChangelog);

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('preserves CRLF line endings', () => {
    const crlfContent = sampleChangelog.replace(/\n/g, '\r\n');
    const res = executeRelease(crlfContent, '1.1.0', { date: '2026-10-22' });
    assert.equal(res.content.includes('\r\n'), true);
  });
});
