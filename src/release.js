/**
 * Keep a Changelog 1.1 release operation.
 * Moves [Unreleased] entries to a new dated version and updates link references.
 * Performs a byte-minimal edit, preserving existing line endings and structure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseChangelog } from './parser.js';
import * as semver from './semver.js';

/**
 * Detects the newline style used in the text ('\r\n' or '\n').
 * @param {string} text
 * @returns {string}
 */
export function detectEol(text) {
  const crlfIndex = text.indexOf('\r\n');
  return crlfIndex !== -1 ? '\r\n' : '\n';
}

/**
 * Formats today's date as YYYY-MM-DD.
 * @returns {string}
 */
export function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Performs a release on the given changelog content.
 *
 * @param {string} content
 * @param {string} rawVersion
 * @param {object} [options]
 * @param {string} [options.date] Release date in YYYY-MM-DD (defaults to today)
 * @returns {{ content: string, previousVersion: string | null, releaseVersion: string, releaseDate: string }}
 */
export function executeRelease(content, rawVersion, options = {}) {
  const version = rawVersion.replace(/^v/, '').trim();
  if (!semver.isValid(version)) {
    throw new Error(`Invalid version "${rawVersion}". Expected valid SemVer (e.g. 1.0.0).`);
  }

  const releaseDate = options.date || getTodayDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    throw new Error(`Invalid date "${releaseDate}". Expected ISO format YYYY-MM-DD.`);
  }

  const ast = parseChangelog(content);
  const unreleased = ast.versions.find(v => v.isUnreleased);

  if (!unreleased) {
    throw new Error('Changelog has no ## [Unreleased] section to release.');
  }

  // Check if unreleased section is empty
  const hasEntries =
    unreleased.types.length > 0 ||
    unreleased.items.length > 0 ||
    unreleased.bodyLines.length > 0;

  if (!hasEntries) {
    throw new Error('Cannot release: ## [Unreleased] section has no entries.');
  }

  // Find latest existing released version
  const previousReleased = ast.versions.find(v => !v.isUnreleased);
  const previousVersion = previousReleased ? previousReleased.version : null;

  if (previousVersion && semver.isValid(previousVersion)) {
    if (semver.compare(version, previousVersion) <= 0) {
      throw new Error(
        `New version "${version}" must be greater than previous version "${previousVersion}".`
      );
    }
  }

  const eol = detectEol(content);
  const lines = content.split(/\r?\n/);

  // 1. Locate ## [Unreleased] line
  const unreleasedLineIndex = unreleased.line - 1;
  const originalUnreleasedLine = lines[unreleasedLineIndex];

  // Prepare new heading block:
  // ## [Unreleased]
  //
  // ## [x.y.z] - YYYY-MM-DD
  const newHeadingBlock = `## [Unreleased]${eol}${eol}## [${version}] - ${releaseDate}`;

  // 2. Link reference resolution and update
  const unreleasedRef = ast.linkReferences.get('Unreleased') ||
    [...ast.linkReferences.entries()].find(([k]) => k.toLowerCase() === 'unreleased')?.[1];

  let newUnreleasedRefLine = null;
  let newVersionRefLine = null;
  let unreleasedRefLineIndex = unreleasedRef ? unreleasedRef.line - 1 : -1;

  if (unreleasedRef) {
    const url = unreleasedRef.url;
    // Check if compare url pattern: .../compare/(v?)(...)...HEAD
    const compareMatch = url.match(/^(.*\/compare\/)(v?)(.*)\.\.\.HEAD$/i);
    const gitlabCompareMatch = url.match(/^(.*\/-\/compare\/)(v?)(.*)\.\.\.HEAD$/i);

    if (compareMatch) {
      const baseCompare = compareMatch[1];
      const tagPrefix = compareMatch[2] || (previousVersion && url.includes(`v${previousVersion}`) ? 'v' : '');

      newUnreleasedRefLine = `[Unreleased]: ${baseCompare}${tagPrefix}${version}...HEAD`;

      if (previousVersion) {
        newVersionRefLine = `[${version}]: ${baseCompare}${tagPrefix}${previousVersion}...${tagPrefix}${version}`;
      } else {
        // First release, replace compare with tag release
        const repoBase = baseCompare.replace(/\/compare\/$/, '');
        newVersionRefLine = `[${version}]: ${repoBase}/releases/tag/${tagPrefix}${version}`;
      }
    } else if (gitlabCompareMatch) {
      const baseCompare = gitlabCompareMatch[1];
      const tagPrefix = gitlabCompareMatch[2] || '';
      newUnreleasedRefLine = `[Unreleased]: ${baseCompare}${tagPrefix}${version}...HEAD`;
      if (previousVersion) {
        newVersionRefLine = `[${version}]: ${baseCompare}${tagPrefix}${previousVersion}...${tagPrefix}${version}`;
      } else {
        const repoBase = baseCompare.replace(/\/-\/compare\/$/, '');
        newVersionRefLine = `[${version}]: ${repoBase}/-/tags/${tagPrefix}${version}`;
      }
    } else {
      // Generic base URL
      const base = url.replace(/\/tree\/.*$/, '').replace(/\/releases\/.*$/, '');
      newUnreleasedRefLine = `[Unreleased]: ${base}/compare/v${version}...HEAD`;
      if (previousVersion) {
        newVersionRefLine = `[${version}]: ${base}/compare/v${previousVersion}...v${version}`;
      } else {
        newVersionRefLine = `[${version}]: ${base}/releases/tag/v${version}`;
      }
    }
  }

  // Perform byte-minimal line replacements:
  lines[unreleasedLineIndex] = newHeadingBlock;

  if (unreleasedRefLineIndex !== -1 && newUnreleasedRefLine && newVersionRefLine) {
    lines[unreleasedRefLineIndex] = `${newUnreleasedRefLine}${eol}${newVersionRefLine}`;
  }

  const updatedContent = lines.join(eol);

  return {
    content: updatedContent,
    previousVersion,
    releaseVersion: version,
    releaseDate
  };
}

/**
 * Runs release command on a file.
 * @param {string} filePath
 * @param {string} version
 * @param {object} [options]
 * @param {boolean} [options.dryRun]
 * @param {string} [options.date]
 * @returns {{ content: string, written: boolean, previousVersion: string | null, releaseVersion: string, releaseDate: string }}
 */
export function releaseFile(filePath, version, options = {}) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Changelog file not found at: ${fullPath}`);
  }

  const rawContent = fs.readFileSync(fullPath, 'utf8');
  const result = executeRelease(rawContent, version, options);

  if (!options.dryRun) {
    fs.writeFileSync(fullPath, result.content, 'utf8');
  }

  return {
    ...result,
    filePath: fullPath,
    written: !options.dryRun
  };
}
