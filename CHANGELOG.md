# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Reference example changelog (`examples/sample-CHANGELOG.md`), GitHub Actions workflow example, and npm scripts/pre-commit integration examples.
- Dedicated unit test suite for Git helper utilities and CLI edge-case test coverage.
- GitHub issue template configuration file (`.github/ISSUE_TEMPLATE/config.yml`) with security advisory and documentation links.
- Reproducible terminal SVG demo and English/Turkish quick starts, configuration, and FAQ.
- Built-in Node.js test coverage reporting and regression tests for validation edge cases.
- Weekly Dependabot updates, CodeQL scanning, and issue and pull request templates.
- Read-only demo verification and an enforced 85% source line coverage floor in the Node.js 22/24 CI matrix.

### Changed
- Group Dependabot version updates monthly for GitHub Actions and npm ecosystems.

### Fixed
- Detect changed user-facing files with non-ASCII or international characters in `check-pr`.
- Reject impossible calendar dates (such as non-leap year February 29) during release preparation and tolerate UTF-8 BOM in changelogs.

## [0.1.0] - 2026-10-23

### Added
- Core AST parser conforming to Keep a Changelog 1.1 specification.
- Linter checking heading structures, standard change types, ISO dates, semver validity, descending ordering, duplicate versions, missing links, and empty sections.
- `check-pr` command verifying user-facing changes include changelog entries, with support for commit trailers (`Changelog: skip`) and PR labels.
- `release` command performing byte-minimal transitions of `[Unreleased]` to dated versions and link reference updates.
- Zero-dependency CLI runner with `stylish` and `json` formatters.
- Composite GitHub Action (`action.yml`) for seamless workflow integration.

[Unreleased]: https://github.com/YusufBeratZengin/changelog-guard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/YusufBeratZengin/changelog-guard/releases/tag/v0.1.0
