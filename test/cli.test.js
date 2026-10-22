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
});
