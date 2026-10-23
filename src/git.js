/**
 * Git utilities for changelog-guard.
 * Zero external dependencies.
 */

import { execFileSync } from 'node:child_process';

/**
 * Executes a git command and returns its standard output.
 * @param {string[]} args
 * @param {string} [cwd]
 * @returns {string}
 */
export function runGit(args, cwd = process.cwd()) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString().trim() : '';
    const stdout = error.stdout ? error.stdout.toString().trim() : '';
    const err = new Error(
      `git ${args.join(' ')} failed (exit ${error.status}): ${stderr || stdout || error.message}`
    );
    err.status = error.status;
    err.stderr = stderr;
    err.stdout = stdout;
    throw err;
  }
}

/**
 * Returns a list of changed file paths between base and head.
 * @param {string} base
 * @param {string} head
 * @param {string} [cwd]
 * @returns {string[]}
 */
export function getChangedFiles(base, head, cwd = process.cwd()) {
  let diffOut = '';
  // Try three-dot diff first, fallback to two-dot diff
  try {
    diffOut = runGit(['diff', '--name-only', '-z', `${base}...${head}`], cwd);
  } catch {
    diffOut = runGit(['diff', '--name-only', '-z', base, head], cwd);
  }

  if (!diffOut) return [];
  return diffOut
    .split('\0')
    .filter(Boolean);
}

/**
 * Retrieves commit messages between base and head.
 * @param {string} base
 * @param {string} head
 * @param {string} [cwd]
 * @returns {string[]}
 */
export function getCommitMessages(base, head, cwd = process.cwd()) {
  try {
    const output = runGit(['log', '--format=%B%x00', `${base}..${head}`], cwd);
    if (!output) return [];
    return output.split('\x00').map(m => m.trim()).filter(Boolean);
  } catch {
    // If base..head fails (e.g. detached HEAD or single commit), try HEAD only
    try {
      const output = runGit(['log', '-1', '--format=%B'], cwd);
      return output ? [output.trim()] : [];
    } catch {
      return [];
    }
  }
}

/**
 * Checks whether commit messages contain a changelog skip indicator.
 * Supports:
 * - Commit trailer: "Changelog: skip" (case insensitive)
 * - Commit message tag: "[skip changelog]" or "[changelog skip]"
 * @param {string[]} messages
 * @param {string} [trailerKey='Changelog']
 * @param {string} [trailerValue='skip']
 * @returns {{ skipped: boolean, reason?: string }}
 */
export function hasSkipTrailer(messages, trailerKey = 'Changelog', trailerValue = 'skip') {
  const trailerRegex = new RegExp(`^${trailerKey}\\s*:\\s*${trailerValue}\\s*$`, 'im');
  const bracketRegex = /\[(skip\s+changelog|changelog\s+skip|no\s+changelog)\]/i;

  for (const msg of messages) {
    if (trailerRegex.test(msg)) {
      return {
        skipped: true,
        reason: `Found commit trailer "${trailerKey}: ${trailerValue}"`
      };
    }
    if (bracketRegex.test(msg)) {
      return {
        skipped: true,
        reason: 'Found skip tag in commit message'
      };
    }
  }

  return { skipped: false };
}

/**
 * Gets file content at a specific git ref. Returns null if file does not exist at ref.
 * @param {string} ref
 * @param {string} filePath
 * @param {string} [cwd]
 * @returns {string | null}
 */
export function getFileAtRef(ref, filePath, cwd = process.cwd()) {
  const normalized = filePath.replace(/\\/g, '/');
  try {
    return runGit(['show', `${ref}:${normalized}`], cwd);
  } catch {
    return null;
  }
}
