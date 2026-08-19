const test = require('node:test');
const assert = require('node:assert/strict');
const { pointInPolygon, polygonsOverlap } = require('../src/utils/geojson');

const polygon = {
  type: 'Polygon',
  coordinates: [[[-80, -3], [-78, -3], [-78, -1], [-80, -1], [-80, -3]]]
};

test('detecta puntos dentro y fuera de un sector GeoJSON', () => {
  assert.equal(pointInPolygon(-79, -2, polygon), true);
  assert.equal(pointInPolygon(-77, -2, polygon), false);
});

test('detecta sectores superpuestos, contenidos y separados', () => {
  const overlapping = {
    type: 'Polygon',
    coordinates: [[[-79, -2.5], [-77, -2.5], [-77, -0.5], [-79, -0.5], [-79, -2.5]]]
  };
  const contained = {
    type: 'Polygon',
    coordinates: [[[-79.5, -2.5], [-78.5, -2.5], [-78.5, -1.5], [-79.5, -1.5], [-79.5, -2.5]]]
  };
  const separated = {
    type: 'Polygon',
    coordinates: [[[-76, -2], [-75, -2], [-75, -1], [-76, -1], [-76, -2]]]
  };
  const touching = {
    type: 'Polygon',
    coordinates: [[[-78, -3], [-77, -3], [-77, -1], [-78, -1], [-78, -3]]]
  };

  assert.equal(polygonsOverlap(polygon, overlapping), true);
  assert.equal(polygonsOverlap(polygon, contained), true);
  assert.equal(polygonsOverlap(polygon, separated), false);
  assert.equal(polygonsOverlap(polygon, touching), false);
});
