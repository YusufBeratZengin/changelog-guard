import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isMatch, filterFiles, normalizePath, expandBraces } from '../src/glob.js';

describe('glob', () => {
  test('normalizePath converts Windows slashes and removes leading ./', () => {
    assert.equal(normalizePath('src\\index.js'), 'src/index.js');
    assert.equal(normalizePath('./lib/util.js'), 'lib/util.js');
  });

  test('expandBraces handles comma options', () => {
    assert.deepEqual(expandBraces('{src,lib}/**'), ['src/**', 'lib/**']);
    assert.deepEqual(expandBraces('foo.{js,ts}'), ['foo.js', 'foo.ts']);
    assert.deepEqual(expandBraces('plain/path.js'), ['plain/path.js']);
  });

  test('isMatch handles wildcards and recursive **', () => {
    assert.equal(isMatch('src/index.js', 'src/**'), true);
    assert.equal(isMatch('src/components/Button.js', 'src/**'), true);
    assert.equal(isMatch('lib/index.js', 'src/**'), false);
    assert.equal(isMatch('README.md', '*.md'), true);
    assert.equal(isMatch('docs/README.md', '*.md'), false);
    assert.equal(isMatch('docs/README.md', '**/*.md'), true);
    assert.equal(isMatch('src/foo.test.js', '**/*.test.*'), true);
  });

  test('filterFiles applies inclusions and exclusions', () => {
    const files = [
      'src/index.js',
      'src/index.test.js',
      'lib/helper.js',
      'docs/guide.md',
      'package.json'
    ];

    const result = filterFiles(files, ['src/**', 'lib/**'], ['**/*.test.*']);
    assert.deepEqual(result, ['src/index.js', 'lib/helper.js']);
  });
});
