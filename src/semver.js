/**
 * Pure JavaScript SemVer 2.0.0 parser and comparator with zero dependencies.
 */

const SEMVER_REGEX =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Checks whether a given string is a valid Semantic Version.
 * @param {string} version
 * @returns {boolean}
 */
export function isValid(version) {
  if (typeof version !== 'string') return false;
  return SEMVER_REGEX.test(version.trim());
}

/**
 * Parses a Semantic Version string into its components.
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number, prerelease: string[], build: string[], raw: string } | null}
 */
export function parse(version) {
  if (typeof version !== 'string') return null;
  const match = version.trim().match(SEMVER_REGEX);
  if (!match) return null;

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  const prerelease = match[4] ? match[4].split('.') : [];
  const build = match[5] ? match[5].split('.') : [];

  return {
    major,
    minor,
    patch,
    prerelease,
    build,
    raw: version.trim()
  };
}

/**
 * Compares two SemVer identifier parts according to SemVer 2.0.0 specification:
 * - Identifiers consisting of only digits are compared numerically.
 * - Identifiers with letters or hyphens are compared lexically.
 * - Numeric identifiers always have lower precedence than non-numeric identifiers.
 */
function compareIdentifiers(a, b) {
  const aIsNum = /^\d+$/.test(a);
  const bIsNum = /^\d+$/.test(b);

  if (aIsNum && bIsNum) {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    return numA === numB ? 0 : numA > numB ? 1 : -1;
  }

  if (aIsNum && !bIsNum) return -1;
  if (!aIsNum && bIsNum) return 1;

  return a === b ? 0 : a > b ? 1 : -1;
}

/**
 * Compares two SemVer versions.
 * Returns:
 *   1 if a > b
 *  -1 if a < b
 *   0 if a == b
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compare(a, b) {
  const parsedA = parse(a);
  const parsedB = parse(b);

  if (!parsedA || !parsedB) {
    throw new Error(`Invalid semver comparison between "${a}" and "${b}"`);
  }

  if (parsedA.major !== parsedB.major) {
    return parsedA.major > parsedB.major ? 1 : -1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor > parsedB.minor ? 1 : -1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch > parsedB.patch ? 1 : -1;
  }

  // Pre-release precedence rules:
  // 1. Normal version has higher precedence than pre-release version
  const hasPreA = parsedA.prerelease.length > 0;
  const hasPreB = parsedB.prerelease.length > 0;

  if (!hasPreA && hasPreB) return 1;
  if (hasPreA && !hasPreB) return -1;
  if (!hasPreA && !hasPreB) return 0;

  // Both have pre-release
  const minLen = Math.min(parsedA.prerelease.length, parsedB.prerelease.length);
  for (let i = 0; i < minLen; i++) {
    const diff = compareIdentifiers(parsedA.prerelease[i], parsedB.prerelease[i]);
    if (diff !== 0) return diff;
  }

  if (parsedA.prerelease.length !== parsedB.prerelease.length) {
    return parsedA.prerelease.length > parsedB.prerelease.length ? 1 : -1;
  }

  return 0;
}

export function gt(a, b) {
  return compare(a, b) > 0;
}

export function lt(a, b) {
  return compare(a, b) < 0;
}

export function eq(a, b) {
  return compare(a, b) === 0;
}

export function clean(version) {
  const parsed = parse(version);
  if (!parsed) return null;
  let str = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  if (parsed.prerelease.length > 0) {
    str += `-${parsed.prerelease.join('.')}`;
  }
  if (parsed.build.length > 0) {
    str += `+${parsed.build.join('.')}`;
  }
  return str;
}
