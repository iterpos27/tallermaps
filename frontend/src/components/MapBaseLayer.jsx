import React, { useEffect, useRef } from 'react';
import { TileLayer } from 'react-leaflet';

const LAYERS = {
  street: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  },
  satellite: {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  }
};

export default function MapBaseLayer({ layer, onUnavailable }) {
  const failedTiles = useRef(0);
  const selectedLayer = LAYERS[layer] || LAYERS.street;

  useEffect(() => {
    failedTiles.current = 0;
  }, [layer]);

  return (
    <TileLayer
      key={layer}
      attribution={selectedLayer.attribution}
      url={selectedLayer.url}
      referrerPolicy="strict-origin-when-cross-origin"
      eventHandlers={{
        tileload: () => { failedTiles.current = 0; },
        tileerror: () => {
          failedTiles.current += 1;
          if (failedTiles.current === 4) onUnavailable(layer);
        }
      }}
    />
  );
}
