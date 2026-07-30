const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeEmail,
  isValidEmail,
  isValidLatitude,
  isValidLongitude,
  validatePassword
} = require('../src/utils/validation');

test('normaliza y valida correos', () => {
  assert.equal(normalizeEmail(' Admin@Example.COM '), 'admin@example.com');
  assert.equal(isValidEmail('vendedor@example.com'), true);
  assert.equal(isValidEmail('correo-invalido'), false);
});

test('valida los límites geográficos', () => {
  assert.equal(isValidLatitude(-90), true);
  assert.equal(isValidLatitude(90.1), false);
  assert.equal(isValidLongitude(-180), true);
  assert.equal(isValidLongitude(181), false);
});

test('exige contraseñas de al menos diez caracteres con letras y números', () => {
  assert.match(validatePassword('corta1'), /10 caracteres/);
  assert.match(validatePassword('solamenteletras'), /letras y números/);
  assert.equal(validatePassword('Segura2026'), '');
});
