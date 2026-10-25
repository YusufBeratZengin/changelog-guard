# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Multi-factor authentication via time-based one-time passwords (TOTP).

### Fixed
- Prevent race condition during concurrent access token refresh requests.

## [1.1.0] - 2026-10-20

### Added
- Batch export feature for organization audit logs.

### Changed
- Streamline database migration runner to reduce peak memory usage.

### Deprecated
- Legacy token verification endpoint `/api/v1/auth/verify`.

### Removed
- Support for deprecated TLS 1.0 connections.

### Fixed
- URI encoding issue for profile paths containing international characters.

### Security
- Update JWT validation library to prevent algorithm confusion vulnerabilities.

## [1.0.0] - 2026-10-01

### Added
- Initial stable release.
- Core authentication and session management APIs.

[Unreleased]: https://github.com/example-org/sample-repo/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/example-org/sample-repo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/example-org/sample-repo/releases/tag/v1.0.0
