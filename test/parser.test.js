import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChangelog } from '../src/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('parser', () => {
  test('parses Keep a Changelog 1.1 document properly', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/valid-changelog.md');
    const content = fs.readFileSync(fixturePath, 'utf8');

    const ast = parseChangelog(content);

    assert.equal(ast.title.text, 'Changelog');
    assert.equal(ast.versions.length, 3);

    // Unreleased version
    const unreleased = ast.versions[0];
    assert.equal(unreleased.isUnreleased, true);
    assert.equal(unreleased.version, 'Unreleased');
    assert.equal(unreleased.types.length, 2);
    assert.equal(unreleased.types[0].type, 'Added');
    assert.equal(unreleased.types[0].items.length, 1);
    assert.equal(unreleased.types[0].items[0].text, 'New lint rule for checking duplicate versions.');
    assert.equal(unreleased.types[1].type, 'Fixed');

    // 1.0.0 version
    const v1 = ast.versions[1];
    assert.equal(v1.isUnreleased, false);
    assert.equal(v1.version, '1.0.0');
    assert.equal(v1.date, '2026-10-22');
    assert.equal(v1.hasBrackets, true);
    assert.equal(v1.types.length, 2);

    // Link references
    assert.equal(ast.linkReferences.has('Unreleased'), true);
    assert.equal(ast.linkReferences.has('1.0.0'), true);
    assert.equal(ast.linkReferences.has('0.1.0'), true);
  });

  test('ignores markdown headings inside code blocks', () => {
    const markdown = `# Changelog

## [Unreleased]

### Added
\`\`\`markdown
# Not a real heading
## Not a version
\`\`\`
- Real item.

[Unreleased]: https://example.com
`;
    const ast = parseChangelog(markdown);
    assert.equal(ast.versions.length, 1);
    assert.equal(ast.versions[0].types.length, 1);
    assert.equal(ast.versions[0].types[0].items.length, 1);
  });
});
