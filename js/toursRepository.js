import { categories as mockCategories, popularDestinations as mockPopularDestinations, tours as mockTours } from "./data.js";
import { getTripApiBase, getTripsEndpoint, getTripsPage, getTripsPerPage } from "./config.js";
import { mapTripsResponseToTours } from "./wpTripMapper.js";
import { sanitizeHtml } from "./html.js";

function normalizeTour(t) {
  const tour = { ...(t || {}) };
  tour.id = String(tour.id || "");
  tour.title = String(tour.title || "");
  tour.slug = String(tour.slug || "");
  tour.location = String(tour.location || "");
  tour.destinations = Array.isArray(tour.destinations)
    ? tour.destinations.map((x) => String(x || "").trim()).filter(Boolean)
    : tour.location
      ? [tour.location]
      : [];
  tour.category = String(tour.category || "");
  tour.type = String(tour.type || "");
  tour.price = Number(tour.price) || 0;
  const oldPriceNum = tour.oldPrice != null ? Number(tour.oldPrice) : null;
  tour.oldPrice = Number.isFinite(oldPriceNum) && oldPriceNum > 0 ? oldPriceNum : null;
  tour.currency = String(tour.currency || "").trim().toUpperCase();
  const ratingNum = tour.rating != null ? Number(tour.rating) : null;
  tour.rating = Number.isFinite(ratingNum) && ratingNum > 0 ? ratingNum : null;
  const reviewsNum = tour.reviewsCount != null ? Number(tour.reviewsCount) : null;
  tour.reviewsCount = Number.isFinite(reviewsNum) && reviewsNum > 0 ? reviewsNum : null;
  tour.badges = Array.isArray(tour.badges) ? tour.badges.map((x) => String(x)) : [];
  tour.image = String(tour.image || "");
  tour.gallery = Array.isArray(tour.gallery) ? tour.gallery.map((x) => String(x)) : tour.image ? [tour.image] : [];
  tour.shortDescription = String(tour.shortDescription || "");
  tour.fullDescription = sanitizeHtml(String(tour.fullDescription || ""));
  tour.highlights = Array.isArray(tour.highlights) ? tour.highlights.map((x) => String(x)) : [];
  tour.included = Array.isArray(tour.included) ? tour.included.map((x) => String(x)) : [];
  tour.excluded = Array.isArray(tour.excluded) ? tour.excluded.map((x) => String(x)) : [];
  tour.itinerary = Array.isArray(tour.itinerary)
    ? tour.itinerary.map((s) => ({ title: String(s?.title || ""), description: String(s?.description || "") }))
    : [];
  tour.cancellation = String(tour.cancellation || "");
  tour.featured = Boolean(tour.featured);
  tour.duration = tour.duration || { label: "", hours: 0, days: 0 };
  if (typeof tour.duration === "string") tour.duration = { label: tour.duration, hours: 0, days: 0 };
  tour.duration = {
    label: String(tour.duration.label || ""),
    hours: Number(tour.duration.hours) || 0,
    days: Number(tour.duration.days) || 0,
  };
  return tour;
}

function isDebugEnabled() {
  try {
    if (typeof window === "undefined") return false;
    if (window.FTS_DEBUG === true || window.FTS_DEBUG === "1") return true;
    return window.localStorage?.getItem?.("FTS_DEBUG") === "1";
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const contentType = String(res.headers.get("content-type") || "");
  const isJson = contentType.includes("application/json") || contentType.includes("application/problem+json");
  const data = isJson ? await res.json() : await res.text();
  const headers = {
    totalPages: Number(res.headers.get("x-wp-totalpages") || res.headers.get("X-WP-TotalPages") || 0) || null,
    totalCount: Number(res.headers.get("x-wp-total") || res.headers.get("X-WP-Total") || 0) || null,
  };
  return { ok: res.ok, status: res.status, data, headers };
}

function isPlaceholderImageUrl(url) {
  const u = String(url || "").trim();
  if (!u) return true;
  if (u.startsWith("assets/images/")) return true;
  return false;
}

function coercePositiveInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function extractPaginationTotalPages(data, headers) {
  const fromHeaders = coercePositiveInt(headers?.totalPages);
  if (fromHeaders) return fromHeaders;
  const totalPages = coercePositiveInt(data?.pagination?.total_pages ?? data?.pagination?.totalPages ?? data?.meta?.total_pages);
  if (totalPages) return totalPages;
  return null;
}

function extractTripsCountForPage(data) {
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.data)) return data.data.length;
  if (Array.isArray(data?.trips)) return data.trips.length;
  if (Array.isArray(data?.items)) return data.items.length;
  return null;
}

let mediaUrlCache = new Map();

function pickBestMediaUrl(media) {
  const sizes = media?.media_details?.sizes;
  const url =
    sizes?.large?.source_url ||
    sizes?.medium_large?.source_url ||
    sizes?.medium?.source_url ||
    media?.source_url ||
    media?.guid?.rendered ||
    "";
  return String(url || "").trim();
}

async function fetchMediaUrlsByIds(ids, { base }) {
  const safeBase = String(base || "").trim();
  if (!safeBase) return new Map();
  const include = ids.filter(Boolean).map((x) => String(x)).join(",");
  if (!include) return new Map();
  const url = new URL(`${safeBase}/wp/v2/media`);
  url.searchParams.set("include", include);
  url.searchParams.set("per_page", String(Math.min(100, ids.length)));
  url.searchParams.set("_fields", "id,source_url,guid,media_details");
  const res = await fetchJson(url.toString());
  if (!res.ok || !Array.isArray(res.data)) return new Map();
  const out = new Map();
  res.data.forEach((m) => {
    const id = coercePositiveInt(m?.id);
    if (!id) return;
    const u = pickBestMediaUrl(m);
    if (u) out.set(id, u);
  });
  return out;
}

async function resolveMediaUrls(ids, { base }) {
  const uniq = Array.from(new Set(ids.filter(Boolean).map((x) => coercePositiveInt(x)).filter(Boolean)));
  const missing = uniq.filter((id) => !mediaUrlCache.has(id));
  if (missing.length) {
    const chunks = [];
    for (let i = 0; i < missing.length; i += 100) chunks.push(missing.slice(i, i + 100));
    for (const chunk of chunks) {
      const map = await fetchMediaUrlsByIds(chunk, { base }).catch(() => new Map());
      map.forEach((url, id) => mediaUrlCache.set(id, url));
    }
  }
  const out = new Map();
  uniq.forEach((id) => {
    const u = mediaUrlCache.get(id);
    if (u) out.set(id, u);
  });
  return out;
}

async function hydrateToursMedia(tours, { base, debug }) {
  const allIds = [];
  tours.forEach((t) => {
    const featured = t?._mediaIds?.featuredImageId;
    const gallery = t?._mediaIds?.galleryIds;
    const f = coercePositiveInt(featured);
    if (f) allIds.push(f);
    if (Array.isArray(gallery)) gallery.forEach((id) => allIds.push(coercePositiveInt(id)));
  });
  const uniqueIds = Array.from(new Set(allIds.filter(Boolean)));
  if (!uniqueIds.length) return tours;

  if (debug) console.info("[FTS] Resolving media IDs:", uniqueIds.length);
  const media = await resolveMediaUrls(uniqueIds, { base });
  if (debug) console.info("[FTS] Resolved media URLs:", media.size);

  return tours.map((t) => {
    const tour = { ...(t || {}) };
    const featuredId = coercePositiveInt(tour?._mediaIds?.featuredImageId);
    const featuredUrl = featuredId ? media.get(featuredId) || "" : "";

    const galleryIds = Array.isArray(tour?._mediaIds?.galleryIds)
      ? tour._mediaIds.galleryIds.map(coercePositiveInt).filter(Boolean)
      : [];
    const galleryUrlsFromIds = galleryIds.map((id) => media.get(id)).filter(Boolean);

    const existingGallery = Array.isArray(tour.gallery) ? tour.gallery.map((x) => String(x || "").trim()).filter(Boolean) : [];
    const realExistingGallery = existingGallery.filter((u) => !isPlaceholderImageUrl(u));

    const combined = [];
    const add = (u) => {
      const url = String(u || "").trim();
      if (!url) return;
      if (combined.includes(url)) return;
      combined.push(url);
    };

    if (featuredUrl) add(featuredUrl);
    galleryUrlsFromIds.forEach(add);
    realExistingGallery.forEach(add);

    const fallback = String(tour.image || "").trim();
    const hasRealGallery = combined.length > 0;
    const imageWasPlaceholder = isPlaceholderImageUrl(fallback);

    if (featuredUrl) tour.image = featuredUrl;
    else if (imageWasPlaceholder && hasRealGallery) tour.image = combined[0];

    if (hasRealGallery) tour.gallery = combined;
    else if (!Array.isArray(tour.gallery) || !tour.gallery.length) tour.gallery = tour.image ? [tour.image] : [];

    return normalizeTour(tour);
  });
}

async function loadFromApi() {
  const base = getTripApiBase();
  if (!base) return null;
  const endpoint = getTripsEndpoint();
  const url = new URL(`${base}${endpoint}`);
  if (!url.searchParams.get("page")) url.searchParams.set("page", String(getTripsPage()));
  if (!url.searchParams.get("per_page")) url.searchParams.set("per_page", String(getTripsPerPage()));
  const startPage = getTripsPage();
  const perPage = getTripsPerPage();

  const debug = isDebugEnabled();
  const maxPages = 100;

  const allTours = [];
  let totalPages = null;
  let page = startPage;
  for (;;) {
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));
    const finalUrl = url.toString();
    if (debug) console.info("[FTS] Trips API URL:", finalUrl);

    const res = await fetchJson(finalUrl);
    if (debug) console.info("[FTS] Trips API status:", res.status);
    if (!res.ok) {
      if (debug) console.warn("[FTS] Trips API request failed:", res.data);
      throw new Error(`Trips API failed (${res.status})`);
    }

    if (totalPages == null) totalPages = extractPaginationTotalPages(res.data, res.headers);

    const mapped = mapTripsResponseToTours(res.data).map(normalizeTour);
    if (debug) console.info("[FTS] Trips mapped count (page):", mapped.length);
    allTours.push(...mapped);

    const rawCount = extractTripsCountForPage(res.data);
    const isLastByCount = rawCount != null ? rawCount < perPage : mapped.length < perPage;
    const isLastByTotalPages = totalPages != null ? page >= totalPages : false;
    const isLastByMax = page - startPage + 1 >= maxPages;
    if (isLastByTotalPages || isLastByCount || isLastByMax) break;
    page += 1;
  }

  const unique = [];
  const seen = new Set();
  allTours.forEach((t) => {
    const key = String(t?.slug || t?.id || "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(t);
  });

  if (debug) console.info("[FTS] Trips mapped total:", unique.length);
  const hydrated = await hydrateToursMedia(unique, { base, debug });
  return hydrated;
}

function loadFromMock() {
  return mockTours.map(normalizeTour);
}

let cache = null;

export async function getTours({ forceRefresh = false } = {}) {
  if (cache && !forceRefresh) return cache;

  const debug = isDebugEnabled();
  const fromApi = await loadFromApi().catch((e) => {
    if (debug) console.warn("[FTS] Using mock fallback (API error):", e?.message || e);
    return null;
  });
  if (fromApi && fromApi.length) {
    if (debug) console.info("[FTS] Using API data");
    cache = fromApi;
  } else {
    if (debug) console.warn("[FTS] Using mock fallback (empty API response)");
    cache = loadFromMock();
  }
  return cache;
}

export async function getTourBySlug(slug) {
  const list = await getTours();
  const s = String(slug || "");
  return list.find((t) => t.slug === s) || null;
}

export async function getRelatedTours(slug, limit = 4) {
  const list = await getTours();
  const current = list.find((t) => t.slug === String(slug || "")) || null;
  if (!current) return list.slice(0, limit);

  const sameLocation = list.filter((t) => t.slug !== current.slug && t.location === current.location);
  const sameCategory = list.filter((t) => t.slug !== current.slug && t.category === current.category);

  const combined = [...sameLocation, ...sameCategory].reduce((acc, t) => {
    if (!acc.some((x) => x.slug === t.slug)) acc.push(t);
    return acc;
  }, []);

  return combined.slice(0, limit);
}

export async function getPopularDestinations() {
  const list = await getTours();
  const all = list.flatMap((t) => (Array.isArray(t.destinations) && t.destinations.length ? t.destinations : [t.location]).filter(Boolean));
  const fromData = Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
  return fromData.length ? fromData : mockPopularDestinations;
}

export async function getCategories() {
  const list = await getTours();
  const fromData = Array.from(new Set(list.map((t) => t.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return fromData.length ? fromData : mockCategories;
}
