// components/CrossPlatformWebMap.js
import React, {
  forwardRef,
  useMemo,
  useRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { geocodeAddress } from '../services/marketplaceApi';

const sameTriplet = (a, b) =>
  a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
  const dLon = (Number(lon2) - Number(lon1)) * Math.PI / 180;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(Number(lat1) * Math.PI / 180) * Math.cos(Number(lat2) * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
};

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

  // Force English labels
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

  /* --- Pins (HTML markers) --- */
  .pin {
    position:relative; cursor:pointer; transition:transform .15s ease;
    box-shadow:0 6px 16px rgba(0,0,0,.25); border-radius:12px; overflow:hidden; border:2px solid #fff;
    transform-origin: bottom center;
    --s: 1; /* scale set from JS */
    transform: translateY(0) scale(var(--s));
  }
  .pin:hover { transform: translateY(-2px) scale(calc(var(--s) * 1.04)); }
  .pin.thumb { width:36px; height:36px; }
  .pin.thumb img { width:100%; height:100%; object-fit:cover; display:block; background:#e9efe9; }
  .pin.fallback { width:28px; height:28px; border-radius:14px; background:#4CAF50; border:2px solid #fff; display:grid; place-items:center; color:#fff; font-size:14px; }
  .pin .badge { position:absolute; bottom:-8px; left:50%; transform:translateX(-50%); background:#111; color:#fff; font-weight:700; font-size:9px; padding:2px 6px; border-radius:999px; white-space:nowrap; box-shadow:0 4px 10px rgba(0,0,0,.25); }

  /* --- My location (pretty + pulse) --- */
  .me {
    position:relative;
    width:16px; height:16px; border-radius:50%;
    background:#2E7D32; border:3px solid #fff;
    box-shadow: 0 0 0 2px rgba(46,125,50,0.35), 0 6px 16px rgba(0,0,0,.25);
  }
  .me::after {
    content:''; position:absolute; inset:-10px; border-radius:50%;
    border:2px solid rgba(46,125,50,0.35);
    animation: pulse 1.8s ease-out infinite;
  }
  @keyframes pulse {
    0%   { transform: scale(0.7); opacity: .7; }
    70%  { transform: scale(1.5); opacity: 0; }
    100% { transform: scale(1.5); opacity: 0; }
  }
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
    let lastRadiusMeters = cfg.radiusMeters || 0;

    // keep the latest "me" position for radius centering
    let myLoc = (cfg.myLocation && Number.isFinite(cfg.myLocation.latitude) && Number.isFinite(cfg.myLocation.longitude))
      ? { lon: Number(cfg.myLocation.longitude), lat: Number(cfg.myLocation.latitude) }
      : null;

    function currentRadiusCenter(){
      if (myLoc) return [myLoc.lon, myLoc.lat];
      if (map) { const c = map.getCenter(); return [c.lng, c.lat]; }
      return cfg.center; // fallback
    }

    // Track DOM elements for zoom scaling
    window.__pins = [];
    window.__pinEls = [];

    function applyZoomScale(){
      if (!map) return;
      const z = map.getZoom(); // ~3..20
      // Base: ~0.9 at z=12; clamp 0.7..1.4 (smaller pins overall)
      const s = Math.max(0.7, Math.min(1.4, 0.9 + 0.10 * (z - 12)));
      (window.__pinEls || []).forEach(el => el && el.style && el.style.setProperty('--s', s));
    }

    function addMarkers(list){
      (window.__pins || []).forEach(m => m.remove && m.remove());
      window.__pins = [];
      window.__pinEls = [];

      (list || []).forEach(m => {
        if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) return;

        const el = document.createElement('div');
        if (m.imageUrl) {
          el.className = 'pin thumb';
          el.innerHTML = \`<img src="\${m.imageUrl}" alt="">\`;
        } else {
          el.className = 'pin fallback';
          el.textContent = '🌱';
        }
        window.__pinEls.push(el);

        if (m.priceText) {
          const badge = document.createElement('div');
          badge.className = 'badge';
          badge.textContent = m.priceText;
          el.appendChild(badge);
        }

        el.title = (m.title || '') + (m.distanceKm!=null ? (' • ' + m.distanceKm.toFixed(1) + ' km') : '');
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          send(m.type === 'business' ? 'select-business' : 'select-product', { id: m.id });
        });

        const mk = new maplibregl.Marker({ element: el, anchor:'bottom' })
          .setLngLat([m.lon, m.lat])
          .addTo(map);
        window.__pins.push(mk);
      });

      applyZoomScale();
    }

    function ensureRadius(meters){
      lastRadiusMeters = Number(meters) || 0;
      if (!lastRadiusMeters || lastRadiusMeters <= 0){
        try { map.removeLayer('radius-fill'); map.removeLayer('radius-line'); map.removeSource('radius-src'); } catch(_){}
        radiusAdded = false; return;
      }
      const [lon, lat] = currentRadiusCenter();
      const c = circlePolygon(lon, lat, lastRadiusMeters, 96);
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
      if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
        myLoc = null;
        if (lastRadiusMeters > 0) ensureRadius(lastRadiusMeters);
        return;
      }
      myLoc = { lon: Number(point.longitude), lat: Number(point.latitude) };

      const el = document.createElement('div'); el.className = 'me';
      meMarker = new maplibregl.Marker({ element: el, anchor:'center' })
        .setLngLat([myLoc.lon, myLoc.lat])
        .addTo(map);

      if (lastRadiusMeters > 0) ensureRadius(lastRadiusMeters);
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

        // Smooth pin scaling on zoom
        let zoomRaf = 0;
        map.on('zoom', () => {
          if (!zoomRaf) {
            zoomRaf = requestAnimationFrame(() => {
              applyZoomScale();
              zoomRaf = 0;
            });
          }
        });

        map.on('load', () => {
          setStatus('Rendering…');
          addMarkers(cfg.markers);
          setMyLocationPoint(cfg.myLocation); // establish myLoc before circle
          ensureRadius(cfg.radiusMeters);
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
            if (msg.type === 'refreshMarkers') { addMarkers(msg.markers || []); }
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
  const geoCacheRef = useRef(new Map());
  const [resolvedMarkers, setResolvedMarkers] = useState([]);

  // Robust coordinate extraction
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
      const lat = num(c.lat), lon = num(c.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    return {};
  };

  const toAddressString = (x = {}) => {
    const L = x.location || x.address || {};
    const parts = [
      L.formattedAddress || L.address || '',
      L.city || x.city || '',
      L.state || '',
      L.country || '',
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  };

  const items = mapMode === 'plants' ? products : businesses;

  if (Array.isArray(items) && items.length) {
    const preview = items.slice(0, 3).map((x) => ({
      id: x.id || x._id,
      loc: x.location || x.address,
    }));
    console.log('[Map] incoming items preview:', JSON.stringify(preview));
  }

  // Resolve markers: existing coords OR geocode address/city
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = [];
      for (const x of (items || [])) {
        const parsed = extractLatLon(x);
        let lat = parsed.lat, lon = parsed.lon;

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          const addr = toAddressString(x);
          if (addr) {
            const key = addr.trim().toLowerCase();
            let cached = geoCacheRef.current.get(key);
            if (cached === undefined) {
              const g = await geocodeAddress(addr);
              const glat = Number(g?.latitude ?? g?.lat);
              const glon = Number(g?.longitude ?? g?.lng ?? g?.lon);
              if (Number.isFinite(glat) && Number.isFinite(glon)) {
                cached = { lat: glat, lon: glon };
              } else {
                cached = 'x';
                console.log('[Map] geocode had no numeric coords for:', addr, g);
              }
              geoCacheRef.current.set(key, cached);
            }
            if (cached && cached !== 'x') {
              lat = cached.lat; lon = cached.lon;
            }
          }
        }

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const img =
            x.imageUrl || x.image || x.thumbnail || x.photoUrl ||
            (Array.isArray(x.images) && x.images[0]) ||
            (Array.isArray(x.photos) && (x.photos[0]?.url || x.photos[0])) ||
            (x.media && x.media[0]?.url);

          const price = x.price ?? x.priceNIS ?? x.priceILS ?? x.cost;

          const m = {
            id: String(x.id || x._id || ''),
            title: x.title || x.name || x.businessName || 'Item',
            lat, lon,
            type: mapMode === 'plants' ? 'plant' : 'business',
            imageUrl: img ? String(img) : null,
            priceText: (price != null && price !== '') ? `${price}₪` : null,
          };
          if (showMyLocation && Number.isFinite(myLocation?.latitude) && Number.isFinite(myLocation?.longitude)) {
            m.distanceKm = haversineKm(myLocation.latitude, myLocation.longitude, lat, lon);
          }
          out.push(m);
        }
      }
      if (!cancelled) {
        setResolvedMarkers(out);
        if (out.length) {
          console.log('[Map] markers built:', out.length, out.slice(0, 2));
        } else {
          console.log('[Map] no valid markers for mode', mapMode);
        }
        if (readyRef.current) {
          webRef.current?.postMessage(JSON.stringify({ type: 'refreshMarkers', markers: out }));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMode, products, businesses, showMyLocation, myLocation?.latitude, myLocation?.longitude]);

  const center = {
    latitude: Number(initialRegion?.latitude) || 32.0853,
    longitude: Number(initialRegion?.longitude) || 34.7818,
    zoom: Number(initialRegion?.zoom) || 12,
  };

  const html = useMemo(
    () =>
      buildHtml({
        maptilerKey: String(maptilerKey || ''),
        center,
        zoom: center.zoom,
        markers: resolvedMarkers,
        radiusKm: Number(searchRadius) || 0,
        myLocation,
        showMyLocation,
      }),
    // Keep stable to avoid remount; live updates go via postMessage
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maptilerKey, center.latitude, center.longitude, center.zoom]
  );

  // Live updates after map is ready
  useEffect(() => {
    if (!readyRef.current) return;
    webRef.current?.postMessage(JSON.stringify({ type: 'refreshMarkers', markers: resolvedMarkers }));
  }, [resolvedMarkers]);

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
    forceRefresh: () => {
      if (!readyRef.current) return;
      webRef.current?.postMessage(JSON.stringify({ type: 'refreshMarkers', markers: resolvedMarkers }));
      webRef.current?.postMessage(JSON.stringify({ type: 'setRadius', meters: Math.max(0, Number(searchRadius) || 0) * 1000 }));
      webRef.current?.postMessage(JSON.stringify({ type: 'setMyLocation', point: showMyLocation ? myLocation : null }));
    },
  }));

  const onMessage = (evt) => {
    try {
      const msg = JSON.parse(evt?.nativeEvent?.data || '{}');

      if (msg.type === 'ready') {
        readyRef.current = true;
        webRef.current?.postMessage(JSON.stringify({ type: 'setMyLocation', point: showMyLocation ? myLocation : null }));
        webRef.current?.postMessage(JSON.stringify({ type: 'setRadius', meters: Math.max(0, Number(searchRadius) || 0) * 1000 }));
        webRef.current?.postMessage(JSON.stringify({ type: 'refreshMarkers', markers: resolvedMarkers }));
        return;
      }

      if (msg.type === 'mapClick' && props.onMapPress) {
        props.onMapPress({ latitude: msg.latitude, longitude: msg.longitude });
        return;
      }
      if (msg.type === 'select-product' && props.onSelectProduct) {
        props.onSelectProduct(msg.id);
        return;
      }
      if (msg.type === 'select-business' && props.onSelectBusiness) {
        props.onSelectBusiness(msg.id);
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
        onLoadStart={() => { readyRef.current = false; }}
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
