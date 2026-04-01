import { categories as mockCategories, popularDestinations as mockPopularDestinations, tours as mockTours } from "./data.js";
import { getTripApiBase, getTripsEndpoint } from "./config.js";
import { mapTripsResponseToTours } from "./wpTripMapper.js";
import { sanitizeHtml } from "./html.js";

function normalizeTour(t) {
  const tour = { ...(t || {}) };
  tour.id = String(tour.id || "");
  tour.title = String(tour.title || "");
  tour.slug = String(tour.slug || "");
  tour.location = String(tour.location || "");
  tour.category = String(tour.category || "");
  tour.type = String(tour.type || "");
  tour.price = Number(tour.price) || 0;
  tour.oldPrice = tour.oldPrice != null ? Number(tour.oldPrice) || 0 : null;
  tour.rating = Number(tour.rating) || 0;
  tour.reviewsCount = Number(tour.reviewsCount) || 0;
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

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function loadFromApi() {
  const base = getTripApiBase();
  if (!base) return null;
  const endpoint = getTripsEndpoint();
  const data = await fetchJson(`${base}${endpoint}`);
  const mapped = mapTripsResponseToTours(data);
  return mapped.map(normalizeTour);
}

function loadFromMock() {
  return mockTours.map(normalizeTour);
}

let cache = null;

export async function getTours({ forceRefresh = false } = {}) {
  if (cache && !forceRefresh) return cache;

  const fromApi = await loadFromApi().catch(() => null);
  cache = fromApi && fromApi.length ? fromApi : loadFromMock();
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
  const fromData = Array.from(new Set(list.map((t) => t.location).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return fromData.length ? fromData : mockPopularDestinations;
}

export async function getCategories() {
  const list = await getTours();
  const fromData = Array.from(new Set(list.map((t) => t.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return fromData.length ? fromData : mockCategories;
}
