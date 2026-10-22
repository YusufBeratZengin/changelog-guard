import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as semver from '../src/semver.js';

describe('semver', () => {
  test('isValid correctly identifies valid and invalid versions', () => {
    assert.equal(semver.isValid('1.0.0'), true);
    assert.equal(semver.isValid('0.1.0'), true);
    assert.equal(semver.isValid('v2.4.1'), true);
    assert.equal(semver.isValid('1.0.0-alpha.1'), true);
    assert.equal(semver.isValid('1.0.0-beta+exp.sha.5114f85'), true);

    assert.equal(semver.isValid('1.0'), false);
    assert.equal(semver.isValid('1'), false);
    assert.equal(semver.isValid('v1.0'), false);
    assert.equal(semver.isValid('alpha'), false);
    assert.equal(semver.isValid('01.0.0'), false); // leading zero invalid in semver
    assert.equal(semver.isValid(''), false);
    assert.equal(semver.isValid(null), false);
  });

  test('parse decomposes semver components', () => {
    const parsed = semver.parse('v1.2.3-alpha.4+build.42');
    assert.deepEqual(parsed, {
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ['alpha', '4'],
      build: ['build', '42'],
      raw: 'v1.2.3-alpha.4+build.42'
    });
  });

  test('compare handles standard semver comparisons', () => {
    assert.equal(semver.compare('1.0.0', '0.9.9'), 1);
    assert.equal(semver.compare('0.9.9', '1.0.0'), -1);
    assert.equal(semver.compare('1.0.0', '1.0.0'), 0);
    assert.equal(semver.compare('1.2.0', '1.1.9'), 1);
    assert.equal(semver.compare('1.1.1', '1.1.2'), -1);
  });

  test('compare handles pre-release precedence', () => {
    // 1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0
    assert.equal(semver.compare('1.0.0', '1.0.0-alpha'), 1);
    assert.equal(semver.compare('1.0.0-alpha', '1.0.0-alpha.1'), -1);
    assert.equal(semver.compare('1.0.0-alpha.1', '1.0.0-alpha.beta'), -1);
    assert.equal(semver.compare('1.0.0-alpha.beta', '1.0.0-beta'), -1);
    assert.equal(semver.compare('1.0.0-beta.2', '1.0.0-beta.11'), -1); // numeric comparison: 2 < 11
    assert.equal(semver.compare('1.0.0-beta.11', '1.0.0-rc.1'), -1);
    assert.equal(semver.compare('1.0.0-rc.1', '1.0.0'), -1);
  });

  test('gt, lt, eq helpers', () => {
    assert.equal(semver.gt('2.0.0', '1.9.9'), true);
    assert.equal(semver.lt('1.0.0', '1.0.1'), true);
    assert.equal(semver.eq('1.0.0', 'v1.0.0'), true);
  });
});
