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

Keep `README.md` and `README.tr.md` structurally aligned. If the demo command, fixture, or output changes, regenerate the static SVG:

```bash
npm run demo
```

The demo fixture intentionally fails lint with exit code 1. Its JSON output is piped to `scripts/make-demo.mjs`, which validates the diagnostic and renders it as `docs/demo.svg`. CI checks that regeneration leaves the image unchanged.

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
