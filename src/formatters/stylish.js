/**
 * Stylish terminal formatter for changelog-guard diagnostics.
 * Clean, professional, zero dependencies, no emojis.
 */

const isColorSupported =
  !process.env.NO_COLOR &&
  (process.env.FORCE_COLOR || (process.stdout && process.stdout.isTTY));

const colors = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  underline: isColorSupported ? '\x1b[4m' : ''
};

/**
 * Formats lint results for stylish console output.
 * @param {string} filePath
 * @param {Array<{ rule: string, message: string, line: number, column: number, severity: 'error'|'warning' }>} diagnostics
 * @returns {string}
 */
export function formatStylish(filePath, diagnostics) {
  if (!diagnostics || diagnostics.length === 0) {
    return `${colors.green}${colors.bold}CHANGELOG is valid.${colors.reset} No issues found in ${filePath}\n`;
  }

  const lines = [];
  lines.push(`${colors.underline}${filePath}${colors.reset}`);

  let maxPosLen = 0;
  for (const d of diagnostics) {
    const pos = `${d.line}:${d.column}`;
    if (pos.length > maxPosLen) {
      maxPosLen = pos.length;
    }
  }

  let errorCount = 0;
  let warnCount = 0;

  for (const d of diagnostics) {
    if (d.severity === 'error') errorCount++;
    else warnCount++;

    const pos = `${d.line}:${d.column}`.padEnd(maxPosLen + 2, ' ');
    const sevColor = d.severity === 'error' ? colors.red : colors.yellow;
    const sevText = d.severity === 'error' ? 'error' : 'warning';
    const ruleText = `${colors.dim}${d.rule}${colors.reset}`;

    lines.push(`  ${colors.dim}${pos}${colors.reset} ${sevColor}${sevText.padEnd(8, ' ')}${colors.reset} ${d.message}  ${ruleText}`);
  }

  const total = errorCount + warnCount;
  const summaryParts = [];
  if (errorCount > 0) {
    summaryParts.push(`${errorCount} ${errorCount === 1 ? 'error' : 'errors'}`);
  }
  if (warnCount > 0) {
    summaryParts.push(`${warnCount} ${warnCount === 1 ? 'warning' : 'warnings'}`);
  }

  const summaryColor = errorCount > 0 ? colors.red : colors.yellow;
  lines.push('');
  lines.push(`${summaryColor}${colors.bold}${total} problems (${summaryParts.join(', ')})${colors.reset}`);

  return lines.join('\n') + '\n';
}
