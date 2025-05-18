// Fix for CrossPlatformAzureMapView.js - Adding custom markers and fixing map issues
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getAzureMapsKey } from '../services/azureMapsService';

// WebView is mobile-only (Expo / RN)
let WebView;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

/**
 * Cross-platform Azure Map component
 * Works on both web and mobile platforms
 * Fixed to correctly register marker images
 */
const CrossPlatformAzureMapView = ({
  products = [],
  onSelectProduct,
  initialRegion = { latitude: 32.0853, longitude: 34.7818, zoom: 10 },
  showControls = true,
  mapStyle = 'road',
  onMapReady,
  searchRadius,
  onMapPress,
  azureMapsKey: providedKey = null, // Allow direct key prop but fall back to service
}) => {
  const webViewRef = useRef(null);
  const mapDivRef = useRef(null);
  const iframeRef = useRef(null);
  
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [azureMapsKey, setAzureMapsKey] = useState(providedKey);
  const [isKeyLoading, setIsKeyLoading] = useState(!providedKey);

  // Load Azure Maps key if not provided as prop
  useEffect(() => {
    if (providedKey) {
      setAzureMapsKey(providedKey);
      setIsKeyLoading(false);
      return;
    }
    
    const loadKey = async () => {
      try {
        setIsKeyLoading(true);
        const key = await getAzureMapsKey();
        console.log(`Azure Maps key loaded (masked): ${key.substring(0, 5)}...${key.substring(key.length - 5)}`);
        setAzureMapsKey(key);
        setIsKeyLoading(false);
      } catch (err) {
        console.error('Error loading Azure Maps key:', err);
        setIsError(true);
        setErrorMessage('Failed to load map configuration. Please try again later.');
        setIsKeyLoading(false);
      }
    };
    
    loadKey();
  }, [providedKey]);

  // Effect to draw search radius when it changes
  useEffect(() => {
    if (!mapReady || !searchRadius) return;
    
    const drawRadius = () => {
      if (!initialRegion?.latitude || !initialRegion?.longitude) return;
      
      const msg = { 
        type: 'DRAW_RADIUS', 
        latitude: initialRegion.latitude, 
        longitude: initialRegion.longitude,
        radius: searchRadius
      };
      
      if (Platform.OS === 'web') {
        const iframe = document.getElementById('azureMapsIframe');
        iframe?.contentWindow?.handleMessage?.(JSON.stringify(msg));
      } else if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `window.handleMessage(${JSON.stringify(JSON.stringify(msg))}); true;`
        );
      }
    };
    
    drawRadius();
  }, [searchRadius, mapReady, initialRegion]);

  // Generate the HTML template for the map view
  const generateMapHtml = useCallback(() => {
    if (!azureMapsKey) {
      return `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial; padding: 20px; text-align: center; color: #f44336;">
          <h2>Error: Azure Maps Key Missing</h2>
          <p>The Azure Maps key was not provided to the component.</p>
        </body>
        </html>
      `;
    }
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
  />
  <title>Greener – Azure Maps</title>
  <link
    rel="stylesheet"
    href="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.css"
  />
  <style>
    html,body,#mapContainer{margin:0;padding:0;width:100%;height:100%;}
    .popup-content{padding:8px;max-width:220px;font-family:Arial,Helvetica,sans-serif}
    button{background:#4caf50;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer}
    button:hover{opacity:.9}
    .debug-info{position:absolute;bottom:10px;left:10px;background:rgba(255,255,255,0.8);padding:10px;border-radius:5px;font-family:monospace;z-index:1000;max-width:80%;overflow:auto;}
  </style>
  <script src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js"></script>
  <script src="https://atlas.microsoft.com/sdk/javascript/service/2/atlas-service.min.js"></script>
</head>
<body>
  <div id="mapContainer"></div>
  <div id="debug" class="debug-info"></div>
  <script>
    // Function to update debug info
    function updateDebug(message) {
      const debugDiv = document.getElementById('debug');
      debugDiv.innerHTML += "<div>" + message + "</div>";
    }

    // Print some initial debug info
    updateDebug("Azure Maps initialization starting...");
    updateDebug("Center: [${initialRegion.longitude}, ${initialRegion.latitude}]");
    updateDebug("Key present: " + ${!!azureMapsKey});
    updateDebug("Key valid format: " + ${typeof azureMapsKey === 'string' && azureMapsKey.length > 10});

    // Variables to store map objects
    let map = null;
    let src = null;
    let clusterSrc = null;
    let popup = null;
    let radiusCircle = null;
    let searchCircle = null;
    
    // Custom marker images
    const markerSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 0C9.373 0 4 5.373 4 12c0 5.303 4.438 9.8 10.35 11.607 1.066 0.335 1.926 1.07 1.926 1.07C17.56 25.57 16 29 16 29s-1.34-4.031-1.91-5.226C13.37 23.043 4 19.396 4 12 4 5.373 9.373 0 16 0zm0 17c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" fill="#4CAF50"/></svg>';
    
    // Create a DOM element to hold the SVG
    const img = document.createElement('img');
    img.src = 'data:image/svg+xml;base64,' + btoa(markerSvg);

    try {
      // Initialize the map
      updateDebug("Creating map object...");
      map = new atlas.Map('mapContainer', {
        center: [${initialRegion.longitude}, ${initialRegion.latitude}],
        zoom: ${initialRegion.zoom},
        view: 'Auto',
        style: '${mapStyle}',
        showLogo: false,
        authOptions: {
          authType: 'subscriptionKey',
          subscriptionKey: '${azureMapsKey}'
        }
      });

      // Map ready event
      map.events.add('ready', () => {
        updateDebug("Map is ready! Creating data sources...");
        
        // Add custom marker images
        map.imageSprite.add('marker-green', img).then(() => {
          updateDebug("Added custom marker-green successfully");
        }).catch(err => {
          updateDebug("Error adding custom marker: " + err.toString());
        });
        
        // Create data sources
        src = new atlas.source.DataSource();
        clusterSrc = new atlas.source.DataSource(null, {
          cluster: true,
          clusterRadius: 45,
          clusterMaxZoom: 15
        });
        map.sources.add([src, clusterSrc]);

        // Add a layer for individual markers
        map.layers.add(new atlas.layer.SymbolLayer(src, null, {
          iconOptions: {
            image: 'pin-round-blue',  // Use built-in pin instead of marker-green
            anchor: 'bottom',
            allowOverlap: true,
            size: 1.0
          }
        }));

        // Add a bubble layer for clusters
        map.layers.add(new atlas.layer.BubbleLayer(clusterSrc, null, {
          radius: 12,
          color: '#4CAF50',
          strokeColor: 'white',
          strokeWidth: 2,
          filter: ['has', 'point_count']
        }));

        // Add a symbol layer for cluster labels
        map.layers.add(new atlas.layer.SymbolLayer(clusterSrc, null, {
          iconOptions: { image: 'none' },
          textOptions: {
            textField: ['get', 'point_count_abbreviated'],
            color: 'white',
            size: 12,
            font: ['SegoeUi-Bold']
          },
          filter: ['has', 'point_count']
        }));

        // Create a popup
        popup = new atlas.Popup({
          pixelOffset: [0, -30],
          closeButton: false
        });

        // Create a search radius data source and layer
        radiusCircle = new atlas.source.DataSource();
        map.sources.add(radiusCircle);
        
        // Add a circle layer for search radius
        map.layers.add(new atlas.layer.PolygonLayer(radiusCircle, null, {
          fillColor: 'rgba(255, 0, 0, 0.2)',
          fillOpacity: 0.5
        }));
        
        // Add a line layer for search radius border
        map.layers.add(new atlas.layer.LineLayer(radiusCircle, null, {
          strokeColor: 'red',
          strokeWidth: 2,
          strokeOpacity: 0.8
        }));

        // Function to create popup content
        function makePopupContent(props, pos) {
          const div = document.createElement('div');
          div.className = 'popup-content';
          div.innerHTML = \`
            <strong>\${props.title || 'Plant'}</strong><br>
            <span style="color:#4caf50;font-weight:bold;">$\${parseFloat(props.price || 0).toFixed(2)}</span><br>
            <small>\${props.location || ''}</small>
            \${props.distance ? '<br><small>Distance: ' + props.distance.toFixed(2) + ' km</small>' : ''}<br>
          \`;
          const btn = document.createElement('button');
          btn.textContent = 'View';
          btn.onclick = () => selectProduct(props.id);
          div.appendChild(btn);
          popup.setOptions({ content: div, position: pos });
          popup.open(map);
        }

        // Function to handle product selection
        function selectProduct(id) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PIN_CLICKED',
              productId: id
            }));
          } else {
            window.parent?.postMessage(JSON.stringify({
              type: 'PIN_CLICKED',
              productId: id
            }), '*');
            document.dispatchEvent(new CustomEvent('pinclicked', {
              detail: { productId: id }
            }));
          }
        }

        // Click event for markers
        map.events.add('click', src, (e) => {
          const s = e.shapes?.[0];
          if (!s) return;
          makePopupContent(s.getProperties(), s.getCoordinates());
        });

        // Click event for clusters
        map.events.add('click', clusterSrc, (e) => {
          const shape = e.shapes?.[0];
          if (!shape) return;
          const props = shape.getProperties();
          if (!props.cluster) return;
          const ptCount = props.point_count;
          if (ptCount < 100) {
            map.setCamera({
              center: e.position,
              zoom: map.getCamera().zoom + 1
            });
          } else {
            popup.setOptions({
              content: \`<div style="text-align:center"><strong>\${ptCount} plants</strong><br><button onclick="map.setCamera({center:[\${e.position[0]},\${e.position[1]}],zoom:map.getCamera().zoom+2})">Zoom In</button></div>\`,
              position: e.position
            });
            popup.open(map);
          }
        });
        
        // Add map click event handler for coordinate selection
        map.events.add('click', (e) => {
          // Close any open popups
          popup.close();
          
          // Only forward click events that aren't on markers
          if (!e.shapes || e.shapes.length === 0) {
            const coords = e.position;
            sendMsg({
              type: 'MAP_CLICKED',
              coordinates: {
                latitude: coords[1],
                longitude: coords[0]
              }
            });
          }
        });

        // Signal that map is ready
        sendMsg({ type: 'MAP_READY' });
        
        // If we have products already, add them to the map
        if (${JSON.stringify(products).length} > 2) {
          updateDebug("Initial products available, adding to map...");
          updateMarkers(${JSON.stringify(products)});
        }
        
        // Add handler for missing images to prevent errors
        map.events.add('styleimagemissing', (e) => {
          if (e.id === 'marker-green') {
            updateDebug("Handling missing marker-green image");
            map.imageSprite.add('marker-green', img).then(() => {
              updateDebug("Added missing marker-green on demand");
            });
          }
        });
      });

      // Map error event
      map.events.add('error', (e) => {
        updateDebug("Map error: " + JSON.stringify(e.error));
        sendMsg({ 
          type: 'MAP_ERROR', 
          error: e.error.toString(),
          source: e.source 
        });
      });
    } catch (e) {
      updateDebug("Initialization error: " + e.toString());
      sendMsg({ 
        type: 'ERROR', 
        message: e.toString() 
      });
    }

    // Function to update markers
    function updateMarkers(list) {
      if (!src || !clusterSrc) {
        updateDebug("Cannot update markers: sources not initialized");
        return;
      }
      
      src.clear();
      clusterSrc.clear();
      
      if (!Array.isArray(list) || !list.length) {
        updateDebug("No products to display on map");
        return;
      }

      updateDebug("Adding " + list.length + " products to map");
      const points = list.reduce((arr, p) => {
        const lat = p.location?.latitude;
        const lon = p.location?.longitude;
        
        if (lat == null || lon == null) {
          updateDebug("Product missing coords: " + (p.id || p._id || 'unknown'));
          return arr;
        }
        
        const common = {
          id: p.id || p._id || Math.random().toString(36).slice(2),
          title: p.title || p.name || 'Plant',
          price: p.price || 0,
          location: p.city || p.location?.city || '',
          distance: p.distance || 0
        };
        
        arr.push(new atlas.data.Feature(
          new atlas.data.Point([lon, lat]),
          common
        ));
        
        return arr;
      }, []);

      if (points.length > 0) {
        updateDebug("Added " + points.length + " points to map");
        src.add(points);
        clusterSrc.add(points);

        if (points.length === 1) {
          map.setCamera({
            center: points[0].geometry.coordinates,
            zoom: 13
          });
        } else if (points.length > 1) {
          const bounds = atlas.data.BoundingBox.fromData(points);
          map.setCamera({
            bounds,
            padding: 50
          });
        }
      } else {
        updateDebug("No points with valid coordinates found");
      }
    }

    // Function to draw a radius circle
    function drawRadiusCircle(center, radiusKm) {
      if (!radiusCircle) {
        updateDebug("Cannot draw radius: circle source not initialized");
        return;
      }
      
      radiusCircle.clear();
      
      if (!center || !radiusKm) {
        updateDebug("Invalid center or radius");
        return;
      }
      
      updateDebug("Drawing radius circle: " + radiusKm + "km at [" + center[0] + ", " + center[1] + "]");
      
      // Create a circle polygon
      const circle = atlas.math.getRegularPolygonPath(
        center,
        radiusKm * 1000, // Convert km to meters
        64, // Number of vertices (smooth circle)
        0, // Start angle
        'meters' // Units
      );
      
      radiusCircle.add(new atlas.data.Feature(
        new atlas.data.Polygon([circle]),
        { radius: radiusKm }
      ));
      
      // Fit map to circle
      const buffer = radiusKm * 0.2; // 20% buffer
      const bounds = new atlas.data.BoundingBox(
        center[0] - buffer,
        center[1] - buffer,
        center[0] + buffer,
        center[1] + buffer
      );
      
      map.setCamera({
        bounds,
        padding: 50
      });
    }

    // Messaging bridge
    function sendMsg(obj) {
      const str = JSON.stringify(obj);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(str);
      } else {
        window.parent?.postMessage(str, '*');
      }
    }

    // Handle incoming messages
    window.handleMessage = (raw) => {
      try {
        const msg = JSON.parse(raw);
        updateDebug("Received message: " + msg.type);
        
        if (msg.type === 'UPDATE_PRODUCTS') {
          updateMarkers(msg.products);
        }
        
        if (msg.type === 'SET_REGION') {
          map.setCamera({
            center: [msg.longitude, msg.latitude],
            zoom: msg.zoom || map.getCamera().zoom
          });
        }
        
        if (msg.type === 'SELECT_PRODUCT') {
          const feats = src.getShapes();
          for (const f of feats) {
            if (f.getProperties().id === msg.productId) {
              const pos = f.getCoordinates();
              makePopupContent(f.getProperties(), pos);
              map.setCamera({
                center: pos,
                zoom: 15
              });
              break;
            }
          }
        }
        
        if (msg.type === 'DRAW_RADIUS') {
          drawRadiusCircle(
            [msg.longitude, msg.latitude],
            msg.radius
          );
        }
        
        if (msg.type === 'CLEAR_RADIUS') {
          radiusCircle.clear();
        }
        
      } catch (e) {
        updateDebug("Error handling message: " + e.toString());
      }
    };
    
    // Remove debug info after some time
    setTimeout(() => {
      const debugDiv = document.getElementById('debug');
      if (debugDiv) {
        debugDiv.style.display = 'none';
      }
    }, 10000); // Hide after 10 seconds
  </script>
</body>
</html>
`;
  }, [azureMapsKey, initialRegion, mapStyle, products]);

  /* ------------------------------------------------------------------ */
  /* WEB: initialise Azure Maps inside <iframe> once container ready    */
  /* ------------------------------------------------------------------ */
  const initWebMap = useCallback(() => {
    if (Platform.OS !== 'web' || !mapDivRef.current) return;

    const handleMsg = (event) => {
      if (!event.data) return;
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'MAP_READY':
            setIsLoading(false);
            setMapReady(true);
            onMapReady?.();
            if (products?.length) {
              const iframe = document.getElementById('azureMapsIframe');
              iframe?.contentWindow?.handleMessage?.(
                JSON.stringify({ type: 'UPDATE_PRODUCTS', products })
              );
            }
            break;
          case 'PIN_CLICKED':
            onSelectProduct?.(data.productId);
            break;
          case 'MAP_CLICKED':
            onMapPress?.(data.coordinates);
            break;
          case 'MAP_ERROR':
          case 'ERROR':
            setIsError(true);
            setErrorMessage(data.message || data.error || 'Unknown error');
            break;
          default:
        }
      } catch (_) {}
    };

    window.addEventListener('message', handleMsg);

    return () => window.removeEventListener('message', handleMsg);
  }, [products, onMapReady, onSelectProduct, onMapPress]);

  useEffect(initWebMap, [initWebMap]);

  /* ------------------------------------------------------------------ */
  /* Mobile: WebView message handler                                     */
  /* ------------------------------------------------------------------ */
  const handleWebViewMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      switch (data.type) {
        case 'MAP_READY':
          setIsLoading(false);
          setMapReady(true);
          onMapReady?.();
          break;
        case 'PIN_CLICKED':
          onSelectProduct?.(data.productId);
          break;
        case 'MAP_CLICKED':
          onMapPress?.(data.coordinates);
          break;
        case 'MAP_ERROR':
        case 'ERROR':
          setIsError(true);
          setErrorMessage(data.message || data.error || 'Unknown error');
          break;
        default:
      }
    } catch (_) {}
  };

  /* ------------------------------------------------------------------ */
  /* Send marker updates after first MAP_READY                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!mapReady || !products?.length) return;

    const msg = { type: 'UPDATE_PRODUCTS', products };
    if (Platform.OS === 'web') {
      const iframe = document.getElementById('azureMapsIframe');
      iframe?.contentWindow?.handleMessage?.(JSON.stringify(msg));
    } else if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.handleMessage(${JSON.stringify(JSON.stringify(msg))}); true;`
      );
    }
  }, [products, mapReady]);

  /* ------------------------------------------------------------------ */
  /* Render helpers                                                     */
  /* ------------------------------------------------------------------ */
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#4CAF50" />
      <Text style={styles.loadingText}>Loading map…</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <MaterialIcons name="error-outline" size={48} color="#f44336" />
      <Text style={styles.errorText}>Map failed to load</Text>
      {errorMessage ? (
        <Text style={styles.errorDescription}>{errorMessage}</Text>
      ) : null}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="location-off" size={48} color="#aaa" />
      <Text style={styles.emptyText}>No plants with location data</Text>
    </View>
  );

  /* ------------------------------------------------------------------ */
  /* WEB platform                                                        */
  /* ------------------------------------------------------------------ */
  const WebMap = () => (
    <View style={styles.container} ref={mapDivRef}>
      <iframe
        id="azureMapsIframe"
        ref={iframeRef}
        title="AzureMap"
        srcDoc={generateMapHtml()}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
      {isLoading && renderLoading()}
    </View>
  );

  /* ------------------------------------------------------------------ */
  /* Mobile / native platform                                            */
  /* ------------------------------------------------------------------ */
  const NativeMap = () => (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHtml() }}
        onMessage={handleWebViewMessage}
        onLoadEnd={() => {
          console.log('WebView loaded');
        }}
        onError={(e) => {
          console.error('WebView error:', e.nativeEvent);
          setIsLoading(false);
          setIsError(true);
          setErrorMessage(e.nativeEvent.description || 'WebView error');
        }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        style={styles.map}
      />
      {isLoading && renderLoading()}
    </View>
  );

  /* ------------------------------------------------------------------ */
  /* Main return                                                         */
  /* ------------------------------------------------------------------ */
  if (!azureMapsKey) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>Azure Maps API Key Missing</Text>
        <Text style={styles.errorDescription}>
          Could not load map configuration. Please try again later.
        </Text>
      </View>
    );
  }
  
  if (isError) return renderError();

  return Platform.OS === 'web' ? <WebMap /> : <NativeMap />;
};

/* -------------------------------------------------------------------- */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    position: 'relative'
  },
  map: { 
    flex: 1 
  },
  
  /* overlays */
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { 
    marginTop: 10, 
    color: '#4CAF50', 
    fontSize: 16 
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fafafa',
  },
  errorText: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333', 
    marginTop: 12 
  },
  errorDescription: { 
    fontSize: 14, 
    color: '#666', 
    textAlign: 'center', 
    marginTop: 8 
  },
  emptyContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  emptyText: { 
    fontSize: 16, 
    color: '#666', 
    marginTop: 12 
  },
});

export default CrossPlatformAzureMapView;