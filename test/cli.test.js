import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, '../bin/changelog-guard.js');

function runCli(args, options = {}) {
  try {
    const stdout = execFileSync(process.execPath, [cliPath, ...args], {
      encoding: 'utf8',
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      status: error.status,
      stdout: error.stdout ? error.stdout.toString() : '',
      stderr: error.stderr ? error.stderr.toString() : ''
    };
  }
}

describe('cli', () => {
  test('--help prints usage', () => {
    const res = runCli(['--help']);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /USAGE:/);
    assert.match(res.stdout, /changelog-guard <command>/);
  });

  test('--version prints version', () => {
    const res = runCli(['--version']);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /^\d+\.\d+\.\d+/);
  });

  test('lint valid changelog exits 0', () => {
    const validFile = path.resolve(__dirname, 'fixtures/valid-changelog.md');
    const res = runCli(['lint', validFile]);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /CHANGELOG is valid/);
  });

  test('lint invalid changelog exits 1 and shows errors', () => {
    const invalidFile = path.resolve(__dirname, 'fixtures/invalid-date-changelog.md');
    const res = runCli(['lint', invalidFile]);
    assert.equal(res.status, 1);
    assert.match(res.stdout, /non-iso-date/);
  });

  test('lint --format json outputs valid json', () => {
    const invalidFile = path.resolve(__dirname, 'fixtures/invalid-date-changelog.md');
    const res = runCli(['lint', invalidFile, '--format', 'json']);
    assert.equal(res.status, 1);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.valid, false);
    assert.equal(parsed.errorCount >= 1, true);
  });

  test('init command generates starter template', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-init-test-'));
    const targetFile = path.join(tmpDir, 'CHANGELOG.md');

    try {
      const res = runCli(['init', targetFile]);
      assert.equal(res.status, 0);
      assert.equal(fs.existsSync(targetFile), true);
      const content = fs.readFileSync(targetFile, 'utf8');
      assert.match(content, /# Changelog/);
      assert.match(content, /## \[Unreleased\]/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('release --dry-run prints to stdout', () => {
    const validFile = path.resolve(__dirname, 'fixtures/valid-changelog.md');
    const res = runCli(['release', '2.0.0', '--file', validFile, '--dry-run', '--date', '2026-10-22']);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /## \[2\.0\.0\] - 2026-10-22/);
  });

  test('help aliases work and unknown commands fail with usage', () => {
    for (const args of [[], ['-h']]) {
      const result = runCli(args);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /USAGE:/);
    }
    const version = runCli(['-v']);
    assert.equal(version.status, 0);
    assert.match(version.stdout, /^\d+\.\d+\.\d+/);
    const unknown = runCli(['unknown-command']);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /Unknown command/);
    assert.match(unknown.stdout, /USAGE:/);
  });

  test('inline flag values and end-of-options preserve the requested file', () => {
    const fixture = path.resolve(__dirname, 'fixtures/valid-changelog.md');
    const json = runCli(['lint', `--file=${fixture}`, '--format=json']);
    assert.equal(json.status, 0);
    assert.equal(JSON.parse(json.stdout).file, fixture);
    const positional = runCli(['lint', '--', fixture]);
    assert.equal(positional.status, 0);
    assert.match(positional.stdout, /CHANGELOG is valid/);
  });

  test('missing required arguments fail with actionable errors', () => {
    const check = runCli(['check-pr']);
    assert.equal(check.status, 1);
    assert.match(check.stderr, /--base <ref> is required/);
    const release = runCli(['release']);
    assert.equal(release.status, 1);
    assert.match(release.stderr, /version argument is required/);
    const fixture = path.resolve(__dirname, 'fixtures/valid-changelog.md');
    const invalid = runCli(['release', 'invalid', '--file', fixture, '--dry-run']);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Invalid version/);
  });

  test('init never overwrites existing content and missing files fail lint', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-cli-safety-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const target = path.join(directory, 'CHANGELOG.md');
    const original = '# Existing notes\n';
    fs.writeFileSync(target, original);
    const init = runCli(['init', '--file', target]);
    assert.equal(init.status, 1);
    assert.match(init.stderr, /File already exists/);
    assert.equal(fs.readFileSync(target, 'utf8'), original);
    const missing = runCli(['lint', path.join(directory, 'missing.md')]);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /File not found/);
  });

  test('CLI policy flags allow empty or absent Unreleased without suppressing other errors', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-cli-policy-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const target = path.join(directory, 'CHANGELOG.md');
    fs.writeFileSync(target, '# Changelog\n## Unreleased\n');
    assert.equal(runCli(['lint', target]).status, 1);
    assert.equal(runCli(['lint', target, '--allow-empty-unreleased']).status, 0);
    const released = path.resolve(__dirname, 'fixtures/missing-unreleased-changelog.md');
    assert.equal(runCli(['lint', released, '--no-require-unreleased']).status, 0);
    const skip = runCli(['check-pr', '--base', 'main', '--labels', 'no-changelog']);
    assert.equal(skip.status, 0);
    assert.match(skip.stdout, /Skipped by pull request label/);
  });
});
