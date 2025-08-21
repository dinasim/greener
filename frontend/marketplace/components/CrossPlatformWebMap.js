// components/CrossPlatformWebMap.js
import React, {
  forwardRef,
  useMemo,
  useRef,
  useEffect,
  useImperativeHandle,
} from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const sameTriplet = (a, b) =>
  a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

const buildHtml = ({
  maptilerKey,
  center,
  zoom,
  markers,
  radiusKm,
  myLocation,
  showMyLocation,
}) => {
  const safeMarkers = JSON.stringify(markers || []);
  const rMeters = Math.max(0, Number(radiusKm) || 0) * 1000;

  // force English labels
  const styleUrl = `https://api.maptiler.com/maps/streets/style.json?key=${encodeURIComponent(
    maptilerKey || ''
  )}&language=en`;

  const circleJs = `
    function circlePolygon(lon, lat, meters, steps){
      const pts = [];
      const R = 6378137, d = meters / R;
      const lat1 = lat * Math.PI/180, lon1 = lon * Math.PI/180;
      for (let i=0;i<=steps;i++){
        const b = 2*Math.PI*i/steps;
        const lat2 = Math.asin(Math.sin(lat1)*Math.cos(d)+Math.cos(lat1)*Math.sin(d)*Math.cos(b));
        const lon2 = lon1 + Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(lat1), Math.cos(d)-Math.sin(lat1)*Math.sin(lat2));
        pts.push([lon2*180/Math.PI, lat2*180/Math.PI]);
      }
      return { type:"Feature", geometry:{ type:"Polygon", coordinates:[pts] } };
    }
  `;

  return `<!doctype html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link href="https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.css" rel="stylesheet" />
<style>
  html, body { margin:0; padding:0; height:100vh; width:100vw; background:#f5f5f5; overflow:hidden; direction:ltr; }
  #map { position:fixed; inset:0; }
  #status { position:fixed; top:8px; left:8px; z-index:9999; background:rgba(0,0,0,.75); color:#fff; padding:6px 10px; border-radius:8px; font-family:sans-serif; font-size:12px; display:block; max-width:280px; }
  .pin { width:28px; height:28px; border-radius:14px; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,.35); cursor:pointer; transition:transform .15s ease; }
  .pin.plant { background:#4CAF50; }
  .pin.business { background:#1976D2; }
  .pin:hover { transform: scale(1.06); }
  .me { width:18px; height:18px; border-radius:9px; background:#fff; border:4px solid #2E7D32; box-shadow:0 1px 4px rgba(0,0,0,.35); }
</style>
</head>
<body>
  <div id="map"></div>
  <div id="status">Loading map…</div>

  <script src="https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.js"></script>
  <script>
    function send(type, payload){
      try {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({ type, timestamp: Date.now(), ...payload })
        );
      } catch(_) {}
    }
    function setStatus(msg){
      const el = document.getElementById('status'); if (el) el.textContent = msg;
    }
    ${circleJs}

    const cfg = {
      styleUrl: ${JSON.stringify(styleUrl)},
      center: [${Number(center.longitude)}, ${Number(center.latitude)}],
      zoom: ${Number(zoom) || 12},
      markers: ${safeMarkers},
      radiusMeters: ${rMeters},
      myLocation: ${JSON.stringify(showMyLocation ? myLocation : null)}
    };

    let map, radiusAdded = false, meMarker = null;

    function addMarkers(list){
      (window.__pins || []).forEach(m => m.remove && m.remove());
      window.__pins = [];
      (list || []).forEach(m => {
        if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) return;
        const el = document.createElement('div');
        el.className = 'pin ' + (m.type === 'business' ? 'business' : 'plant');
        el.title = m.title || '';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          send(m.type === 'business' ? 'select-business' : 'select-product', { id: m.id });
        });
        const mk = new maplibregl.Marker({ element: el, anchor:'bottom' }).setLngLat([m.lon, m.lat]).addTo(map);
        window.__pins.push(mk);
      });
    }

    function ensureRadius(meters){
      if (!meters || meters <= 0){
        try { map.removeLayer('radius-fill'); map.removeLayer('radius-line'); map.removeSource('radius-src'); } catch(_){}
        radiusAdded = false; return;
      }
      const c = circlePolygon(cfg.center[0], cfg.center[1], meters, 96);
      if (!radiusAdded) {
        map.addSource('radius-src', { type:'geojson', data:c });
        map.addLayer({ id:'radius-fill', type:'fill', source:'radius-src', paint:{ 'fill-color':'#4CAF50', 'fill-opacity':0.1 }});
        map.addLayer({ id:'radius-line', type:'line', source:'radius-src', paint:{ 'line-color':'#4CAF50', 'line-width':2, 'line-opacity':0.5 }});
        radiusAdded = true;
      } else {
        const src = map.getSource('radius-src'); src && src.setData(c);
      }
    }

    function setMyLocationPoint(point){
      if (meMarker) { meMarker.remove(); meMarker = null; }
      if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return;
      const el = document.createElement('div'); el.className = 'me';
      meMarker = new maplibregl.Marker({ element: el, anchor:'center' }).setLngLat([point.longitude, point.latitude]).addTo(map);
    }

    window.onerror = function(m){ send('console', { level:'error', args:[String(m)] }); };

    (async function init(){
      try{
        map = new maplibregl.Map({
          container: 'map',
          style: cfg.styleUrl,
          center: cfg.center,
          zoom: cfg.zoom,
          attributionControl: false,
          cooperativeGestures: false,
          failIfMajorPerformanceCaveat: false
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass:false, visualizePitch:false }), 'bottom-right');

        map.on('load', () => {
          setStatus('Rendering…');

          addMarkers(cfg.markers);
          ensureRadius(cfg.radiusMeters);
          setMyLocationPoint(cfg.myLocation);

          setTimeout(()=>{ const el=document.getElementById('status'); if(el) el.style.display='none'; }, 600);
          send('ready', { markersCount: (cfg.markers||[]).length, hasRadius: cfg.radiusMeters>0 });
        });

        map.on('click', (e) => {
          if (!e?.lngLat) return;
          send('mapClick', { latitude: e.lngLat.lat, longitude: e.lngLat.lng });
        });

        map.on('error', (e) => {
          const msg = e?.error?.message || e?.message || 'Map error';
          send('mapError', { error: msg });
        });

        window.addEventListener('message', (ev) => {
          try {
            const msg = JSON.parse(ev.data || '{}');
            if (msg.type === 'refreshMarkers') addMarkers(msg.markers || []);
            if (msg.type === 'setRadius') ensureRadius(Number(msg.meters || 0));
            if (msg.type === 'setMyLocation') setMyLocationPoint(msg.point || null);
            if (msg.type === 'flyTo' && msg.coords) {
              map && map.flyTo({ center: [msg.coords.longitude, msg.coords.latitude], zoom: msg.zoom || 12, essential: true });
            }
          } catch(_) {}
        });
      }catch(err){
        send('mapInitError', { error: err?.message || String(err) });
      }
    })();
  </script>
</body>
</html>`;
};

const CrossPlatformWebMap = forwardRef((props, ref) => {
  const {
    products = [],
    businesses = [],
    mapMode = 'plants',
    onSelectProduct,
    onSelectBusiness,
    onMapPress,
    initialRegion,
    maptilerKey,
    searchRadius = 10,
    myLocation,
    showMyLocation,
  } = props;

  const webRef = useRef(null);
  const readyRef = useRef(false);
  const lastSentRef = useRef({});

  // Super-robust coordinate extraction
  const extractLatLon = (obj = {}) => {
    const num = (v) => {
      if (v == null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const pick = (o, k) =>
      o && typeof o === 'object' ? o[k] ?? o[k?.toLowerCase?.()] ?? o[k?.toUpperCase?.()] : undefined;

    const fromCoords = (coords) =>
      Array.isArray(coords) && coords.length >= 2
        ? { lon: num(coords[0]), lat: num(coords[1]) }
        : {};

    const L = obj.location || obj.address || obj.geo || {};
    const candidates = [
      { lat: pick(L, 'latitude'), lon: pick(L, 'longitude') },
      { lat: pick(L, 'lat'), lon: pick(L, 'lng') ?? pick(L, 'lon') },
      { lat: pick(obj, 'latitude'), lon: pick(obj, 'longitude') },
      { lat: pick(obj, 'lat'), lon: pick(obj, 'lng') ?? pick(obj, 'lon') },
      fromCoords(L.coordinates),
      fromCoords(obj.coordinates),
      fromCoords(obj.geo?.coordinates),
    ];

    for (const c of candidates) {
      const lat = num(c.lat),
        lon = num(c.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    return {};
  };

  const items = mapMode === 'plants' ? products : businesses;

  // Debug: show first few incoming items to verify location shape
  if (Array.isArray(items) && items.length) {
    const preview = items.slice(0, 3).map((x) => ({
      id: x.id || x._id,
      loc: x.location || x.address,
    }));
    console.log('[Map] incoming items preview:', JSON.stringify(preview));
  }

  const markers = (items || [])
    .map((x) => {
      const { lat, lon } = extractLatLon(x);
      return {
        id: String(x.id || x._id || ''),
        title: x.title || x.name || x.businessName || 'Item',
        lat,
        lon,
        type: mapMode === 'plants' ? 'plant' : 'business',
      };
    })
    .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lon));

  if (markers.length) {
    console.log('[Map] markers built:', markers.length, markers.slice(0, 2));
  } else {
    console.log('[Map] no valid markers for mode', mapMode);
  }

  const center = {
    latitude: Number(initialRegion?.latitude) || 32.0853,
    longitude: Number(initialRegion?.longitude) || 34.7818,
    zoom: Number(initialRegion?.zoom) || 12,
  };

  // Build HTML once per key/center change (not on every markers change)
  const html = useMemo(
    () =>
      buildHtml({
        maptilerKey: String(maptilerKey || ''),
        center,
        zoom: center.zoom,
        markers, // used only for first paint; we still push live below
        radiusKm: Number(searchRadius) || 0,
        myLocation,
        showMyLocation,
      }),
    // DO NOT add `markers` or `searchRadius` here (prevents remount white flash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maptilerKey, center.latitude, center.longitude, center.zoom]
  );

  // Live updates after map is ready
  useEffect(() => {
    if (!readyRef.current) return;
    webRef.current?.postMessage(JSON.stringify({ type: 'refreshMarkers', markers }));
  }, [markers]);

  useEffect(() => {
    if (!readyRef.current) return;
    const meters = Math.max(0, Number(searchRadius) || 0) * 1000;
    const key = ['r', meters, 0];
    if (!sameTriplet(lastSentRef.current.r, key)) {
      lastSentRef.current.r = key;
      webRef.current?.postMessage(JSON.stringify({ type: 'setRadius', meters }));
    }
  }, [searchRadius]);

  useEffect(() => {
    if (!readyRef.current) return;
    const point = showMyLocation ? myLocation : null;
    const key = point ? ['me', point.latitude, point.longitude] : ['me', null, null];
    if (!sameTriplet(lastSentRef.current.me, key)) {
      lastSentRef.current.me = key;
      webRef.current?.postMessage(JSON.stringify({ type: 'setMyLocation', point }));
    }
  }, [showMyLocation, myLocation?.latitude, myLocation?.longitude]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, z = 12) => {
      webRef.current?.postMessage(
        JSON.stringify({ type: 'flyTo', coords: { latitude: lat, longitude: lng }, zoom: z })
      );
    },
  }));

  const onMessage = (evt) => {
    try {
      const msg = JSON.parse(evt?.nativeEvent?.data || '{}');

      if (msg.type === 'ready') {
        readyRef.current = true;
        // push current dynamic state once ready
        webRef.current?.postMessage(JSON.stringify({ type: 'refreshMarkers', markers }));
        webRef.current?.postMessage(
          JSON.stringify({ type: 'setRadius', meters: Math.max(0, Number(searchRadius) || 0) * 1000 })
        );
        webRef.current?.postMessage(
          JSON.stringify({ type: 'setMyLocation', point: showMyLocation ? myLocation : null })
        );
        return;
      }

      if (msg.type === 'mapClick' && onMapPress) {
        onMapPress({ latitude: msg.latitude, longitude: msg.longitude });
        return;
      }
      if (msg.type === 'select-product' && onSelectProduct) {
        onSelectProduct(msg.id);
        return;
      }
      if (msg.type === 'select-business' && onSelectBusiness) {
        onSelectBusiness(msg.id);
        return;
      }
      if (msg.type === 'console') {
        const lvl = msg.level || 'log';
        console[lvl]('[WebView]', ...(msg.args || []));
      }
      if (msg.type === 'mapError' || msg.type === 'mapInitError') {
        console.warn('[WebView]', msg.error);
      }
    } catch (e) {
      console.error('[CrossPlatformWebMap] Failed to parse WebView message:', e);
    }
  };

  return (
    <View style={styles.fill}>
      <WebView
        ref={webRef}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled={false}
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures={false}
        bounces={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        androidLayerType={Platform.OS === 'android' ? 'hardware' : 'none'}
        onMessage={onMessage}
        onLoadStart={() => {
          // only true remounts reset readiness
          readyRef.current = false;
        }}
        style={styles.fill}
        containerStyle={styles.fill}
      />
    </View>
  );
});

CrossPlatformWebMap.displayName = 'CrossPlatformWebMap';

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#eef3ee' },
});

export default CrossPlatformWebMap;
