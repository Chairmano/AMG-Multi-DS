const test = require('node:test');
const assert = require('node:assert/strict');
const { createDemoUser, getStorageKey } = require('../assets/js/auth.js');

test('createDemoUser builds a user object with normalized values', () => {
  const user = createDemoUser({
    email: '  User@Example.com  ',
    displayName: '  Ada Lovelace  ',
    phone: '0201234567',
    password: 'secure123'
  });

  assert.equal(user.email, 'user@example.com');
  assert.equal(user.displayName, 'Ada Lovelace');
  assert.equal(user.phone, '0201234567');
  assert.equal(user.provider, 'demo');
  assert.ok(user.uid);
});

test('getStorageKey returns the demo auth storage key', () => {
  assert.equal(getStorageKey(), 'amg-demo-auth-user');
});
