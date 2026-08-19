const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeEmail,
  isValidEmail,
  isValidLatitude,
  isValidLongitude,
  isValidObservation,
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

test('exige contraseñas de al menos seis caracteres con letras y números', () => {
  assert.match(validatePassword('abc1'), /6 caracteres/);
  assert.match(validatePassword('solamenteletras'), /letras y números/);
  assert.equal(validatePassword('Clave1'), '');
});

test('exige observaciones con al menos diez caracteres visibles', () => {
  assert.equal(isValidObservation(), false);
  assert.equal(isValidObservation('         '), false);
  assert.equal(isValidObservation('Visita OK'), false);
  assert.equal(isValidObservation('Se revisó el inventario.'), true);
});
