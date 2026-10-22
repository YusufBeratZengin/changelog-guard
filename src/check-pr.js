/**
 * PR validation logic for changelog-guard.
 * Verifies that user-facing changes have corresponding entries in CHANGELOG.md under [Unreleased].
 * Zero external dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { filterFiles, normalizePath } from './glob.js';
import { getChangedFiles, getCommitMessages, hasSkipTrailer, getFileAtRef } from './git.js';
import { parseChangelog } from './parser.js';

export const DEFAULT_USER_FACING = ['src/**', 'lib/**'];
export const DEFAULT_IGNORE = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/test/**',
  '**/tests/**',
  '**/*.d.ts',
  '**/*.map'
];
export const DEFAULT_SKIP_LABELS = ['no-changelog', 'skip-changelog', 'chore', 'dependencies'];

/**
 * Reads pull request labels from GitHub event payload if available.
 * @returns {string[]}
 */
export function getGitHubEventLabels() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return [];

  try {
    const raw = fs.readFileSync(eventPath, 'utf8');
    const data = JSON.parse(raw);
    if (data.pull_request && Array.isArray(data.pull_request.labels)) {
      return data.pull_request.labels.map(l => (typeof l === 'string' ? l : l.name));
    }
  } catch {
    // Ignore JSON read errors
  }
  return [];
}

/**
 * Checks whether changes were added to the [Unreleased] section of the changelog.
 * @param {string} baseContent
 * @param {string} headContent
 * @returns {{ changed: boolean, addedItems: string[] }}
 */
export function checkUnreleasedChanges(baseContent, headContent) {
  const headAst = parseChangelog(headContent);
  const headUnreleased = headAst.versions.find(v => v.isUnreleased);

  if (!headUnreleased) {
    return { changed: false, addedItems: [] };
  }

  // Collect all items in head [Unreleased]
  const headItems = [];
  for (const t of headUnreleased.types) {
    for (const item of t.items) {
      headItems.push(item.text.trim());
    }
  }
  for (const item of headUnreleased.items) {
    headItems.push(item.text.trim());
  }

  if (headItems.length === 0 && headUnreleased.bodyLines.length === 0) {
    return { changed: false, addedItems: [] };
  }

  if (!baseContent) {
    // No base file existed, and head unreleased has items
    return { changed: headItems.length > 0 || headUnreleased.bodyLines.length > 0, addedItems: headItems };
  }

  const baseAst = parseChangelog(baseContent);
  const baseUnreleased = baseAst.versions.find(v => v.isUnreleased);

  if (!baseUnreleased) {
    // Base had no unreleased section, head added one with content
    return { changed: headItems.length > 0 || headUnreleased.bodyLines.length > 0, addedItems: headItems };
  }

  // Collect base items
  const baseItemsSet = new Set();
  for (const t of baseUnreleased.types) {
    for (const item of t.items) {
      baseItemsSet.add(item.text.trim());
    }
  }
  for (const item of baseUnreleased.items) {
    baseItemsSet.add(item.text.trim());
  }

  // Check for any newly added item in head that was not in base
  const addedItems = headItems.filter(item => !baseItemsSet.has(item));

  // Also check if bodyLines changed
  const baseBody = baseUnreleased.bodyLines.map(l => l.text.trim()).join('\n');
  const headBody = headUnreleased.bodyLines.map(l => l.text.trim()).join('\n');
  const bodyChanged = headBody.length > 0 && headBody !== baseBody;

  const changed = addedItems.length > 0 || bodyChanged;

  return { changed, addedItems };
}

/**
 * Runs the check-pr workflow.
 *
 * @param {object} options
 * @param {string} options.base Git base ref (e.g. 'origin/main', 'HEAD~1')
 * @param {string} [options.head='HEAD'] Git head ref
 * @param {string} [options.file='CHANGELOG.md'] Changelog file path
 * @param {string[]|string} [options.userFacing] Globs for user-facing files
 * @param {string[]|string} [options.ignore] Globs to ignore
 * @param {string} [options.skipTrailer='Changelog: skip'] Trailer to skip check
 * @param {string[]|string} [options.skipLabels] PR labels that skip check
 * @param {string[]|string} [options.labels] Active PR labels
 * @param {string} [options.cwd=process.cwd()] Working directory
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string, userFacingFiles?: string[], error?: string, message?: string }>}
 */
export async function checkPullRequest(options = {}) {
  const cwd = options.cwd || process.cwd();
  const base = options.base;
  const head = options.head || 'HEAD';
  const changelogPath = options.file || 'CHANGELOG.md';
  const normalizedChangelog = normalizePath(changelogPath);

  if (!base) {
    throw new Error('Missing required option: --base <ref>');
  }

  // 1. Check PR labels for skip
  let activeLabels = [];
  if (options.labels) {
    activeLabels = Array.isArray(options.labels)
      ? options.labels
      : options.labels.split(',').map(s => s.trim()).filter(Boolean);
  } else if (process.env.PR_LABELS) {
    activeLabels = process.env.PR_LABELS.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    activeLabels = getGitHubEventLabels();
  }

  const skipLabels = Array.isArray(options.skipLabels)
    ? options.skipLabels
    : (options.skipLabels || DEFAULT_SKIP_LABELS.join(',')).split(',').map(s => s.trim().toLowerCase());

  for (const label of activeLabels) {
    if (skipLabels.includes(label.toLowerCase())) {
      return {
        ok: true,
        skipped: true,
        reason: `Skipped by pull request label "${label}".`
      };
    }
  }

  // 2. Check commit trailers
  const skipTrailerRaw = options.skipTrailer || 'Changelog: skip';
  const [trailerKey, trailerVal = 'skip'] = skipTrailerRaw.split(':').map(s => s.trim());
  const commitMessages = getCommitMessages(base, head, cwd);
  const trailerCheck = hasSkipTrailer(commitMessages, trailerKey, trailerVal);

  if (trailerCheck.skipped) {
    return {
      ok: true,
      skipped: true,
      reason: `Skipped: ${trailerCheck.reason}.`
    };
  }

  // 3. Get changed files
  const changedFiles = getChangedFiles(base, head, cwd);
  const userFacingGlobs = options.userFacing || DEFAULT_USER_FACING;
  const ignoreGlobs = options.ignore !== undefined ? options.ignore : DEFAULT_IGNORE;

  const userFacingFiles = filterFiles(changedFiles, userFacingGlobs, ignoreGlobs);

  if (userFacingFiles.length === 0) {
    return {
      ok: true,
      skipped: false,
      userFacingFiles: [],
      message: 'No user-facing files were modified.'
    };
  }

  // 4. Check if changelog was touched
  const changelogTouched = changedFiles.some(f => normalizePath(f) === normalizedChangelog);

  if (!changelogTouched) {
    return {
      ok: false,
      skipped: false,
      userFacingFiles,
      error: 'CHANGELOG_NOT_MODIFIED',
      message:
        `User-facing changes detected in ${userFacingFiles.length} file(s), but ${changelogPath} was not modified.\n` +
        `Modified files:\n${userFacingFiles.map(f => `  - ${f}`).join('\n')}\n\n` +
        `Please add an entry under the ## [Unreleased] section of ${changelogPath}, ` +
        `or use the commit trailer "${skipTrailerRaw}" to skip this check.`
    };
  }

  // 5. Changelog was touched, check if [Unreleased] section has actual additions
  let baseContent = getFileAtRef(base, changelogPath, cwd);
  let headContent = '';

  const fullChangelogPath = path.resolve(cwd, changelogPath);
  if (fs.existsSync(fullChangelogPath)) {
    headContent = fs.readFileSync(fullChangelogPath, 'utf8');
  } else {
    headContent = getFileAtRef(head, changelogPath, cwd) || '';
  }

  const unreleasedCheck = checkUnreleasedChanges(baseContent, headContent);

  if (!unreleasedCheck.changed) {
    return {
      ok: false,
      skipped: false,
      userFacingFiles,
      error: 'UNRELEASED_NOT_MODIFIED',
      message:
        `${changelogPath} was modified, but no new entries were found in the ## [Unreleased] section.\n` +
        `Please ensure you add your change under ## [Unreleased] (e.g., under ### Added, ### Fixed, etc.).`
    };
  }

  return {
    ok: true,
    skipped: false,
    userFacingFiles,
    addedItems: unreleasedCheck.addedItems,
    message: `Changelog check passed: ${unreleasedCheck.addedItems.length} entry/entries added to [Unreleased].`
  };
}
