const distanceMeters = (firstLatitude, firstLongitude, secondLatitude, secondLongitude) => {
  const earthRadius = 6371000;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(secondLatitude - firstLatitude);
  const longitudeDelta = toRadians(secondLongitude - firstLongitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(firstLatitude)) * Math.cos(toRadians(secondLatitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const optimizeStops = (origin, stops) => {
  const remaining = [...stops];
  const ordered = [];
  let currentLatitude = Number(origin.latitude);
  let currentLongitude = Number(origin.longitude);

  while (remaining.length > 0) {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((item, index) => {
      const distance = distanceMeters(
        currentLatitude,
        currentLongitude,
        Number(item.latitud),
        Number(item.longitud)
      );
      if (distance < closestDistance) {
        closestIndex = index;
        closestDistance = distance;
      }
    });
    const [closest] = remaining.splice(closestIndex, 1);
    ordered.push({ ...closest, distancia_desde_anterior_metros: Math.round(closestDistance) });
    currentLatitude = Number(closest.latitud);
    currentLongitude = Number(closest.longitud);
  }

  return ordered;
};

module.exports = { distanceMeters, optimizeStops };
