import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runGit, getChangedFiles, getCommitMessages, hasSkipTrailer, getFileAtRef } from '../src/git.js';

describe('git', () => {
  test('runGit executes a git command and returns stdout', () => {
    const stdout = runGit(['status', '--porcelain']);
    assert.equal(typeof stdout, 'string');
  });

  test('runGit throws on invalid git command with error details', () => {
    assert.throws(
      () => runGit(['non-existent-subcommand-xyz']),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(typeof err.status === 'number');
        assert.match(err.message, /git non-existent-subcommand-xyz failed/);
        return true;
      }
    );
  });

  test('getFileAtRef returns content at ref or null when ref or file is missing', () => {
    const pkg = getFileAtRef('HEAD', 'package.json');
    assert.ok(pkg);
    assert.match(pkg, /changelog-guard/);

    const missingFile = getFileAtRef('HEAD', 'non-existent-file-xyz.txt');
    assert.equal(missingFile, null);

    const missingRef = getFileAtRef('invalid-ref-1234567890', 'package.json');
    assert.equal(missingRef, null);
  });

  test('getCommitMessages retrieves commit messages and falls back on invalid range', () => {
    const messages = getCommitMessages('HEAD~1', 'HEAD');
    assert.ok(Array.isArray(messages));
    assert.ok(messages.length >= 1);

    // Fallback to single commit or empty when range fails
    const fallback = getCommitMessages('invalid-ref-xyz', 'HEAD');
    assert.ok(Array.isArray(fallback));
  });

  test('getChangedFiles returns list of changed files and handles fallback', () => {
    const files = getChangedFiles('HEAD~1', 'HEAD');
    assert.ok(Array.isArray(files));

    // When no changes between same commit
    const empty = getChangedFiles('HEAD', 'HEAD');
    assert.deepEqual(empty, []);
  });

  test('hasSkipTrailer detects commit trailers and bracketed skip tags', () => {
    assert.deepEqual(hasSkipTrailer(['fix: small fix\n\nChangelog: skip']), {
      skipped: true,
      reason: 'Found commit trailer "Changelog: skip"'
    });
    assert.deepEqual(hasSkipTrailer(['chore: update [skip changelog]']), {
      skipped: true,
      reason: 'Found skip tag in commit message'
    });
    assert.deepEqual(hasSkipTrailer(['docs: update [changelog skip]']), {
      skipped: true,
      reason: 'Found skip tag in commit message'
    });
    assert.deepEqual(hasSkipTrailer(['ci: update [no changelog]']), {
      skipped: true,
      reason: 'Found skip tag in commit message'
    });
    assert.deepEqual(hasSkipTrailer(['feat: normal feature']), {
      skipped: false
    });
    // Custom trailer
    assert.deepEqual(hasSkipTrailer(['test: test\n\nRelease-Notes: none'], 'Release-Notes', 'none'), {
      skipped: true,
      reason: 'Found commit trailer "Release-Notes: none"'
    });
  });
});
