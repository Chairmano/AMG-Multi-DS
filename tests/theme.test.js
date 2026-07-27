const test = require('node:test');
const assert = require('node:assert/strict');
const { getInitialTheme, normalizeTheme } = require('../assets/js/theme.js');

test('normalizeTheme returns a valid theme value', () => {
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('DARK'), 'dark');
  assert.equal(normalizeTheme('unknown'), 'dark');
});

test('getInitialTheme prefers saved values and falls back to system preference', () => {
  assert.equal(getInitialTheme('light', 'dark'), 'light');
  assert.equal(getInitialTheme('dark', 'light'), 'dark');
  assert.equal(getInitialTheme(null, 'dark'), 'dark');
  assert.equal(getInitialTheme('', 'light'), 'light');
});
