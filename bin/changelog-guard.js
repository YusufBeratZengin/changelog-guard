#!/usr/bin/env node

/**
 * changelog-guard CLI
 * Zero external dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintChangelog } from '../src/linter.js';
import { releaseFile } from '../src/release.js';
import { checkPullRequest } from '../src/check-pr.js';
import { formatStylish } from '../src/formatters/stylish.js';
import { formatJson } from '../src/formatters/json.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package version
const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function printHelp() {
  console.log(`
changelog-guard v${pkg.version}
Lint CHANGELOG.md files in Keep a Changelog format and enforce in CI that user-facing changes come with a changelog entry.

USAGE:
  changelog-guard <command> [options]

COMMANDS:
  lint [file]              Lint a CHANGELOG.md file against Keep a Changelog 1.1 rules
  check-pr                 Verify that user-facing git changes include an entry in [Unreleased]
  release <version>        Move [Unreleased] entries to a new dated version and update link references
  init [file]              Create a starter Keep a Changelog 1.1 template file

OPTIONS (lint):
  --format <stylish|json>  Output format (default: stylish)
  --allow-empty-unreleased Allow the [Unreleased] section to have no entries
  --no-require-unreleased  Do not require an [Unreleased] section
  --check-orphans          Flag link references that don't match any version heading

OPTIONS (check-pr):
  --base <ref>             Base git ref (required, e.g. origin/main, HEAD~1)
  --head <ref>             Head git ref (default: HEAD)
  --file <path>            Path to changelog file (default: CHANGELOG.md)
  --user-facing <globs>    Comma-separated list of user-facing globs (default: src/**,lib/**)
  --ignore <globs>         Comma-separated list of globs to ignore
  --skip-trailer <trailer> Commit trailer to skip check (default: Changelog: skip)
  --skip-labels <labels>   Comma-separated PR labels that skip check
  --labels <labels>        Active PR labels (default: auto-detected from GITHUB_EVENT_PATH)

OPTIONS (release):
  --file <path>            Path to changelog file (default: CHANGELOG.md)
  --date <YYYY-MM-DD>      Release date (default: today)
  --dry-run                Print updated changelog to stdout without writing to disk

GLOBAL OPTIONS:
  -h, --help               Show this help message
  -v, --version            Show version number

EXAMPLES:
  changelog-guard lint
  changelog-guard lint docs/CHANGELOG.md --format json
  changelog-guard check-pr --base origin/main
  changelog-guard release 1.0.0
  changelog-guard release 1.0.0 --date 2026-10-22 --dry-run
`);
}

function parseCliArgs(args) {
  const flags = {};
  const positionals = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--') {
      positionals.push(...args.slice(i + 1));
      break;
    }

    if (arg.startsWith('--no-')) {
      const key = arg.slice(5);
      flags[key] = false;
    } else if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const val = arg.slice(eqIdx + 1);
        flags[key] = val;
      } else {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (arg.startsWith('-')) {
      const short = arg.slice(1);
      if (short === 'h') flags.help = true;
      else if (short === 'v') flags.version = true;
      else flags[short] = true;
    } else {
      positionals.push(arg);
    }
  }

  return { flags, positionals };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const { flags, positionals } = parseCliArgs(rawArgs);

  if (flags.help || (positionals.length === 0 && !flags.version)) {
    printHelp();
    process.exit(0);
  }

  if (flags.version) {
    console.log(pkg.version);
    process.exit(0);
  }

  const command = positionals[0];

  switch (command) {
    case 'lint': {
      const filePath = positionals[1] || flags.file || 'CHANGELOG.md';
      const fullPath = path.resolve(process.cwd(), filePath);

      if (!fs.existsSync(fullPath)) {
        console.error(`Error: File not found at ${fullPath}`);
        process.exit(1);
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const result = lintChangelog(content, {
        requireUnreleased: flags['require-unreleased'] !== false,
        allowEmptyUnreleased: Boolean(flags['allow-empty-unreleased']),
        checkOrphanLinks: Boolean(flags['check-orphans'])
      });

      const format = flags.format || 'stylish';
      if (format === 'json') {
        console.log(formatJson(filePath, result.diagnostics));
      } else {
        process.stdout.write(formatStylish(filePath, result.diagnostics));
      }

      process.exit(result.valid ? 0 : 1);
      break;
    }

    case 'check-pr': {
      const base = flags.base;
      if (!base) {
        console.error('Error: --base <ref> is required for check-pr.');
        console.error('Example: changelog-guard check-pr --base origin/main');
        process.exit(1);
      }

      try {
        const result = await checkPullRequest({
          base: flags.base,
          head: flags.head || 'HEAD',
          file: flags.file || 'CHANGELOG.md',
          userFacing: flags['user-facing'],
          ignore: flags.ignore,
          skipTrailer: flags['skip-trailer'],
          skipLabels: flags['skip-labels'],
          labels: flags.labels
        });

        if (result.skipped) {
          console.log(`[changelog-guard] ${result.reason}`);
          process.exit(0);
        }

        if (!result.ok) {
          console.error(`[changelog-guard] FAILED:\n${result.message}`);
          process.exit(1);
        }

        console.log(`[changelog-guard] PASSED: ${result.message}`);
        process.exit(0);
      } catch (err) {
        console.error(`[changelog-guard] Error: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'release': {
      const version = positionals[1];
      if (!version) {
        console.error('Error: version argument is required for release.');
        console.error('Example: changelog-guard release 1.0.0');
        process.exit(1);
      }

      const filePath = flags.file || 'CHANGELOG.md';
      try {
        const res = releaseFile(filePath, version, {
          date: flags.date,
          dryRun: Boolean(flags['dry-run'])
        });

        if (flags['dry-run']) {
          console.log(res.content);
        } else {
          console.log(`Released version [${res.releaseVersion}] (${res.releaseDate}) in ${filePath}`);
        }
        process.exit(0);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'init': {
      const targetFile = positionals[1] || flags.file || 'CHANGELOG.md';
      const fullPath = path.resolve(process.cwd(), targetFile);

      if (fs.existsSync(fullPath)) {
        console.error(`Error: File already exists at ${fullPath}`);
        process.exit(1);
      }

      const template = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project scaffolding.

[Unreleased]: https://github.com/YusufBeratZengin/changelog-guard/tree/HEAD
`;

      fs.writeFileSync(fullPath, template, 'utf8');
      console.log(`Created starter changelog at ${targetFile}`);
      process.exit(0);
      break;
    }

    default: {
      console.error(`Unknown command: "${command}"\n`);
      printHelp();
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
