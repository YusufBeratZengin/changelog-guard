import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { checkPullRequest, checkUnreleasedChanges } from '../src/check-pr.js';

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
}

function createTestRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-guard-pr-test-'));

  git(['init', '-b', 'main'], dir);
  git(['config', 'user.name', 'Test Runner'], dir);
  git(['config', 'user.email', 'test@example.com'], dir);
  git(['config', 'commit.gpgsign', 'false'], dir);

  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/index.js'), 'export const hello = "world";\n', 'utf8');

  const initialChangelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup.

[Unreleased]: https://github.com/YusufBeratZengin/changelog-guard/tree/HEAD
`;
  fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), initialChangelog, 'utf8');

  git(['add', '.'], dir);
  git(['commit', '-m', 'chore: initial commit'], dir);

  return dir;
}

describe('check-pr', () => {
  test('checkUnreleasedChanges detects new bullet items', () => {
    const base = `# Changelog

## [Unreleased]

### Added
- Item 1.
`;

    const headSame = `# Changelog

## [Unreleased]

### Added
- Item 1.
`;

    const headAdded = `# Changelog

## [Unreleased]

### Added
- Item 1.
- Item 2 new feature.
`;

    assert.equal(checkUnreleasedChanges(base, headSame).changed, false);
    const addedRes = checkUnreleasedChanges(base, headAdded);
    assert.equal(addedRes.changed, true);
    assert.deepEqual(addedRes.addedItems, ['Item 2 new feature.']);
  });

  test('fails if user-facing files modified without changelog update', async () => {
    const repo = createTestRepo();
    try {
      git(['checkout', '-b', 'feat/add-user-api'], repo);
      fs.writeFileSync(path.join(repo, 'src/api.js'), 'export const api = true;\n', 'utf8');
      git(['add', '.'], repo);
      git(['commit', '-m', 'feat: add user api'], repo);

      const result = await checkPullRequest({
        base: 'main',
        head: 'HEAD',
        cwd: repo
      });

      assert.equal(result.ok, false);
      assert.equal(result.error, 'CHANGELOG_NOT_MODIFIED');
      assert.match(result.message, /User-facing changes detected/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('passes if user-facing files and CHANGELOG [Unreleased] are updated', async () => {
    const repo = createTestRepo();
    try {
      git(['checkout', '-b', 'feat/add-user-api'], repo);
      fs.writeFileSync(path.join(repo, 'src/api.js'), 'export const api = true;\n', 'utf8');

      const updatedChangelog = `# Changelog

## [Unreleased]

### Added
- Initial project setup.
- Add user api endpoint.

[Unreleased]: https://github.com/YusufBeratZengin/changelog-guard/tree/HEAD
`;
      fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), updatedChangelog, 'utf8');

      git(['add', '.'], repo);
      git(['commit', '-m', 'feat: add user api with changelog entry'], repo);

      const result = await checkPullRequest({
        base: 'main',
        head: 'HEAD',
        cwd: repo
      });

      assert.equal(result.ok, true);
      assert.equal(result.skipped, false);
      assert.match(result.message, /Changelog check passed/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('skips if commit contains "Changelog: skip" trailer', async () => {
    const repo = createTestRepo();
    try {
      git(['checkout', '-b', 'feat/skip-trailer'], repo);
      fs.writeFileSync(path.join(repo, 'src/internal.js'), 'export const internal = true;\n', 'utf8');
      git(['add', '.'], repo);
      git(['commit', '-m', 'refactor: internal clean\n\nChangelog: skip'], repo);

      const result = await checkPullRequest({
        base: 'main',
        head: 'HEAD',
        cwd: repo
      });

      assert.equal(result.ok, true);
      assert.equal(result.skipped, true);
      assert.match(result.reason, /Changelog: skip/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('skips if PR label is in skip-labels', async () => {
    const repo = createTestRepo();
    try {
      git(['checkout', '-b', 'feat/labeled-pr'], repo);
      fs.writeFileSync(path.join(repo, 'src/something.js'), 'console.log(1);\n', 'utf8');
      git(['add', '.'], repo);
      git(['commit', '-m', 'feat: something'], repo);

      const result = await checkPullRequest({
        base: 'main',
        head: 'HEAD',
        labels: 'documentation,skip-changelog',
        cwd: repo
      });

      assert.equal(result.ok, true);
      assert.equal(result.skipped, true);
      assert.match(result.reason, /Skipped by pull request label "skip-changelog"/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('passes without changelog if changed files are ignored (e.g. tests)', async () => {
    const repo = createTestRepo();
    try {
      git(['checkout', '-b', 'test/add-tests'], repo);
      fs.writeFileSync(path.join(repo, 'src/index.test.js'), 'test("noop", () => {});\n', 'utf8');
      git(['add', '.'], repo);
      git(['commit', '-m', 'test: add unit test'], repo);

      const result = await checkPullRequest({
        base: 'main',
        head: 'HEAD',
        cwd: repo
      });

      assert.equal(result.ok, true);
      assert.equal(result.userFacingFiles.length, 0);
      assert.match(result.message, /No user-facing files were modified/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('fails if CHANGELOG.md is touched but nothing added to [Unreleased]', async () => {
    const repo = createTestRepo();
    try {
      git(['checkout', '-b', 'fix/changelog-typo'], repo);
      fs.writeFileSync(path.join(repo, 'src/core.js'), 'export const core = 1;\n', 'utf8');

      // Only fix a typo in the title
      const typoChangelog = `# Changelog for Project

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup.

[Unreleased]: https://github.com/YusufBeratZengin/changelog-guard/tree/HEAD
`;
      fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), typoChangelog, 'utf8');
      git(['add', '.'], repo);
      git(['commit', '-m', 'fix typo in header'], repo);

      const result = await checkPullRequest({
        base: 'main',
        head: 'HEAD',
        cwd: repo
      });

      assert.equal(result.ok, false);
      assert.equal(result.error, 'UNRELEASED_NOT_MODIFIED');
      assert.match(result.message, /no new entries were found in the ## \[Unreleased\] section/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
