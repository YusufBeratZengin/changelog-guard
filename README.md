# changelog-guard

A zero-dependency linter and CI gatekeeper for `CHANGELOG.md` files conforming to the [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/) specification.

## Overview

Software release notes often rot when contributors ship user-facing changes without documenting them. Full-fledged automated release managers (such as semantic-release or changesets) introduce significant configuration overhead, extra dependencies, and altered git workflows.

`changelog-guard` provides a lightweight, focused alternative:
1. Validates that `CHANGELOG.md` strictly follows Keep a Changelog 1.1 and Semantic Versioning 2.0.0 standards.
2. Enforces in pull request CI that changes touching user-facing code include a documented entry under `[Unreleased]`.
3. Automates release transitions by moving `[Unreleased]` entries to a dated version and updating comparison link references with byte-minimal edits.

## Features

- **Zero Runtime Dependencies**: Written entirely in pure modern Node.js standard libraries.
- **Keep a Changelog 1.1 Compliant**: Parses and validates all standard sections and change types.
- **Strict Lint Rules**:
  - `heading-structure`: Enforces H1 title, H2 versions, and H3 change types without invalid nesting or jumps.
  - `unknown-change-type`: Restricts change types strictly to `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security`.
  - `non-iso-date`: Requires real calendar dates in ISO 8601 `YYYY-MM-DD` format.
  - `versions-not-descending`: Ensures versions are ordered in strict descending order via SemVer 2.0.0 precedence.
  - `invalid-semver`: Verifies semantic version format (`MAJOR.MINOR.PATCH[-prerelease][+build]`).
  - `duplicate-version`: Detects duplicate version headings.
  - `missing-link-reference`: Ensures bracketed versions have corresponding markdown reference links.
  - `empty-section`: Flags empty change types or version blocks without content.
  - `unreleased-missing`: Enforces presence of the `## [Unreleased]` section at the top of version history.
- **CI Gatekeeping (`check-pr`)**:
  - Inspects `git diff` against base branch.
  - Identifies user-facing modifications (e.g., `src/**`, `lib/**`).
  - Validates that additions were made to the `[Unreleased]` section.
  - Supports commit trailers (e.g., `Changelog: skip`) and PR labels (e.g., `no-changelog`, `chore`) to bypass checks when appropriate.
- **Release Management (`release`)**:
  - Promotes `[Unreleased]` entries into a new dated release header.
  - Updates repository comparison URLs and tag URLs automatically.
  - Preserves exact newline format (CRLF or LF) and unrelated file contents.
- **Composite GitHub Action**: Pre-packaged GitHub Action ready for workflow pipelines.

## Requirements

- Node.js >= 20.0.0
- Git (for `check-pr` operations)

## Installation

Run directly with `npx`:

```bash
npx changelog-guard lint
```

Or install as a development dependency:

```bash
npm install --save-dev changelog-guard
```

## CLI Usage

### 1. `lint`

Checks `CHANGELOG.md` for syntax and structural conformance.

```bash
# Lint default CHANGELOG.md in current directory
changelog-guard lint

# Lint specific file
changelog-guard lint docs/CHANGELOG.md

# Output results as JSON
changelog-guard lint --format json

# Allow an empty [Unreleased] section (e.g. immediately after a release)
changelog-guard lint --allow-empty-unreleased

# Disable check for missing [Unreleased] section
changelog-guard lint --no-require-unreleased
```

### 2. `check-pr`

Verifies that pull requests modifying user-facing code also modify the `[Unreleased]` section.

```bash
# Basic check against origin/main
changelog-guard check-pr --base origin/main

# Custom user-facing globs and ignored files
changelog-guard check-pr \
  --base origin/main \
  --head HEAD \
  --user-facing "src/**,lib/**,packages/**" \
  --ignore "**/*.test.js,**/*.spec.ts"

# Custom skip trailer or skip labels
changelog-guard check-pr \
  --base origin/main \
  --skip-trailer "Changelog: skip" \
  --skip-labels "no-changelog,skip-changelog,dependencies"
```

#### Skipping the Check

If a pull request does not require a changelog entry (such as internal refactoring or chore work):

- **Commit Trailer**: Include `Changelog: skip` in the commit message body:
  ```
  refactor: restructure internal parser loop

  Changelog: skip
  ```
- **Commit Message Tag**: Include `[skip changelog]` anywhere in the commit subject or body.
- **PR Labels**: Attach a label configured in `--skip-labels` (default: `no-changelog`, `skip-changelog`, `chore`, `dependencies`). When executed inside GitHub Actions, labels are detected automatically from the event payload.

### 3. `release`

Cuts a new release by moving `[Unreleased]` items under a new version heading and updating footer links.

```bash
# Release version 1.1.0 with today's date
changelog-guard release 1.1.0

# Release with a specific date
changelog-guard release 1.1.0 --date 2026-10-22

# Preview modifications without writing to disk
changelog-guard release 1.1.0 --dry-run
```

### 4. `init`

Creates a clean, valid template `CHANGELOG.md` in the current working directory.

```bash
changelog-guard init
```

## GitHub Action

You can integrate `changelog-guard` directly into your GitHub Actions workflow:

```yaml
name: Changelog Enforcement

on:
  pull_request:
    branches: [main]

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Verify Changelog
        uses: YusufBeratZengin/changelog-guard@v1
        with:
          mode: 'both' # 'check-pr', 'lint', or 'both'
          base: ${{ github.base_ref }}
          head: ${{ github.head_ref }}
```

### Action Inputs

| Input                    | Description                                                   | Default                                         |
| ------------------------ | ------------------------------------------------------------- | ----------------------------------------------- |
| `mode`                   | Execution mode (`check-pr`, `lint`, or `both`)               | `both`                                          |
| `file`                   | Path to the changelog file                                    | `CHANGELOG.md`                                  |
| `base`                   | Git base reference for diff comparison                        | `${{ github.base_ref }}`                        |
| `head`                   | Git head reference for diff comparison                        | `${{ github.head_ref }}`                        |
| `user-facing`            | Comma-separated globs matching user-facing code                | `src/**,lib/**`                                 |
| `ignore`                 | Comma-separated globs to ignore                              | `**/*.test.*,**/*.spec.*,**/test/**,**/*.d.ts`  |
| `skip-trailer`           | Commit trailer key/value to bypass check                      | `Changelog: skip`                               |
| `skip-labels`            | Comma-separated PR labels that bypass check                   | `no-changelog,skip-changelog,chore`             |
| `allow-empty-unreleased` | Permit an empty `[Unreleased]` section                        | `false`                                         |

## Programmatic API

`changelog-guard` exports all underlying functionality as an ES module:

```javascript
import {
  parseChangelog,
  lintChangelog,
  checkPullRequest,
  executeRelease,
  semver,
  glob
} from 'changelog-guard';

// Lint changelog text
const result = lintChangelog(content);
if (!result.valid) {
  console.error(result.diagnostics);
}

// Cut a release programmatically
const release = executeRelease(content, '1.2.0', { date: '2026-10-22' });
console.log(release.content);
```

## License

MIT - Copyright (c) 2026 Yusuf Berat Zengin. See [LICENSE](LICENSE) for details.
