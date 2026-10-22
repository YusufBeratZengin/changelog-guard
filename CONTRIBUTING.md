# Contributing to changelog-guard

Thank you for your interest in contributing to `changelog-guard`. This document outlines the process for proposing changes, reporting issues, and submitting code.

## Code of Conduct

All contributors and participants are expected to maintain a professional, respectful, and collaborative environment free of harassment and discrimination.

## Development Setup

`changelog-guard` is built with Node.js (>=20) and has zero runtime or development dependencies. All functionality relies on modern Node.js standard libraries and built-in runners.

1. Clone the repository:
   ```bash
   git clone https://github.com/YusufBeratZengin/changelog-guard.git
   cd changelog-guard
   ```

2. Verify that Node.js 20 or higher is installed:
   ```bash
   node -v
   ```

3. Run the test suite:
   ```bash
   npm test
   ```

4. Run the changelog linter:
   ```bash
   npm run lint
   ```

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
