/**
 * Keep a Changelog 1.1 AST Parser with line/column tracking.
 * Zero external dependencies.
 */

export const STANDARD_CHANGE_TYPES = [
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security'
];

/**
 * Parses markdown CHANGELOG content into an AST.
 * @param {string} content
 * @returns {ChangelogAST}
 */
export function parseChangelog(content) {
  const lines = content.split(/\r?\n/);
  const headings = [];
  const versions = [];
  const linkReferences = new Map();
  const errors = [];

  let inCodeBlock = false;
  let codeFence = '';
  let title = null;
  let currentVersion = null;
  let currentType = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    // Handle code blocks to avoid false headings
    const codeMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (codeMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeFence = codeMatch[1];
      } else if (trimmed.startsWith(codeFence.slice(0, 3))) {
        inCodeBlock = false;
        codeFence = '';
      }
      continue;
    }
    if (inCodeBlock) continue;

    // Link reference definition at bottom or anywhere: e.g. [Unreleased]: https://...
    const linkRefMatch = trimmed.match(/^\[([^\]]+)\]:\s*(\S+.*)$/);
    if (linkRefMatch) {
      const tag = linkRefMatch[1].trim();
      const url = linkRefMatch[2].trim();
      linkReferences.set(tag, {
        tag,
        url,
        line: lineNumber,
        raw: line
      });
      continue;
    }

    // Markdown heading match
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();

      headings.push({
        level,
        text: headingText,
        line: lineNumber,
        raw: line
      });

      if (level === 1) {
        if (!title) {
          title = {
            text: headingText,
            line: lineNumber,
            raw: line
          };
        }
        currentVersion = null;
        currentType = null;
      } else if (level === 2) {
        // Version heading, e.g. "## [Unreleased]" or "## [1.0.0] - 2026-10-22"
        const isBracketed = headingText.startsWith('[');
        let versionTag = '';
        let dateStr = null;
        let isYanked = false;

        // Check for [YANKED] suffix
        let cleanHeading = headingText;
        if (/\[YANKED\]\s*$/i.test(cleanHeading)) {
          isYanked = true;
          cleanHeading = cleanHeading.replace(/\[YANKED\]\s*$/i, '').trim();
        }

        // Bracketed format: [1.0.0] or [Unreleased]
        const bracketMatch = cleanHeading.match(/^\[([^\]]+)\](?:\s*-\s*(.+))?$/);
        const unbracketMatch = cleanHeading.match(/^([^\s-]+)(?:\s*-\s*(.+))?$/);

        if (bracketMatch) {
          versionTag = bracketMatch[1].trim();
          dateStr = bracketMatch[2] ? bracketMatch[2].trim() : null;
        } else if (unbracketMatch) {
          versionTag = unbracketMatch[1].trim();
          dateStr = unbracketMatch[2] ? unbracketMatch[2].trim() : null;
        } else {
          versionTag = headingText;
        }

        const isUnreleased = /^unreleased$/i.test(versionTag);

        currentVersion = {
          raw: line,
          headingText,
          line: lineNumber,
          isUnreleased,
          version: isUnreleased ? 'Unreleased' : versionTag,
          hasBrackets: isBracketed,
          date: dateStr,
          isYanked,
          types: [],
          bodyLines: [],
          items: []
        };
        versions.push(currentVersion);
        currentType = null;
      } else if (level === 3) {
        // Change type section, e.g. "### Added"
        currentType = {
          raw: line,
          line: lineNumber,
          type: headingText,
          items: []
        };

        if (currentVersion) {
          currentVersion.types.push(currentType);
        }
      } else {
        // H4, H5, H6
        currentType = null;
      }
      continue;
    }

    // Content lines (list items, paragraphs)
    if (currentType) {
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
        const itemText = trimmed.replace(/^[-*+]\s+/, '');
        currentType.items.push({
          line: lineNumber,
          text: itemText,
          raw: line
        });
      } else if (trimmed.length > 0) {
        // Continuation line or non-list text inside change type
        currentType.items.push({
          line: lineNumber,
          text: trimmed,
          raw: line
        });
      }
    } else if (currentVersion) {
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
        const itemText = trimmed.replace(/^[-*+]\s+/, '');
        currentVersion.items.push({
          line: lineNumber,
          text: itemText,
          raw: line
        });
      } else if (trimmed.length > 0) {
        currentVersion.bodyLines.push({
          line: lineNumber,
          text: trimmed,
          raw: line
        });
      }
    }
  }

  return {
    raw: content,
    lines,
    title,
    headings,
    versions,
    linkReferences,
    errors
  };
}
