const pointInRing = (longitude, latitude, ring) => {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLng, currentLat] = ring[current];
    const [previousLng, previousLat] = ring[previous];
    const intersects = ((currentLat > latitude) !== (previousLat > latitude))
      && (longitude < ((previousLng - currentLng) * (latitude - currentLat)) / (previousLat - currentLat) + currentLng);
    if (intersects) inside = !inside;
  }
  return inside;
};

const pointInPolygon = (longitude, latitude, polygon) => {
  if (!polygon || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates?.[0])) return false;
  if (!pointInRing(longitude, latitude, polygon.coordinates[0])) return false;
  return polygon.coordinates.slice(1).every((hole) => !pointInRing(longitude, latitude, hole));
};

const orientation = (first, second, third) => {
  const value = (second[1] - first[1]) * (third[0] - second[0])
    - (second[0] - first[0]) * (third[1] - second[1]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : 2;
};

const pointOnSegment = (point, start, end) => (
  point[0] <= Math.max(start[0], end[0]) + 1e-12
  && point[0] >= Math.min(start[0], end[0]) - 1e-12
  && point[1] <= Math.max(start[1], end[1]) + 1e-12
  && point[1] >= Math.min(start[1], end[1]) - 1e-12
);

const segmentsProperlyIntersect = (firstStart, firstEnd, secondStart, secondEnd) => {
  const o1 = orientation(firstStart, firstEnd, secondStart);
  const o2 = orientation(firstStart, firstEnd, secondEnd);
  const o3 = orientation(secondStart, secondEnd, firstStart);
  const o4 = orientation(secondStart, secondEnd, firstEnd);
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
};

const pointOnRingBoundary = (point, ring) => ring.slice(0, -1).some((start, index) => (
  orientation(start, ring[index + 1], point) === 0 && pointOnSegment(point, start, ring[index + 1])
));

const pointStrictlyInPolygon = (point, polygon) => (
  pointInPolygon(point[0], point[1], polygon)
  && !pointOnRingBoundary(point, polygon.coordinates[0])
);

const ringCenter = (ring) => {
  const vertices = ring.slice(0, -1);
  return vertices.reduce(
    (center, point) => [center[0] + point[0] / vertices.length, center[1] + point[1] / vertices.length],
    [0, 0]
  );
};

const polygonsOverlap = (firstPolygon, secondPolygon) => {
  const firstRing = firstPolygon?.coordinates?.[0];
  const secondRing = secondPolygon?.coordinates?.[0];
  if (!Array.isArray(firstRing) || !Array.isArray(secondRing)) return false;

  for (let firstIndex = 0; firstIndex < firstRing.length - 1; firstIndex += 1) {
    for (let secondIndex = 0; secondIndex < secondRing.length - 1; secondIndex += 1) {
      if (segmentsProperlyIntersect(
        firstRing[firstIndex],
        firstRing[firstIndex + 1],
        secondRing[secondIndex],
        secondRing[secondIndex + 1]
      )) return true;
    }
  }

  return firstRing.slice(0, -1).some((point) => pointStrictlyInPolygon(point, secondPolygon))
    || secondRing.slice(0, -1).some((point) => pointStrictlyInPolygon(point, firstPolygon))
    || pointStrictlyInPolygon(ringCenter(firstRing), secondPolygon)
    || pointStrictlyInPolygon(ringCenter(secondRing), firstPolygon);
};

module.exports = { pointInPolygon, polygonsOverlap };
