import React, { useEffect, useRef } from 'react';
import { TileLayer } from 'react-leaflet';

const LAYERS = {
  street: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
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
