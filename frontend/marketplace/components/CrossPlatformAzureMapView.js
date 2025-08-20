// components/CrossPlatformAzureMapView.js
import React, { forwardRef, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const buildHtml = ({ key_, center, zoom, markers, radiusKm }) => {
  const safeMarkers = JSON.stringify(markers || []);
  const rMeters = Math.max(0, Number(radiusKm) || 0) * 1000;

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>
    html,body{margin:0;padding:0;height:100vh;width:100vw;background:#fff;overflow:hidden;}
    #map{position:fixed;inset:0;height:100vh;width:100vw;}
    #status{position:fixed;top:8px;left:8px;z-index:9999;background:rgba(0,0,0,.65);color:#fff;padding:6px 8px;border-radius:6px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;}
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="status">loading map…</div>
  <script>
    (function(){
      const post = (p)=>{ try{ window.ReactNativeWebView?.postMessage(JSON.stringify(p)); }catch(_){} };
      ['log','warn','error'].forEach(k=>{
        const o=console[k]; console[k]=function(){ try{ post({type:'console',level:k,args:[].slice.call(arguments)});}catch(_){}; o&&o.apply(console,arguments); };
      });
      window.addEventListener('unhandledrejection', e => {
        post({ type:'console', level:'error', args:['unhandledrejection:', String(e?.reason || e)] });
      });
    })();

    var subKey = ${JSON.stringify(String(key_ || ''))};
    if(!subKey){ document.getElementById('status').textContent='missing Azure Maps key'; }

    // Force v3 (MapLibre-based) so we can pass an inline style object (no /styling/ calls).
    var JS_URL  = 'https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.js';
    var CSS_URL = 'https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.css';

    (function loadAtlas(){
      var link = document.createElement('link'); link.rel='stylesheet'; link.href=CSS_URL; document.head.appendChild(link);
      var s = document.createElement('script'); s.src=JS_URL; s.onload=start; s.onerror=function(){
        document.getElementById('status').textContent='map SDK failed to load';
      }; document.head.appendChild(s);
    })();

    function start(){
      try{
        // Inline **blank** style JSON so the SDK does NOT fetch /styling/styles/*
        var blankStyle = {
          "version": 8,
          "name": "blank",
          "sources": {},
          "layers": [
            { "id": "background", "type": "background", "paint": { "background-color": "#ffffff" } }
          ]
        };

        // Raster tile templates with key embedded (no worker rewrite needed).
        var ROAD_TILES = 'https://atlas.microsoft.com/map/tile?api-version=2024-04-01' +
                         '&tilesetId=microsoft.base.road&zoom={z}&x={x}&y={y}&tileSize=256&view=Auto&language=en-US' +
                         '&subscription-key=' + encodeURIComponent(subKey);

        var LABEL_TILES = 'https://atlas.microsoft.com/map/tile?api-version=2024-04-01' +
                          '&tilesetId=microsoft.base.labels.road&zoom={z}&x={x}&y={y}&tileSize=256&view=Auto&language=en-US' +
                          '&subscription-key=' + encodeURIComponent(subKey);

        var ctr = [${Number(center.longitude)}, ${Number(center.latitude)}];
        var initialZoom = ${Number(zoom) || 12};

        var map = new atlas.Map('map', {
          style: blankStyle,                         // <— inline, no /styling/
          center: ctr,
          zoom: initialZoom,
          showFeedbackLink: false,
          renderWorldCopies: false,
          disableTelemetry: true,
          disableWebGL2Support: true,                // safer in RN WebView
          authOptions: { authType:'subscriptionKey', subscriptionKey: subKey }
        });

        map.events.add('error', function(e){
          try {
            const msg = e && (e.message || e.error || e.type) || 'unknown';
            console.error('atlas error:', msg);
            document.getElementById('status').textContent = 'atlas error';
          } catch(_) {}
        });

        map.events.add('ready', function(){
          try { document.getElementById('status').style.display='none'; } catch(_){}
          try { map.resize(); } catch(_){}
          setTimeout(function(){ try{ map.resize(); }catch(_){} }, 200);

          // Base raster tiles (roads)
          var roadLayer = new atlas.layer.TileLayer({ tileUrl: ROAD_TILES, opacity: 1, tileSize: 256 }, 'am-road');
          map.layers.add(roadLayer);

          // Raster labels on top
          var labelLayer = new atlas.layer.TileLayer({ tileUrl: LABEL_TILES, opacity: 1, tileSize: 256 }, 'am-labels');
          map.layers.add(labelLayer);

          // Data & bubble markers (no sprites required)
          var ds = new atlas.source.DataSource(); map.sources.add(ds);
          var items = ${safeMarkers};
          items.forEach(function(m){
            if(Number.isFinite(m.lat) && Number.isFinite(m.lon)){
              ds.add(new atlas.Shape(new atlas.data.Point([m.lon, m.lat]), { id: m.id, title: m.title || '' }));
            }
          });

          var bubbles = new atlas.layer.BubbleLayer(ds, null, {
            radius: 6,
            color: '#1976d2',
            strokeColor: '#ffffff',
            strokeWidth: 1.5
          });
          map.layers.add(bubbles);

          map.events.add('click', bubbles, function(e){
            try{
              if(e && e.shapes && e.shapes.length){
                var sh = e.shapes[0];
                var props = (typeof sh.getProperties === 'function') ? sh.getProperties() : (sh.properties || {});
                if (props && props.id) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type:'markerClick', id: props.id }));
                }
              }
            }catch(err){ console.error('marker click error:', String(err)); }
          });

          // Optional radius circle
          var meters = ${rMeters};
          if(meters > 0){
            var circle = atlas.math.getRegularPolygon(new atlas.data.Position(ctr[0], ctr[1]), meters, 64);
            var ringSrc = new atlas.source.DataSource(); map.sources.add(ringSrc);
            ringSrc.add(circle);
            map.layers.add(new atlas.layer.PolygonLayer(ringSrc, null, { fillColor:'rgba(76,175,80,.12)' }));
            map.layers.add(new atlas.layer.LineLayer(ringSrc, null, { strokeColor:'rgba(76,175,80,.7)', strokeWidth:2 }));
          }

          // Map click -> send lat/lon back
          map.events.add('click', function (e) {
            try {
              var px = e.pixel || e.position;
              var pos = null;
              if (typeof map.pixelsToPositions === 'function') {
                var arr = map.pixelsToPositions([px]); if (arr && arr.length) pos = arr[0];
              } else if (typeof map.pixelToPosition === 'function') {
                pos = map.pixelToPosition(px);
              }
              if (pos) window.ReactNativeWebView.postMessage(JSON.stringify({ type:'mapClick', latitude: pos[1], longitude: pos[0] }));
            } catch(err) { console.error('click->pos error:', String(err)); }
          });

          window.addEventListener('resize', function(){ try{ map.resize(); }catch(_){ } });
        });
      } catch(err){
        document.getElementById('status').textContent = 'init failed: ' + String(err && err.message || err);
      }
    }
  </script>
</body>
</html>`;
};

const CrossPlatformAzureMapView = forwardRef((props, ref) => {
  const {
    products = [],
    businesses = [],
    mapMode = 'plants',
    onSelectProduct,
    onSelectBusiness,
    initialRegion,
    azureMapsKey,
    searchRadius = 10,
    onMapPress,
  } = props;

  if (!azureMapsKey) {
    console.log('[AzureMap] No key – WebView not rendered');
    return <View style={styles.fill} />;
  }

  const items = mapMode === 'plants' ? products : businesses;
  const markers = (items || [])
    .map(x => ({
      id: x.id || x._id,
      title: x.title || x.name || x.businessName || 'Item',
      lat: x?.location?.latitude ?? x?.address?.latitude,
      lon: x?.location?.longitude ?? x?.address?.longitude,
    }))
    .filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lon));

  const center = {
    latitude: initialRegion?.latitude ?? 32.0853,
    longitude: initialRegion?.longitude ?? 34.7818,
    zoom: initialRegion?.zoom ?? 12,
  };

  const html = useMemo(
    () =>
      buildHtml({
        key_: String(azureMapsKey || ''),
        center,
        zoom: center.zoom,
        markers,
        radiusKm: Number(searchRadius) || 0,
      }),
    [azureMapsKey, center.latitude, center.longitude, center.zoom, markers, searchRadius]
  );

  const onMessage = (evt) => {
    try {
      const msg = JSON.parse(evt?.nativeEvent?.data || '{}');
      if (msg.type === 'mapClick' && onMapPress) onMapPress({ latitude: msg.latitude, longitude: msg.longitude });
      if (msg.type === 'markerClick') {
        if (mapMode === 'plants' && onSelectProduct) onSelectProduct(msg.id);
        if (mapMode === 'businesses' && onSelectBusiness) onSelectBusiness(msg.id);
      }
      if (msg.type === 'console') {
        const level = msg.level || 'log';
        console[level]('[WV]', ...(msg.args || []));
      }
    } catch {}
  };

  return (
    <View style={styles.fill}>
      <WebView
        key={`map-${String(azureMapsKey).slice(0, 6)}-${Platform.OS}`}
        ref={ref}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        androidLayerType={Platform.OS === 'android' ? 'software' : 'none'}
        onMessage={onMessage}
        onError={(e) => console.log('[WebView onError]', e.nativeEvent)}
        onHttpError={(e) => console.log('[WebView onHttpError]', e.nativeEvent)}
        style={styles.fill}
      />
    </View>
  );
});

const styles = StyleSheet.create({ fill: { flex: 1 } });
export default CrossPlatformAzureMapView;
