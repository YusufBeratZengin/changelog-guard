import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseChangelog } from '../src/parser.js';
import { lintChangelog } from '../src/linter.js';
import { checkPullRequest, checkUnreleasedChanges, getGitHubEventLabels } from '../src/check-pr.js';
import { hasSkipTrailer } from '../src/git.js';
import { executeRelease } from '../src/release.js';
import { formatJson } from '../src/formatters/json.js';
import { formatStylish } from '../src/formatters/stylish.js';
import { clean, compare, parse } from '../src/semver.js';
import { expandBraces, filterFiles, isMatch } from '../src/glob.js';

const minimal = '# Changelog\n\n## [Unreleased]\n\n### Added\n- A change.\n';

describe('validation edge cases', () => {
  test('calendar validation distinguishes leap days, overflows, and missing dates', () => {
    for (const [date, valid] of [
      ['2024-02-29', true], ['2026-02-29', false], ['2026-04-31', false],
      ['2026-13-01', false], ['2026-01-00', false], ['2026-01-32', false], ['', false]
    ]) {
      const content = `${minimal}\n## [1.0.0]${date ? ` - ${date}` : ''}\n- First release.\n`;
      const result = lintChangelog(content, { checkLinkReferences: false });
      assert.equal(result.valid, valid, date || 'missing date');
      assert.equal(result.diagnostics.filter(d => d.rule === 'non-iso-date').length, valid ? 0 : 1);
    }
  });

  test('heading structure rejects missing titles, duplicate titles, and orphan types', () => {
    for (const content of ['', '## Unreleased\n- Change.\n', '# Changelog\n### Added\n- Change.\n',
      '# Changelog\n# Another title\n## Unreleased\n- Change.\n']) {
      const result = lintChangelog(content, { checkLinkReferences: false });
      assert.equal(result.valid, false);
      assert.ok(result.diagnostics.some(d => d.rule === 'heading-structure'));
    }
  });

  test('empty-unreleased permission does not allow empty change-type headings', () => {
    assert.equal(lintChangelog('# Changelog\n## Unreleased\n', {
      allowEmptyUnreleased: true
    }).valid, true);
    const result = lintChangelog('# Changelog\n## Unreleased\n### Added\n', {
      allowEmptyUnreleased: true
    });
    assert.equal(result.valid, false);
    assert.match(result.diagnostics[0].message, /has no items/);
  });

  test('duplicate Unreleased, duplicate types, and misplaced Unreleased are reported', () => {
    const duplicate = lintChangelog(`${minimal}\n${minimal.replace('# Changelog\n', '')}`, {
      checkLinkReferences: false
    });
    assert.ok(duplicate.diagnostics.some(d => d.rule === 'duplicate-version'));
    const types = lintChangelog(`${minimal}\n### Added\n- Another change.\n`, { checkLinkReferences: false });
    assert.ok(types.diagnostics.some(d => /Duplicate change type/.test(d.message)));
    const misplaced = lintChangelog(`# Changelog\n## 1.0.0 - 2026-10-23\n- Released.\n## Unreleased\n- Next.\n`);
    assert.ok(misplaced.diagnostics.some(d => /first version entry/.test(d.message)));
  });

  test('case-insensitive references resolve and orphan warnings do not invalidate a file', () => {
    const content = `${minimal}\n[unreleased]: https://example.com/compare/v0.1.0...HEAD\n[unused]: https://example.com\n`;
    const result = lintChangelog(parseChangelog(content), { checkOrphanLinks: true });
    assert.equal(result.valid, true);
    assert.deepEqual(result.diagnostics.map(d => [d.rule, d.severity]), [['orphan-link-reference', 'warning']]);
    const json = JSON.parse(formatJson('CHANGELOG.md', result.diagnostics));
    assert.equal(json.valid, true);
    assert.equal(json.errorCount, 0);
    assert.equal(json.warningCount, 1);
  });

  test('parser handles yanked versions, prose, loose items, and deep headings outside fences', () => {
    const content = '# Changelog\n## Unreleased\nRelease prose.\n+ Loose item.\n### Added\nContinuation text.\n* Typed item.\n#### Detail\nMore prose.\n~~~md\n## Not a version\n~~~\n## [1.0.0] - 2026-10-23 [YANKED]\n- Withdrawn.\n';
    const ast = parseChangelog(content);
    assert.equal(ast.versions.length, 2);
    assert.deepEqual(ast.versions[0].bodyLines.map(l => l.text), ['Release prose.', 'More prose.']);
    assert.deepEqual(ast.versions[0].items.map(i => i.text), ['Loose item.']);
    assert.deepEqual(ast.versions[0].types[0].items.map(i => i.text), ['Continuation text.', 'Typed item.']);
    assert.equal(ast.versions[1].isYanked, true);
    assert.equal(ast.versions[1].version, '1.0.0');
    assert.ok(lintChangelog(ast).diagnostics.some(d => /Unexpected level 4/.test(d.message)));
  });
});

describe('pull request policy edge cases', () => {
  test('missing and empty Unreleased sections cannot satisfy the gate', () => {
    assert.deepEqual(checkUnreleasedChanges(minimal, '# Changelog\n'), { changed: false, addedItems: [] });
    assert.deepEqual(checkUnreleasedChanges(minimal, '# Changelog\n## Unreleased\n'), { changed: false, addedItems: [] });
    assert.deepEqual(checkUnreleasedChanges('', minimal), { changed: true, addedItems: ['A change.'] });
    assert.equal(checkUnreleasedChanges('# Changelog\n', minimal).changed, true);
  });

  test('deletions and whitespace do not count as new entries; loose items and prose do', () => {
    assert.equal(checkUnreleasedChanges(`${minimal}- Second.\n`, minimal).changed, false);
    assert.equal(checkUnreleasedChanges(minimal, minimal.replace('A change.', '  A change.  ')).changed, false);
    const loose = '# Changelog\n## Unreleased\n- Original.\n';
    assert.deepEqual(checkUnreleasedChanges(loose, `${loose}- New.\n`).addedItems, ['New.']);
    const prose = '# Changelog\n## Unreleased\nRelease overview.\n';
    assert.deepEqual(checkUnreleasedChanges(prose, prose.replace('overview', 'details')), { changed: true, addedItems: [] });
  });

  test('skip indicators are explicit, case insensitive, and support a custom trailer', () => {
    assert.equal(hasSkipTrailer(['fix: do not skip']).skipped, false);
    assert.equal(hasSkipTrailer(['fix: text Changelog: skip in a sentence']).skipped, false);
    assert.equal(hasSkipTrailer(['refactor\n\nCHANGELOG: SKIP']).skipped, true);
    assert.equal(hasSkipTrailer(['refactor [changelog skip]']).skipped, true);
    assert.equal(hasSkipTrailer(['refactor [no changelog]']).skipped, true);
    assert.equal(hasSkipTrailer(['internal\n\nNotes: omit'], 'Notes', 'omit').skipped, true);
  });

  test('base is required even when a skip label is supplied', async () => {
    await assert.rejects(checkPullRequest({ labels: ['no-changelog'] }), /Missing required option/);
    const result = await checkPullRequest({ base: 'main', labels: ['DOCUMENTATION'], skipLabels: ['documentation'] });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  });

  test('GitHub event labels tolerate missing, malformed, and incomplete payloads', t => {
    const previous = process.env.GITHUB_EVENT_PATH;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-event-'));
    const eventPath = path.join(directory, 'event.json');
    t.after(() => {
      if (previous === undefined) delete process.env.GITHUB_EVENT_PATH;
      else process.env.GITHUB_EVENT_PATH = previous;
      fs.rmSync(directory, { recursive: true, force: true });
    });
    delete process.env.GITHUB_EVENT_PATH;
    assert.deepEqual(getGitHubEventLabels(), []);
    process.env.GITHUB_EVENT_PATH = eventPath;
    assert.deepEqual(getGitHubEventLabels(), []);
    for (const payload of ['{', '{}', '{"pull_request":{"labels":null}}']) {
      fs.writeFileSync(eventPath, payload);
      assert.deepEqual(getGitHubEventLabels(), []);
    }
    fs.writeFileSync(eventPath, JSON.stringify({ pull_request: { labels: ['chore', { name: 'dependencies' }] } }));
    assert.deepEqual(getGitHubEventLabels(), ['chore', 'dependencies']);
  });
});

describe('release and output edge cases', () => {
  test('first release derives tag and comparison links from a generic repository URL', () => {
    const content = `${minimal}\n[unreleased]: https://example.com/project/tree/HEAD\n`;
    const result = executeRelease(content, 'v0.1.0', { date: '2026-10-23' });
    assert.equal(result.previousVersion, null);
    assert.equal(result.releaseVersion, '0.1.0');
    assert.match(result.content, /\[Unreleased\]: https:\/\/example.com\/project\/compare\/v0.1.0\.\.\.HEAD/);
    assert.match(result.content, /\[0.1.0\]: https:\/\/example.com\/project\/releases\/tag\/v0.1.0/);
    assert.equal(lintChangelog(result.content, { allowEmptyUnreleased: true }).valid, true);
  });

  test('first release from a compare URL retains the existing tag prefix', () => {
    for (const prefix of ['', 'v']) {
      const result = executeRelease(`${minimal}\n[Unreleased]: https://example.com/project/compare/${prefix}0.0.0...HEAD\n`, '0.1.0', { date: '2026-10-23' });
      assert.ok(result.content.includes(`[0.1.0]: https://example.com/project/releases/tag/${prefix}0.1.0`));
    }
  });

  test('release rejects malformed versions, date shapes, and absent Unreleased sections', () => {
    assert.throws(() => executeRelease(minimal, '1.0'), /Invalid version/);
    assert.throws(() => executeRelease(minimal, '1.0.0', { date: '23-10-2026' }), /Invalid date/);
    assert.throws(() => executeRelease('# Changelog\n', '1.0.0'), /no ## \[Unreleased\]/);
  });

  test('stylish and JSON preserve error counts, warning counts, and source positions', () => {
    const diagnostics = [
      { rule: 'non-iso-date', message: 'Invalid date.', line: 8, column: 1, severity: 'error' },
      { rule: 'orphan-link-reference', message: 'Unused link.', line: 123, column: 10, severity: 'warning' }
    ];
    const stylish = formatStylish('CHANGELOG.md', diagnostics);
    assert.match(stylish, /8:1/);
    assert.match(stylish, /123:10/);
    assert.match(stylish, /2 problems \(1 error, 1 warning\)/);
    assert.match(formatStylish('CHANGELOG.md', [diagnostics[1], diagnostics[1]]), /2 warnings/);
    assert.match(formatStylish('CHANGELOG.md', [diagnostics[0], diagnostics[0]]), /2 errors/);
    const json = JSON.parse(formatJson('CHANGELOG.md', diagnostics));
    assert.deepEqual(json, { file: 'CHANGELOG.md', valid: false, errorCount: 1, warningCount: 1, diagnostics });
  });

  test('SemVer cleanup preserves metadata while precedence ignores it', () => {
    assert.equal(clean(' v1.2.3-alpha.1+build.5 '), '1.2.3-alpha.1+build.5');
    assert.equal(clean('v2.0.0'), '2.0.0');
    assert.equal(clean('invalid'), null);
    assert.equal(parse(null), null);
    assert.throws(() => compare('invalid', '1.0.0'), /Invalid semver comparison/);
    assert.equal(compare('1.0.0-alpha.2', '1.0.0-alpha.2+build'), 0);
    assert.equal(compare('1.0.0-alpha.2', '1.0.0-alpha.1'), 1);
    assert.equal(compare('1.0.0-alpha.beta', '1.0.0-alpha.1'), 1);
    assert.equal(compare('1.0.0-alpha.1', '1.0.0-alpha'), 1);
  });

  test('globs escape literal punctuation and apply string include and ignore lists', () => {
    assert.equal(isMatch('src/a.js', 'src/?.js'), true);
    assert.equal(isMatch('src/ab.js', 'src/?.js'), false);
    assert.equal(isMatch('src/a.js', '!src/*.js'), false);
    assert.equal(isMatch('src/a.js', ' '), false);
    assert.equal(isMatch('src/a[1].js', 'src/a[1].js'), true);
    assert.equal(isMatch('src/a1.js', 'src/a[1].js'), false);
    assert.deepEqual(expandBraces('{src,lib}/*.{js,mjs}'), ['src/*.js', 'src/*.mjs', 'lib/*.js', 'lib/*.mjs']);
    assert.deepEqual(filterFiles(['src/a.js', 'src/a.test.js', 'lib/b.js', 'docs/a.md'], 'src/**,lib/**,', '**/*.test.js,'), ['src/a.js', 'lib/b.js']);
  });
});
