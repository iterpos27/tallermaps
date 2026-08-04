const test = require('node:test');
const assert = require('node:assert/strict');
const {
  distanceInMeters,
  nearestPointWithinGeofence
} = require('../src/controllers/entregaController');

test('calcula distancias geograficas en metros', () => {
  assert.equal(Math.round(distanceInMeters(-0.1807, -78.4678, -0.1807, -78.4678)), 0);
  const distance = distanceInMeters(-0.1807, -78.4678, -0.1816, -78.4678);
  assert.ok(distance > 95 && distance < 105);
});

test('elige el punto mas cercano que contiene la posicion', () => {
  const position = { latitud: -0.1807, longitud: -78.4678 };
  const points = [
    { id: 1, nombre: 'Lejano', latitud: -0.19, longitud: -78.4678, radio_geocerca_metros: 100 },
    { id: 2, nombre: 'Taller B', latitud: -0.1808, longitud: -78.4678, radio_geocerca_metros: 80 },
    { id: 3, nombre: 'Taller C', latitud: -0.181, longitud: -78.4678, radio_geocerca_metros: 80 }
  ];

  const selected = nearestPointWithinGeofence(points, position);
  assert.equal(selected.id, 2);
  assert.ok(selected.distance < 20);
});

test('rechaza puntos fuera de todas las geocercas', () => {
  const selected = nearestPointWithinGeofence([
    { id: 1, latitud: -0.19, longitud: -78.46, radio_geocerca_metros: 50 }
  ], { latitud: -0.1807, longitud: -78.4678 });
  assert.equal(selected, null);
});
