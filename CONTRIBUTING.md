# Contributing to changelog-guard

Thank you for your interest in contributing to `changelog-guard`. This document outlines the process for proposing changes, reporting issues, and submitting code.

## Code of Conduct

All contributors and participants are expected to maintain a professional, respectful, and collaborative environment free of harassment and discrimination.

## Development Setup

`changelog-guard` is built with Node.js (>=20) and has zero runtime or development dependencies. Git is required for integration tests. All functionality relies on Node.js standard libraries and built-in runners.

1. Clone the repository:
   ```bash
   git clone https://github.com/YusufBeratZengin/changelog-guard.git
   cd changelog-guard
   ```

2. Verify that Node.js 20 or higher is installed:
   ```bash
   node -v
   ```

3. Run the test suite with line, branch, and function coverage printed to the terminal:
   ```bash
   npm test
   ```

4. Run the changelog linter:
   ```bash
   npm run lint
   ```

There is currently no separate typecheck command; the source is JavaScript. Add tests for meaningful uncovered branches and aim for at least 85% source line coverage. Coverage does not require an account or upload service.

CI tests Node.js 22 and 24 on Linux and Windows and enforces at least 85% line coverage for `src/**`. Run the same check with Node.js 22.8+:

```bash
npm test -- --test-coverage-include=src/** --test-coverage-lines=85
```

Keep `README.md` and `README.tr.md` structurally aligned. If the demo command, fixture, or output changes, regenerate the static SVG:

```bash
npm run demo
npm run demo:check
```

The demo fixture intentionally fails lint with exit code 1. Its JSON output is piped to `scripts/make-demo.mjs`, which validates the diagnostic and renders it as `docs/demo.svg`. `npm run demo:check` compares the current image with freshly captured output without writing a file; CI runs this check too.

## AI Assistance Policy

Contributions generated or assisted by AI tools are welcome provided that:

1. The author thoroughly understands, verifies, and takes full responsibility for all submitted code and documentation.
2. The pull request meets all test, lint, and coverage requirements (>=85% source line coverage floor).
3. No proprietary, unlicensed, confidential, or sensitive material is introduced.
4. Commit messages and pull request descriptions clearly explain what changed and why, adhering to Conventional Commits.

## Commit Message Guidelines

This project strictly adheres to [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Introduces a new feature.
- `fix:` Patches a bug.
- `docs:` Documentation modifications only.
- `test:` Adds or adjusts test cases.
- `refactor:` Code changes that neither fix a bug nor add a feature.
- `chore:` Maintenance tasks, dependency or tooling adjustments.

Example:
```
feat(linter): support custom link reference rules
```

If your commit intentionally does not warrant a changelog update (e.g., refactoring or internal documentation), include the commit trailer:
```
Changelog: skip
```

## Pull Request Guidelines

1. Branch from `main` with a descriptive name (e.g., `feat/custom-reporters` or `fix/windows-path-separator`).
2. Ensure all tests pass locally prior to submitting the PR.
3. If your pull request introduces user-facing changes (in `src/**` or `lib/**`), include an entry under the `## [Unreleased]` section of `CHANGELOG.md`.
4. Keep pull requests focused on a single responsibility.
5. All CI checks on both Linux and Windows must pass.
