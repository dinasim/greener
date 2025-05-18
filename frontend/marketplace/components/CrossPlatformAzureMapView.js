// components/CrossPlatformAzureMapView.js
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
 * Enhanced Cross-platform Azure Map component
 * Works on both web and mobile platforms
 * Improved pin visualization and circle radius display
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
  useCustomPin = false,
  showMyLocation = false,
  myLocation = null
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
  const [selectedProduct, setSelectedProduct] = useState(null);

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
        console.log(`Azure Maps key loaded successfully`);
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
      
      console.log(`Drawing radius circle: ${searchRadius}km at [${initialRegion.latitude}, ${initialRegion.longitude}]`);
      
      const msg = { 
        type: 'DRAW_RADIUS', 
        latitude: initialRegion.latitude, 
        longitude: initialRegion.longitude,
        radius: searchRadius
      };
      
      if (Platform.OS === 'web') {
        const iframe = document.getElementById('azureMapsIframe');
        if (iframe?.contentWindow?.handleMessage) {
          iframe.contentWindow.handleMessage(JSON.stringify(msg));
        } else {
          console.warn('Iframe or handleMessage not available');
        }
      } else if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `window.handleMessage(${JSON.stringify(JSON.stringify(msg))}); true;`
        );
      }
    };
    
    // Small delay to ensure the map is fully initialized
    setTimeout(drawRadius, 500);
  }, [searchRadius, mapReady, initialRegion]);

  // Effect to show user's current location
  useEffect(() => {
    if (!mapReady || !showMyLocation || !myLocation?.latitude || !myLocation?.longitude) return;
    
    const showUserLocation = () => {
      console.log(`Showing user location at: ${myLocation.latitude}, ${myLocation.longitude}`);
      
      const msg = { 
        type: 'SHOW_MY_LOCATION', 
        latitude: myLocation.latitude, 
        longitude: myLocation.longitude
      };
      
      if (Platform.OS === 'web') {
        const iframe = document.getElementById('azureMapsIframe');
        if (iframe?.contentWindow?.handleMessage) {
          iframe.contentWindow.handleMessage(JSON.stringify(msg));
        }
      } else if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `window.handleMessage(${JSON.stringify(JSON.stringify(msg))}); true;`
        );
      }
    };
    
    setTimeout(showUserLocation, 500);
  }, [myLocation, showMyLocation, mapReady]);

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
    .popup-content{padding:12px;max-width:250px;font-family:Arial,Helvetica,sans-serif}
    .popup-content strong{font-size:16px;color:#333}
    .popup-price{font-size:15px;color:#4caf50;font-weight:bold;margin:5px 0}
    .popup-location{font-size:13px;color:#666;margin-bottom:5px}
    .popup-distance{font-size:12px;color:#888;margin-bottom:8px}
    .popup-button{background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:bold}
    .popup-button:hover{opacity:.9}
    .search-radius{stroke:rgba(76,175,80,0.8);stroke-width:2;stroke-dasharray:5,5;fill:rgba(76,175,80,0.1)}
    .pin-label{background:white;border:2px solid #4caf50;color:#333;font-weight:bold;padding:3px 8px;border-radius:12px;}
    .plant-pin{width:28px;height:36px;}
    .debug-info{position:absolute;bottom:10px;left:10px;background:rgba(255,255,255,0.8);padding:10px;border-radius:5px;font-family:monospace;z-index:1000;max-width:80%;overflow:auto;}
    .my-location-pulse {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #4285f4;
      border: 2px solid white;
      box-shadow: 0 0 0 rgba(66, 133, 244, 0.4);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(66, 133, 244, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(66, 133, 244, 0);
      }
    }
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
      if (debugDiv) {
        debugDiv.innerHTML += "<div>" + message + "</div>";
      }
    }

    // Set debug visibility
    document.getElementById('debug').style.display = ${Platform.OS === 'web' ? "'none'" : "'none'"};

    // Variables to store map objects
    let map = null;
    let src = null;
    let clusterSrc = null;
    let popup = null;
    let radiusCircle = null;
    let searchCircle = null;
    let myLocationPin = null;
    let userLocationDataSource = null;
    
    // Custom plant pin SVG - much nicer visualization
    const plantPinSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><g fill="none"><path fill="#4CAF50" d="M14 0C6.268 0 0 6.268 0 14c0 5.025 2.65 9.428 6.625 11.9L14 36l7.375-10.1C25.35 23.428 28 19.025 28 14 28 6.268 21.732 0 14 0z"/><circle cx="14" cy="14" r="8" fill="#fff"/><path fill="#4CAF50" d="M17.8 10.3c-.316.3-3.9 3.8-3.9 6.5 0 1.545 1.355 2.8 2.9 2.8.5 0 .8-.4.8-.8 0-.4-.3-.8-.8-.8-.7 0-1.3-.6-1.3-1.3 0-1.8 2.684-4.5 2.9-4.7.3-.3.3-.9 0-1.2-.3-.4-.9-.4-1.2 0-.1.1-.2.2-.4.5m-5.6-1.6c-.3-.3-.8-.3-1.1 0-.3.3-.3.8 0 1.1.1.1 2.7 2.7 2.7 5.3 0 .7-.5 1.2-1.2 1.2-.4 0-.8.3-.8.8 0 .4.3.8.8.8 1.5 0 2.8-1.3 2.8-2.8-.1-3.2-3-5.8-3.2-6.4z"/></g></svg>';
    
    // Create DOM elements for custom markers
    const plantPinImage = document.createElement('img');
    plantPinImage.src = 'data:image/svg+xml;base64,' + btoa(plantPinSvg);

    // My location arrow svg
    const myLocationSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#4285f4" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="white"/></svg>';
    const myLocationImage = document.createElement('img');
    myLocationImage.src = 'data:image/svg+xml;base64,' + btoa(myLocationSvg);

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
        map.imageSprite.add('plant-pin', plantPinImage).then(() => {
          updateDebug("Added custom plant-pin successfully");
        }).catch(err => {
          updateDebug("Error adding custom plant-pin: " + err.toString());
        });
        
        // Add my location marker image
        map.imageSprite.add('my-location', myLocationImage).then(() => {
          updateDebug("Added my-location icon successfully");
        }).catch(err => {
          updateDebug("Error adding my-location icon: " + err.toString());
        });
        
        // Create data sources
        src = new atlas.source.DataSource();
        clusterSrc = new atlas.source.DataSource(null, {
          cluster: true,
          clusterRadius: 45,
          clusterMaxZoom: 15
        });
        
        // Create a separate data source for user's current location
        userLocationDataSource = new atlas.source.DataSource();
        
        map.sources.add([src, clusterSrc, userLocationDataSource]);

        // Add a layer for individual markers
        map.layers.add(new atlas.layer.SymbolLayer(src, null, {
          iconOptions: {
            image: 'plant-pin',  
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

        // Add user location symbol layer
        map.layers.add(new atlas.layer.SymbolLayer(userLocationDataSource, null, {
          iconOptions: {
            image: 'my-location',
            anchor: 'center',
            allowOverlap: true,
            size: 1.0
          }
        }));

        // Create a popup with enhanced styling
        popup = new atlas.Popup({
          pixelOffset: [0, -35],
          closeButton: false,
          fillColor: 'white',
          shadowColor: 'rgba(0,0,0,0.2)',
          shadowBlur: 8
        });

        // Create a search radius data source and layer
        radiusCircle = new atlas.source.DataSource();
        map.sources.add(radiusCircle);
        
        // Add a circle layer for search radius with improved styling
        map.layers.add(new atlas.layer.PolygonLayer(radiusCircle, null, {
          fillColor: 'rgba(76, 175, 80, 0.15)',
          fillOpacity: 0.6
        }));
        
        // Add a line layer for search radius border with improved styling
        map.layers.add(new atlas.layer.LineLayer(radiusCircle, null, {
          strokeColor: 'rgba(76, 175, 80, 0.8)',
          strokeWidth: 2,
          strokeDashArray: [5, 5],
          strokeOpacity: 0.8
        }));

        // Function to create enhanced popup content
        function makePopupContent(props, pos) {
          const div = document.createElement('div');
          div.className = 'popup-content';
          div.innerHTML = \`
            <strong>\${props.title || 'Plant'}</strong>
            <div class="popup-price">$\${parseFloat(props.price || 0).toFixed(2)}</div>
            <div class="popup-location">\${props.location || ''}</div>
            \${props.distance ? '<div class="popup-distance">Distance: ' + props.distance.toFixed(2) + ' km</div>' : ''}
          \`;
          const btn = document.createElement('button');
          btn.className = 'popup-button';
          btn.textContent = 'View Details';
          btn.onclick = () => selectProduct(props.id);
          div.appendChild(btn);
          popup.setOptions({ content: div, position: pos });
          popup.open(map);

          // Also notify parent immediately
          selectProduct(props.id);
        }

        // Function to handle product selection - FIXED TO PROPERLY NOTIFY PARENT
        function selectProduct(id) {
          updateDebug("Product selected: " + id);
          
          // Notify React Native WebView on mobile
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PIN_CLICKED',
              productId: id
            }));
          } 
          // Notify parent on web via multiple methods
          else {
            try {
              // Try postMessage to parent
              window.parent.postMessage(JSON.stringify({
                type: 'PIN_CLICKED',
                productId: id
              }), '*');
              
              // Also dispatch custom event
              document.dispatchEvent(new CustomEvent('pinclicked', {
                detail: { productId: id }
              }));
              
              updateDebug("Sent pin click notification to parent");
            } catch (e) {
              updateDebug("Error sending pin click to parent: " + e.toString());
            }
          }
        }

        // Click event for markers
        map.events.add('click', src, (e) => {
          updateDebug("Marker clicked");
          const s = e.shapes?.[0];
          if (!s) return;
          
          // Close any open popup first
          popup.close();
          
          // Get the properties and coordinates
          const props = s.getProperties();
          const coords = s.getCoordinates();
          
          // Make the popup content
          makePopupContent(props, coords);
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
              content: \`<div class="popup-content" style="text-align:center">
                <strong>\${ptCount} plants found</strong><br>
                <button class="popup-button" style="margin-top:10px" onclick="map.setCamera({center:[\${e.position[0]},\${e.position[1]}],zoom:map.getCamera().zoom+2})">
                  Zoom In
                </button>
              </div>\`,
              position: e.position
            });
            popup.open(map);
          }
        });
        
        // Add map click event handler for coordinate selection
        map.events.add('click', (e) => {
          // Only forward click events that aren't on markers
          if (!e.shapes || e.shapes.length === 0) {
            // Close any open popups
            popup.close();
            
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
          if (e.id === 'plant-pin') {
            updateDebug("Handling missing plant-pin image");
            map.imageSprite.add('plant-pin', plantPinImage).then(() => {
              updateDebug("Added missing plant-pin on demand");
            });
          } else if (e.id === 'my-location') {
            updateDebug("Handling missing my-location image");
            map.imageSprite.add('my-location', myLocationImage).then(() => {
              updateDebug("Added missing my-location on demand");
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

    // Function to update markers with better visualization
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
          distance: p.distance || 0,
          rating: p.rating || 0,
          sellerName: p.seller?.name || p.sellerName || 'Unknown Seller',
          sellerRating: p.seller?.rating || 0
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
          try {
            const bounds = atlas.data.BoundingBox.fromData(points);
            map.setCamera({
              bounds,
              padding: 50
            });
          } catch (e) {
            updateDebug("Error setting camera bounds: " + e.toString());
            // Just center on first point as fallback
            map.setCamera({
              center: points[0].geometry.coordinates,
              zoom: 10
            });
          }
        }
      } else {
        updateDebug("No points with valid coordinates found");
      }
    }

    // IMPROVED: Function to draw a radius circle with enhanced visualization
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
      
      try {
        // Create a circle polygon with higher precision for smoother appearance
        const circle = atlas.math.getRegularPolygonPath(
          center,
          radiusKm * 1000, // Convert km to meters
          96, // Number of vertices (smooth circle)
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
        
        updateDebug("Radius circle drawn successfully");
      } catch (e) {
        updateDebug("Error drawing radius circle: " + e.toString());
      }
    }

    // Function to show user's current location
    function showUserLocation(latitude, longitude) {
      if (!userLocationDataSource) {
        updateDebug("Cannot show user location: data source not initialized");
        return;
      }
      
      userLocationDataSource.clear();
      
      if (latitude === undefined || longitude === undefined) {
        updateDebug("Invalid user location coordinates");
        return;
      }
      
      updateDebug("Showing user location at: " + latitude + ", " + longitude);
      
      // Add a point for the user location with custom properties
      userLocationDataSource.add(new atlas.data.Feature(
        new atlas.data.Point([longitude, latitude]),
        { type: 'userLocation' }
      ));
      
      // Center the map on the user's location
      map.setCamera({
        center: [longitude, latitude],
        zoom: 15
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

    // Handle incoming messages - IMPROVED ERROR HANDLING
    window.handleMessage = (raw) => {
      try {
        const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
        updateDebug("Received message: " + msg.type);
        
        if (msg.type === 'UPDATE_PRODUCTS') {
          try {
            updateMarkers(msg.products);
          } catch (e) {
            updateDebug("Error updating products: " + e.toString());
          }
        }
        
        if (msg.type === 'SET_REGION') {
          try {
            map.setCamera({
              center: [msg.longitude, msg.latitude],
              zoom: msg.zoom || map.getCamera().zoom
            });
          } catch (e) {
            updateDebug("Error setting region: " + e.toString());
          }
        }
        
        if (msg.type === 'SELECT_PRODUCT') {
          try {
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
          } catch (e) {
            updateDebug("Error selecting product: " + e.toString());
          }
        }
        
        if (msg.type === 'DRAW_RADIUS') {
          try {
            drawRadiusCircle(
              [msg.longitude, msg.latitude],
              msg.radius
            );
          } catch (e) {
            updateDebug("Error drawing radius: " + e.toString());
          }
        }
        
        if (msg.type === 'CLEAR_RADIUS') {
          try {
            radiusCircle.clear();
          } catch (e) {
            updateDebug("Error clearing radius: " + e.toString());
          }
        }
        
        if (msg.type === 'SHOW_MY_LOCATION') {
          try {
            showUserLocation(msg.latitude, msg.longitude);
          } catch (e) {
            updateDebug("Error showing location: " + e.toString());
          }
        }
        
      } catch (e) {
        updateDebug("Error handling message: " + e.toString());
      }
    };

    // Set up event listener on document for web integration
    document.addEventListener('message', function(e) {
      try {
        if (e.data) {
          window.handleMessage(e.data);
        }
      } catch (err) {
        updateDebug("Error in document message handler: " + err.toString());
      }
    });
  </script>
</body>
</html>
`;
  }, [azureMapsKey, initialRegion, mapStyle, products]);

  /* ------------------------------------------------------------------ */
  /* WEB: initialize Azure Maps inside <iframe> once container ready    */
  /* ------------------------------------------------------------------ */
  const initWebMap = useCallback(() => {
    if (Platform.OS !== 'web' || !mapDivRef.current) return;

    const handleMsg = (event) => {
      if (!event.data) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        console.log('Map message received:', data.type);
        
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
            console.log('Pin clicked:', data.productId);
            setSelectedProduct(data.productId);
            onSelectProduct?.(data.productId);
            break;
          case 'MAP_CLICKED':
            onMapPress?.(data.coordinates);
            break;
          case 'MAP_ERROR':
          case 'ERROR':
            console.error('Map error:', data.message || data.error);
            setIsError(true);
            setErrorMessage(data.message || data.error || 'Unknown error');
            break;
          default:
            // Ignore other messages
        }
      } catch (err) {
        console.error('Error handling map message:', err);
      }
    };

    window.addEventListener('message', handleMsg);
    
    // Also listen for the custom event
    const pinClickedHandler = (e) => {
      if (e.detail && e.detail.productId) {
        console.log('Pin clicked (custom event):', e.detail.productId);
        setSelectedProduct(e.detail.productId);
        onSelectProduct?.(e.detail.productId);
      }
    };
    
    document.addEventListener('pinclicked', pinClickedHandler);

    return () => {
      window.removeEventListener('message', handleMsg);
      document.removeEventListener('pinclicked', pinClickedHandler);
    };
  }, [products, onMapReady, onSelectProduct, onMapPress]);

  useEffect(initWebMap, [initWebMap]);

  /* ------------------------------------------------------------------ */
  /* Mobile: WebView message handler                                     */
  /* ------------------------------------------------------------------ */
  const handleWebViewMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      console.log('Mobile WebView message:', data.type);
      
      switch (data.type) {
        case 'MAP_READY':
          setIsLoading(false);
          setMapReady(true);
          onMapReady?.();
          break;
        case 'PIN_CLICKED':
          console.log('Pin clicked:', data.productId);
          setSelectedProduct(data.productId);
          onSelectProduct?.(data.productId);
          break;
        case 'MAP_CLICKED':
          onMapPress?.(data.coordinates);
          break;
        case 'MAP_ERROR':
        case 'ERROR':
          console.error('Map error:', data.message || data.error);
          setIsError(true);
          setErrorMessage(data.message || data.error || 'Unknown error');
          break;
        default:
          // Ignore other messages
      }
    } catch (err) {
      console.error('Error parsing WebView message:', err);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Send marker updates after first MAP_READY                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!mapReady || !products?.length) return;

    console.log('Sending products to map:', products.length);
    const msg = { type: 'UPDATE_PRODUCTS', products };
    
    if (Platform.OS === 'web') {
      const iframe = document.getElementById('azureMapsIframe');
      if (iframe?.contentWindow?.handleMessage) {
        iframe.contentWindow.handleMessage(JSON.stringify(msg));
      } else {
        console.warn('Iframe or handleMessage not available');
      }
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