// services/WishlistService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import marketplaceApi from './marketplaceApi'; // has getSpecific, getUserWishlist, wishProduct

const IDS_KEY = 'wishlist:ids:v1';
const SNAPSHOT_KEY = 'wishlist:snapshots:v1';

// ---------- storage helpers
async function loadIds() {
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
async function saveIds(ids) {
  try {
    await AsyncStorage.setItem(IDS_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {}
}
async function loadSnapshots() {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
async function saveSnapshots(map) {
  try {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(map || {}));
  } catch {}
}

// Normalize various backend shapes for getUserWishlist()
function extractIdsFromServerPayload(payload) {
  if (!payload) return [];
  // 1) { items: [{ id } ...] }
  if (Array.isArray(payload.items)) {
    return payload.items
      .map((x) => x?.id || x?._id || x?.inventoryId)
      .filter(Boolean);
  }
  // 2) { wishlist: [id...] } or { data: [ids] }
  if (Array.isArray(payload.wishlist)) return payload.wishlist.filter(Boolean);
  if (Array.isArray(payload.data)) return payload.data.filter(Boolean);
  // 3) plain array of ids or objects
  if (Array.isArray(payload)) {
    const first = payload[0];
    if (typeof first === 'string') return payload;
    return payload.map((x) => x?.id || x?._id || x?.inventoryId).filter(Boolean);
  }
  // 4) fallback: { ids: [...] }
  if (Array.isArray(payload.ids)) return payload.ids.filter(Boolean);
  return [];
}

// ---------- public API

/**
 * Load wishlist IDs.
 * If force=true, try to sync from server and persist locally.
 */
export async function load({ force = false } = {}) {
  if (!force) return await loadIds();

  try {
    const server = await marketplaceApi.getUserWishlist(); // relies on X-User-Email header
    const ids = extractIdsFromServerPayload(server);
    if (ids.length) await saveIds(ids);
    return ids.length ? ids : await loadIds();
  } catch {
    return await loadIds();
  }
}

export async function has(id) {
  const ids = await loadIds();
  return ids.includes(id);
}

/**
 * Toggle wishlist for a product id.
 * Optionally pass a { snapshot } to render in Favorites if server lookup fails later.
 */
export async function toggle(id, { snapshot } = {}) {
  if (!id) throw new Error('id required');

  const ids = await loadIds();
  const snaps = await loadSnapshots();
  let wished;

  if (ids.includes(id)) {
    // remove
    const next = ids.filter((x) => x !== id);
    await saveIds(next);
    // keep snapshot (useful if re-adding later). Delete here if you prefer:
    // delete snaps[id]; await saveSnapshots(snaps);
    wished = false;
  } else {
    // add
    ids.push(id);
    await saveIds(ids);
    if (snapshot && typeof snapshot === 'object') {
      snaps[id] = { ...(snaps[id] || {}), ...snapshot, isWished: true };
      await saveSnapshots(snaps);
    }
    wished = true;
  }

  // Best-effort server call (don’t let failures break UX)
  try {
    await marketplaceApi.wishProduct(id);
  } catch {
    // swallow; local cache still works, and Profile will show snapshot
  }

  try { await AsyncStorage.setItem('WISHLIST_UPDATED', '1'); } catch {}

  return { wished };
}

/**
 * Given an array of ids, return product objects.
 * Prefer the stored snapshot first (covers business inventory & offline).
 * If no snapshot exists, try getSpecific(id) as a best-effort.
 */
export async function fetchProducts(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const snaps = await loadSnapshots();
  const results = [];

  for (const id of ids) {
    // 1) use snapshot immediately if we have it
    if (snaps[id]) {
      results.push({ ...snaps[id], id, _id: id, isWished: true });
      continue;
    }

    // 2) otherwise try individual product endpoint (may return null for business items)
    try {
      const product = await marketplaceApi.getSpecific(id);
      if (product) {
        results.push({ ...product, isWished: true });
      }
    } catch {
      // swallow; no snapshot and server didn't find it
    }
  }

  return results;
}

/**
 * Annotate a list of products so their heart renders filled if wished.
 */
export async function annotate(products = []) {
  if (!Array.isArray(products) || !products.length) return products;
  const ids = await loadIds();
  if (!ids.length) return products;
  const wished = new Set(ids);
  return products.map((p) => {
    const pid = p?.id || p?._id || p?.inventoryId;
    return pid && wished.has(pid) ? { ...p, isWished: true } : p;
  });
}

/** Optional utility to clear all local wishlist data */
export async function clearLocal() {
  await AsyncStorage.multiRemove([IDS_KEY, SNAPSHOT_KEY, 'WISHLIST_UPDATED']);
}

export default {
  load,
  has,
  toggle,
  fetchProducts,
  annotate,
  clearLocal,
};
