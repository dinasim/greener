// components/AzureMapView.js
import React from 'react';
import PropTypes from 'prop-types';

import CrossPlatformAzureMapView from './CrossPlatformAzureMapView';

/**
 * AzureMapView — thin wrapper that delegates to the fully-featured
 * CrossPlatformAzureMapView while preserving the original filename/API.
 *
 * Props are passed straight through; you may supply `azureMapsKey`
 * explicitly or rely on an env-driven fallback.
 */
const AzureMapView = ({
  products = [],
  onSelectProduct,
  initialRegion = { latitude: 32.0853, longitude: 34.7818, zoom: 10 },
  showControls = true,
  mapStyle = 'road',
  onMapReady,
  azureMapsKey, // optional — will fall back to env if undefined
}) => {
  // Pick up key from env if not provided
  const key = process.env.AZURE_MAPS_MARKETPLACE_KEY 
    '';

  return (
    <CrossPlatformAzureMapView
      products={products}
      onSelectProduct={onSelectProduct}
      initialRegion={initialRegion}
      showControls={showControls}
      mapStyle={mapStyle}
      onMapReady={onMapReady}
      azureMapsKey={key}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Prop-types for quick dev safety                                    */
/* ------------------------------------------------------------------ */
AzureMapView.propTypes = {
  products: PropTypes.arrayOf(PropTypes.object),
  onSelectProduct: PropTypes.func,
  initialRegion: PropTypes.shape({
    latitude: PropTypes.number,
    longitude: PropTypes.number,
    zoom: PropTypes.number,
  }),
  showControls: PropTypes.bool,
  mapStyle: PropTypes.string,
  onMapReady: PropTypes.func,
  azureMapsKey: PropTypes.string,
};

export default AzureMapView;
