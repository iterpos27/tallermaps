const test = require('node:test');
const assert = require('node:assert/strict');
const { distanceMeters, optimizeStops } = require('../src/utils/routeOptimization');

test('calcula distancia y ordena paradas por el vecino más cercano', () => {
  assert.ok(distanceMeters(-1.05, -80.45, -1.05, -80.44) > 1000);
  const ordered = optimizeStops(
    { latitude: 0, longitude: 0 },
    [
      { id: 3, latitud: 0, longitud: 0.03 },
      { id: 1, latitud: 0, longitud: 0.01 },
      { id: 2, latitud: 0, longitud: 0.02 }
    ]
  );
  assert.deepEqual(ordered.map((stop) => stop.id), [1, 2, 3]);
  assert.ok(ordered.every((stop) => stop.distancia_desde_anterior_metros > 1000));
});
