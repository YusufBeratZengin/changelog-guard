/**
 * Pure JavaScript glob matcher with zero dependencies.
 * Supports:
 * - '*' (single segment match, not crossing '/')
 * - '**' (multi-segment recursive match)
 * - '?' (single character match)
 * - '{a,b,c}' (brace expansion)
 * - Negation '!'
 */

/**
 * Normalizes file paths to POSIX style (forward slashes) and trims leading/trailing slashes.
 * @param {string} path
 * @returns {string}
 */
export function normalizePath(path) {
  if (typeof path !== 'string') return '';
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * Expands brace patterns like "{src,lib}/**" into ["src/**", "lib/**"].
 * @param {string} pattern
 * @returns {string[]}
 */
export function expandBraces(pattern) {
  const match = /\{([^}]+)\}/.exec(pattern);
  if (!match) return [pattern];

  const prefix = pattern.slice(0, match.index);
  const suffix = pattern.slice(match.index + match[0].length);
  const choices = match[1].split(',');

  const expanded = [];
  for (const choice of choices) {
    const sub = `${prefix}${choice.trim()}${suffix}`;
    expanded.push(...expandBraces(sub));
  }
  return expanded;
}

/**
 * Converts a glob pattern into a RegExp.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegex(glob) {
  let p = normalizePath(glob);
  let regexStr = '';
  let i = 0;
  const len = p.length;

  while (i < len) {
    const c = p[i];

    if (c === '*') {
      if (p[i + 1] === '*') {
        // Double star '**'
        i += 2;
        if (p[i] === '/') {
          i++;
          // '**/foo' -> '(?:.+/)?foo'
          regexStr += '(?:(?:.+/)?|)';
        } else {
          // 'foo/**' -> 'foo(?:/.*)?'
          regexStr += '.*';
        }
      } else {
        // Single star '*' -> matches anything except '/'
        regexStr += '[^/]*';
        i++;
      }
    } else if (c === '?') {
      regexStr += '[^/]';
      i++;
    } else if ('+().^$|{}[]\\'.includes(c)) {
      regexStr += `\\${c}`;
      i++;
    } else {
      regexStr += c;
      i++;
    }
  }

  return new RegExp(`^${regexStr}$`);
}

/**
 * Tests if a file path matches a glob pattern.
 * @param {string} filePath
 * @param {string} pattern
 * @returns {boolean}
 */
export function isMatch(filePath, pattern) {
  const normalized = normalizePath(filePath);
  const patterns = expandBraces(pattern);

  for (const pat of patterns) {
    let p = pat.trim();
    if (!p) continue;
    const isNegated = p.startsWith('!');
    if (isNegated) p = p.slice(1);

    const re = globToRegex(p);
    const matches = re.test(normalized);
    if (matches) {
      return !isNegated;
    }
  }

  return false;
}

/**
 * Filters a list of files against include patterns and ignore patterns.
 * @param {string[]} files
 * @param {string[]|string} patterns
 * @param {string[]|string} [ignorePatterns]
 * @returns {string[]}
 */
export function filterFiles(files, patterns, ignorePatterns = []) {
  const incList = Array.isArray(patterns) ? patterns : patterns.split(',').map(s => s.trim());
  const ignList = Array.isArray(ignorePatterns) ? ignorePatterns : ignorePatterns.split(',').map(s => s.trim());

  const includeRegexes = [];
  for (const pat of incList) {
    if (!pat) continue;
    for (const sub of expandBraces(pat)) {
      includeRegexes.push(globToRegex(sub));
    }
  }

  const ignoreRegexes = [];
  for (const pat of ignList) {
    if (!pat) continue;
    for (const sub of expandBraces(pat)) {
      ignoreRegexes.push(globToRegex(sub));
    }
  }

  return files.filter(f => {
    const norm = normalizePath(f);

    // Check ignore first
    for (const ignRe of ignoreRegexes) {
      if (ignRe.test(norm)) return false;
    }

    // Check include
    for (const incRe of includeRegexes) {
      if (incRe.test(norm)) return true;
    }

    return false;
  });
}
