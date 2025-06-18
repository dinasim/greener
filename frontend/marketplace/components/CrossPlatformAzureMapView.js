// FIXED CrossPlatformAzureMapView - Proper Azure Maps Loading + Key Handling
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Platform, View, StyleSheet, Text, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';

const CrossPlatformAzureMapView = forwardRef(({
  region,
  onRegionChange,
  markers = [],
  onMarkerPress,
  style,
  mapType = 'road',
  showUserLocation = false,
  onMapReady,
  onLocationSelect,
  interactive = true,
  accessibilityLabel = "Interactive map",
  azureMapsKey, // Receive key as prop
  // NEW: Accept products and businesses to generate markers
  products = [],
  businesses = [],
  myLocation = null,
  showMyLocation = false,
  mapMode = 'plants',
  onSelectProduct,
  onSelectBusiness,
  initialRegion,
  onMapPress
}, ref) => {
  const iframeRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapKey, setMapKey] = useState(azureMapsKey);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState((initialRegion || region || { zoom: 10 }).zoom || 10);

  // FIXED: Use provided key or load from service
  useEffect(() => {
    const loadMapKey = async () => {
      if (azureMapsKey) {
        console.log('✅ Using provided Azure Maps key');
        setMapKey(azureMapsKey);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        console.log('🔑 Loading Azure Maps key...');
        
        // Import the service dynamically to avoid circular imports
        const { getAzureMapsKey } = await import('../services/azureMapsService');
        const key = await getAzureMapsKey();
        
        setMapKey(key);
        setError(null);
        console.log('✅ Azure Maps key loaded for map component');
      } catch (error) {
        console.error('❌ Failed to load Azure Maps key:', error);
        setError(`Failed to load map: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadMapKey();
  }, [azureMapsKey]);

  // Generate markers from products, businesses, and user location
  const generateMarkers = useCallback(() => {
    const generatedMarkers = [];

    // Add user location marker if available
    if (showMyLocation && myLocation?.latitude && myLocation?.longitude) {
      generatedMarkers.push({
        id: 'current',
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        title: 'Your Location',
        description: 'You are here',
        type: 'user'
      });
    }

    // Add product markers
    if (mapMode === 'plants' && products?.length > 0) {
      products.forEach(product => {
        if (product.location?.latitude && product.location?.longitude) {
          generatedMarkers.push({
            id: `product-${product.id || product._id}`,
            latitude: product.location.latitude,
            longitude: product.location.longitude,
            title: product.title || product.name || 'Product',
            description: `$${parseFloat(product.price || 0).toFixed(2)}`,
            type: 'product'
          });
        }
      });
    }

    // Add business markers
    if (mapMode === 'businesses' && businesses?.length > 0) {
      businesses.forEach(business => {
        const lat = business.location?.latitude || business.address?.latitude;
        const lng = business.location?.longitude || business.address?.longitude;
        
        if (lat && lng) {
          generatedMarkers.push({
            id: `business-${business.id || business._id}`,
            latitude: lat,
            longitude: lng,
            title: business.businessName || business.name || 'Business',
            description: business.description || 'Business location',
            type: 'business'
          });
        }
      });
    }

    // Add any additional markers passed as props
    if (markers?.length > 0) {
      markers.forEach(marker => {
        generatedMarkers.push({
          ...marker,
          type: marker.type || 'custom'
        });
      });
    }

    return generatedMarkers;
  }, [products, businesses, myLocation, showMyLocation, mapMode, markers]);

  // Get current markers and region
  const currentMarkers = generateMarkers();
  const mapRegion = initialRegion || region || {
    latitude: 32.0853,
    longitude: 34.7818,
    zoom: 10
  };

  // Zoom handlers
  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 1, 20);
    setZoom(newZoom);
    sendMessageToMap({ type: 'SET_REGION', region: { ...mapRegion, zoom: newZoom } });
  };
  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 1, 1);
    setZoom(newZoom);
    sendMessageToMap({ type: 'SET_REGION', region: { ...mapRegion, zoom: newZoom } });
  };

  useImperativeHandle(ref, () => ({
    animateToRegion: (region, duration = 1000) => {
      if (mapReady && iframeRef.current) {
        sendMessageToMap({
          type: 'ANIMATE_TO_REGION',
          region,
          duration
        });
      }
    },
    addMarker: (marker) => {
      if (mapReady && iframeRef.current) {
        sendMessageToMap({
          type: 'ADD_MARKER',
          marker
        });
      }
    },
    removeMarker: (markerId) => {
      if (mapReady && iframeRef.current) {
        sendMessageToMap({
          type: 'REMOVE_MARKER',
          markerId
        });
      }
    }
  }));

  const sendMessageToMap = (message) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        const safeMessage = {
          ...message,
          timestamp: Date.now()
        };
        iframeRef.current.contentWindow.postMessage(safeMessage, '*');
      } catch (error) {
        console.error('Error sending message to map:', error);
      }
    }
  };

  // Handle marker press by finding the original data
  const handleMarkerPress = (markerData) => {
    if (markerData.type === 'product' && onSelectProduct) {
      onSelectProduct(markerData.id.replace('product-', ''));
    } else if (markerData.type === 'business' && onSelectBusiness) {
      onSelectBusiness(markerData.id.replace('business-', ''));
    } else if (onMarkerPress) {
      onMarkerPress(markerData);
    }
  };

  // Enhanced message handling for proper marker routing
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      
      try {
        const { type, data } = event.data;
        
        switch (type) {
          case 'MAP_READY':
            console.log('🗺️ Azure Maps ready');
            setMapReady(true);
            if (onMapReady) onMapReady();
            
            // Initialize map with current markers
            if (currentMarkers.length > 0) {
              sendMessageToMap({
                type: 'SET_MARKERS',
                markers: currentMarkers
              });
            }
            
            // Set initial region
            if (mapRegion) {
              sendMessageToMap({
                type: 'SET_REGION',
                region: mapRegion
              });
            }
            break;
            
          case 'REGION_CHANGED':
            if (onRegionChange && data) {
              onRegionChange(data);
            }
            break;
            
          case 'MARKER_PRESSED':
            if (data) {
              handleMarkerPress(data);
            }
            break;
            
          case 'LOCATION_SELECTED':
            if (onLocationSelect && data) {
              onLocationSelect(data);
            } else if (onMapPress && data) {
              onMapPress(data);
            }
            break;
            
          case 'MAP_ERROR':
            console.error('Azure Maps error:', data);
            setError(`Map error: ${data?.error || 'Unknown error'}`);
            break;
            
          default:
            console.log('Unknown map message:', type, data);
        }
      } catch (error) {
        console.error('Error handling map message:', error);
      }
    };

    if (Platform.OS === 'web') {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [currentMarkers, mapRegion, onMapReady, onRegionChange, onMarkerPress, onLocationSelect, onMapPress, onSelectProduct, onSelectBusiness]);

  // Update map when props change
  useEffect(() => {
    if (mapReady && (region || mapRegion)) {
      sendMessageToMap({
        type: 'SET_REGION',
        region: region || mapRegion
      });
    }
  }, [region, mapRegion, mapReady]);

  useEffect(() => {
    if (mapReady && currentMarkers) {
      sendMessageToMap({
        type: 'SET_MARKERS',
        markers: currentMarkers
      });
    }
  }, [currentMarkers, mapReady]);

  const onIframeLoad = () => {
    console.log('🌐 Azure Maps iframe loaded');
    // Map will send MAP_READY message when fully initialized
  };

  // Show loading while getting key
  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading Azure Maps...</Text>
        </View>
      </View>
    );
  }

  // Show error if key loading failed
  if (error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.fallback}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <Text style={styles.errorSubtext}>Please check your internet connection and try again.</Text>
        </View>
      </View>
    );
  }

  // Show fallback for non-web platforms
  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>🗺️ Interactive map available on web</Text>
          <Text style={styles.fallbackSubtext}>
            Coordinates: {region?.latitude?.toFixed(4)}, {region?.longitude?.toFixed(4)}
          </Text>
        </View>
      </View>
    );
  }

  // Don't render iframe without key
  if (!mapKey) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.fallback}>
          <Text style={styles.errorText}>⚠️ Azure Maps key not available</Text>
        </View>
      </View>
    );
  }

  // FIXED: Enhanced HTML with better Azure Maps initialization
  const mapHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Azure Maps</title>
  <script src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js"></script>
  <link rel="stylesheet" href="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.css" type="text/css">
  <style>
    html, body, #mapContainer {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .debug-info {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(255, 255, 255, 0.9);
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      display: none;
    }
    .map-marker {
      background: #4CAF50;
      border: 2px solid #fff;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      transition: transform 0.2s ease;
    }
    .map-marker:hover {
      transform: scale(1.2);
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .map-marker.user-location {
      background: #2196F3;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% {
        box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 0 0 rgba(66, 133, 244, 0.7);
        transform: scale(1);
      }
      50% {
        box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 0 8px rgba(66, 133, 244, 0.2);
        transform: scale(1.05);
      }
      100% {
        box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 0 0 rgba(66, 133, 244, 0);
        transform: scale(1);
      }
    }
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      flex-direction: column;
    }
    .loading-text {
      margin-top: 10px;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="mapContainer"></div>
  <div id="debug" class="debug-info"></div>
  <div id="loading" class="loading-overlay">
    <div style="border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
    <div class="loading-text">Loading Azure Maps...</div>
  </div>
  
  <style>
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
  
  <script>
    let map;
    let markers = [];
    let isReady = false;
    const loadingEl = document.getElementById('loading');
    
    function log(message) {
      console.log('AZURE MAPS:', message);
      const debug = document.getElementById('debug');
      if (debug) {
        debug.textContent = message;
      }
    }
    
    function hideLoading() {
      if (loadingEl) {
        loadingEl.style.display = 'none';
      }
    }
    
    function showError(message) {
      if (loadingEl) {
        loadingEl.innerHTML = '<div style="color: #f44336; text-align: center;"><div>⚠️ Error</div><div style="margin-top: 8px; font-size: 12px;">' + message + '</div></div>';
      }
    }
    
    function sendMessage(type, data = null) {
      try {
        const message = {
          type: type,
          data: data ? JSON.parse(JSON.stringify(data)) : null,
          timestamp: Date.now()
        };
        window.parent.postMessage(message, '*');
      } catch (error) {
        console.error('Error sending message:', error);
        window.parent.postMessage({
          type: 'MAP_ERROR',
          data: { error: error.message },
          timestamp: Date.now()
        }, '*');
      }
    }
    
    function initializeMap() {
      try {
        log('Initializing Azure Maps with key...');
        
        // Validate Azure Maps SDK
        if (typeof atlas === 'undefined') {
          throw new Error('Azure Maps SDK not loaded');
        }
        
        map = new atlas.Map('mapContainer', {
          center: [34.8516, 31.0461], // Default to Tel Aviv
          zoom: 10,
          language: 'en-US',
          authOptions: {
            authType: 'subscriptionKey',
            subscriptionKey: '${mapKey}'
          },
          style: '${mapType}',
          enableAccessibility: true,
          showLogo: false,
          showFeedbackLink: false
        });

        // FIXED: Comprehensive event handlers
        map.events.add('ready', function () {
          log('Map is ready and interactive');
          hideLoading();
          isReady = true;
          sendMessage('MAP_READY');
        });

        map.events.add('error', function (error) {
          console.error('Azure Maps error:', error);
          showError('Failed to load map');
          sendMessage('MAP_ERROR', { error: error.message || 'Map loading failed' });
        });

        // FIXED: Simplified event handlers to avoid circular JSON
        map.events.add('move', function () {
          if (isReady) {
            const center = map.getCamera().center;
            const zoom = map.getCamera().zoom;
            
            sendMessage('REGION_CHANGED', {
              latitude: center[1],
              longitude: center[0],
              zoom: zoom
            });
          }
        });

        map.events.add('click', function (e) {
          if (isReady && e.position) {
            log('Map clicked at: ' + e.position[1] + ', ' + e.position[0]);
            sendMessage('LOCATION_SELECTED', {
              latitude: e.position[1],
              longitude: e.position[0]
            });
          }
        });

        // Set loading timeout
        setTimeout(() => {
          if (!isReady) {
            showError('Map loading timeout');
            sendMessage('MAP_ERROR', { error: 'Loading timeout' });
          }
        }, 15000);

      } catch (error) {
        log('Error initializing map: ' + error.message);
        showError(error.message);
        sendMessage('MAP_ERROR', { error: error.message });
      }
    }
    
    function setRegion(region) {
      if (map && region && isReady) {
        try {
          map.setCamera({
            center: [region.longitude, region.latitude],
            zoom: region.zoom || 10,
            type: 'ease',
            duration: 1000
          });
          log('Region updated: ' + region.latitude + ', ' + region.longitude);
        } catch (error) {
          console.error('Error setting region:', error);
        }
      }
    }
    
    function addMarker(markerData) {
      if (!map || !markerData || !isReady) return;
      
      try {
        const position = [markerData.longitude, markerData.latitude];
        const marker = new atlas.HtmlMarker({
          position: position,
          htmlContent: '<div class="map-marker' + (markerData.id === 'current' ? ' user-location' : '') + '"></div>',
          pixelOffset: [0, -8]
        });
        
        map.markers.add(marker);
        markers.push({ id: markerData.id, marker: marker, data: markerData });
        
        // Add click handler
        map.events.add('click', marker, function(e) {
          sendMessage('MARKER_PRESSED', {
            id: markerData.id,
            latitude: markerData.latitude,
            longitude: markerData.longitude,
            title: markerData.title,
            description: markerData.description
          });
        });
        
        log('Marker added: ' + markerData.id);
      } catch (error) {
        console.error('Error adding marker:', error);
      }
    }
    
    function setMarkers(markersData) {
      if (!isReady) return;
      
      try {
        // Clear existing markers
        if (map && map.markers) {
          map.markers.clear();
        }
        markers = [];
        
        // Add new markers
        if (markersData && Array.isArray(markersData)) {
          markersData.forEach(addMarker);
          log('Updated ' + markersData.length + ' markers');
        }
      } catch (error) {
        console.error('Error setting markers:', error);
      }
    }
    
    // Listen for messages from parent
    window.addEventListener('message', function(event) {
      if (!event.data || !event.data.type) return;
      
      try {
        switch (event.data.type) {
          case 'SET_REGION':
            setRegion(event.data.region);
            break;
          case 'SET_MARKERS':
            setMarkers(event.data.markers);
            break;
          case 'ADD_MARKER':
            addMarker(event.data.marker);
            break;
          case 'ANIMATE_TO_REGION':
            setRegion(event.data.region);
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendMessage('MAP_ERROR', { error: error.message });
      }
    });
    
    // Initialize when page loads
    document.addEventListener('DOMContentLoaded', initializeMap);
    if (document.readyState === 'complete') {
      initializeMap();
    }
  </script>
</body>
</html>`;

  // Fullscreen modal content
  const MapContent = (
    <View style={[styles.container, fullscreen && { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: '#fff' }, style]}>
      <iframe
        ref={iframeRef}
        srcDoc={mapHTML}
        style={styles.iframe}
        onLoad={onIframeLoad}
        title={accessibilityLabel}
        sandbox="allow-scripts allow-same-origin"
      />
      {/* Fullscreen toggle button */}
      <TouchableOpacity
        style={{ position: 'absolute', top: 12, right: 12, backgroundColor: '#fff', borderRadius: 20, padding: 8, elevation: 3, zIndex: 1001 }}
        onPress={() => setFullscreen(!fullscreen)}
        accessibilityLabel={fullscreen ? 'Exit fullscreen map' : 'Enter fullscreen map'}
      >
        <Text style={{ fontSize: 18 }}>{fullscreen ? '⤫' : '⛶'}</Text>
      </TouchableOpacity>
      {/* Zoom controls */}
      <View style={{ position: 'absolute', bottom: 20, right: 12, zIndex: 1001 }}>
        <TouchableOpacity onPress={handleZoomIn} style={{ backgroundColor: '#fff', borderRadius: 20, padding: 8, marginBottom: 8, alignItems: 'center', elevation: 2 }} accessibilityLabel="Zoom in">
          <Text style={{ fontSize: 22, fontWeight: 'bold' }}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleZoomOut} style={{ backgroundColor: '#fff', borderRadius: 20, padding: 8, alignItems: 'center', elevation: 2 }} accessibilityLabel="Zoom out">
          <Text style={{ fontSize: 22, fontWeight: 'bold' }}>–</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (fullscreen) {
    return (
      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        {MapContent}
      </Modal>
    );
  }

  return MapContent;
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  fallbackSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

CrossPlatformAzureMapView.displayName = 'CrossPlatformAzureMapView';

export default CrossPlatformAzureMapView;