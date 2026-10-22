/**
 * JSON formatter for changelog-guard diagnostics.
 */

export function formatJson(filePath, diagnostics) {
  const errorCount = diagnostics.filter(d => d.severity === 'error').length;
  const warningCount = diagnostics.filter(d => d.severity === 'warning').length;

  const result = {
    file: filePath,
    valid: errorCount === 0,
    errorCount,
    warningCount,
    diagnostics
  };

  return JSON.stringify(result, null, 2);
}
