import { categories as mockCategories, popularDestinations as mockPopularDestinations, tours as mockTours } from "./data.js";
import { airtableListRecords } from "./airtableClient.js";
import { getAirtableConfig, isAirtableConfigured } from "./airtableConfig.js";

function safeString(v) {
  return String(v == null ? "" : v).trim();
}

function slugify(input) {
  const s = safeString(input).toLowerCase();
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return s
          .split(/\r?\n|,/g)
          .map((x) => x.trim())
          .filter(Boolean);
      }
    }
    return s
      .split(/\r?\n|,/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function firstAttachmentUrl(v) {
  if (typeof v === "string") return v.trim();
  if (!Array.isArray(v) || !v.length) return "";
  const a = v[0];
  if (!a) return "";
  const url = a.url || a?.thumbnails?.large?.url || a?.thumbnails?.full?.url || a?.thumbnails?.small?.url;
  return safeString(url);
}

function attachmentUrls(v) {
  if (typeof v === "string") return asArray(v);
  if (!Array.isArray(v)) return [];
  return v
    .map((a) => safeString(a?.url || a?.thumbnails?.large?.url || a?.thumbnails?.full?.url || a?.thumbnails?.small?.url))
    .filter(Boolean);
}

function pickField(fields, name, aliases = []) {
  if (!fields) return undefined;
  const direct = fields[name];
  if (direct !== undefined) return direct;
  for (const a of aliases) {
    const v = fields[a];
    if (v !== undefined) return v;
  }
  return undefined;
}

function normalizeAirtableRecord(record, config) {
  const fields = record?.fields || {};
  const f = config?.fields || {};

  const title = safeString(pickField(fields, f.title, ["Title", "name", "Name"]));
  const slug = safeString(pickField(fields, f.slug, ["Slug", "slug"])) || slugify(title);

  const duration = pickField(fields, f.duration, ["Duration", "durationLabel", "DurationLabel"]);
  const itineraryRaw = pickField(fields, f.itinerary, ["Itinerary", "itineraryJson", "ItineraryJson"]);
  const itineraryArr = Array.isArray(itineraryRaw) ? itineraryRaw : typeof itineraryRaw === "string" ? itineraryRaw.trim() : itineraryRaw;
  let itinerary = [];
  if (Array.isArray(itineraryArr)) {
    itinerary = itineraryArr.map((s) => ({ title: safeString(s?.title || s?.name || s?.step || ""), description: safeString(s?.description || "") }));
  } else if (typeof itineraryArr === "string") {
    const txt = itineraryArr;
    if (txt.startsWith("[") || txt.startsWith("{")) {
      try {
        const parsed = JSON.parse(txt);
        if (Array.isArray(parsed)) {
          itinerary = parsed.map((s) => ({ title: safeString(s?.title || ""), description: safeString(s?.description || "") }));
        }
      } catch {
        itinerary = txt
          .split(/\r?\n/g)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({ title: line, description: "" }));
      }
    } else {
      itinerary = txt
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ title: line, description: "" }));
    }
  }

  const imageField = pickField(fields, f.image, ["Image", "imageUrl", "ImageUrl", "cover", "Cover"]);
  const galleryField = pickField(fields, f.gallery, ["Gallery", "images", "Images"]);

  const image = safeString(firstAttachmentUrl(imageField));
  const gallery = attachmentUrls(galleryField);

  return normalizeTour({
    id: safeString(pickField(fields, f.id, ["Id", "ID"])) || safeString(record?.id || ""),
    title,
    slug,
    location: safeString(pickField(fields, f.location, ["Location", "city", "City"])),
    category: safeString(pickField(fields, f.category, ["Category"])),
    type: safeString(pickField(fields, f.type, ["Type", "groupType", "GroupType"])),
    duration: duration || "",
    rating: pickField(fields, f.rating, ["Rating"]),
    reviewsCount: pickField(fields, f.reviewsCount, ["ReviewsCount", "reviews", "Reviews"]),
    price: pickField(fields, f.price, ["Price"]),
    oldPrice: pickField(fields, f.oldPrice, ["OldPrice", "old_price", "Old price"]),
    badges: asArray(pickField(fields, f.badges, ["Badges"])),
    image,
    gallery: gallery.length ? gallery : image ? [image] : [],
    shortDescription: safeString(pickField(fields, f.shortDescription, ["ShortDescription", "short", "Summary"])),
    fullDescription: safeString(pickField(fields, f.fullDescription, ["FullDescription", "description", "Description"])),
    highlights: asArray(pickField(fields, f.highlights, ["Highlights"])),
    included: asArray(pickField(fields, f.included, ["Included"])),
    excluded: asArray(pickField(fields, f.excluded, ["Excluded"])),
    itinerary,
    cancellation: safeString(pickField(fields, f.cancellation, ["Cancellation", "cancellationPolicy", "CancellationPolicy"])),
    featured: Boolean(pickField(fields, f.featured, ["Featured"])),
  });
}

function normalizeTour(t) {
  const tour = { ...(t || {}) };
  tour.id = String(tour.id || "");
  tour.title = String(tour.title || "");
  tour.slug = String(tour.slug || "") || slugify(tour.title);
  tour.location = String(tour.location || "");
  tour.category = String(tour.category || "");
  tour.type = String(tour.type || "");
  tour.price = Number(tour.price) || 0;
  tour.oldPrice = tour.oldPrice != null ? Number(tour.oldPrice) || 0 : null;
  tour.rating = Number(tour.rating) || 0;
  tour.reviewsCount = Number(tour.reviewsCount) || 0;
  tour.badges = Array.isArray(tour.badges) ? tour.badges.map((x) => String(x)) : [];
  tour.image = String(tour.image || "");
  tour.gallery = Array.isArray(tour.gallery) ? tour.gallery.map((x) => String(x)).filter(Boolean) : tour.image ? [tour.image] : [];
  tour.shortDescription = String(tour.shortDescription || "");
  tour.fullDescription = String(tour.fullDescription || "");
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

function resolveApiBase() {
  const fromWindow = typeof window !== "undefined" ? window.FTS_API_BASE : "";
  const base = String(fromWindow || "").trim().replace(/\/+$/, "");
  return base || "";
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function loadFromApi() {
  const base = resolveApiBase();
  if (!base) return null;

  const data = await fetchJson(`${base}/tours`);
  const list = Array.isArray(data) ? data : Array.isArray(data?.tours) ? data.tours : [];
  return list.map(normalizeTour);
}

function loadFromMock() {
  return mockTours.map(normalizeTour);
}

async function loadFromAirtable() {
  if (!isAirtableConfigured()) return null;
  const config = getAirtableConfig();
  const records = await airtableListRecords();
  if (!records.length) return [];
  return records.map((r) => normalizeAirtableRecord(r, config)).filter((t) => t && t.slug);
}

let cache = null;

export async function getTours({ forceRefresh = false } = {}) {
  if (cache && !forceRefresh) return cache;

  const fromAirtable = await loadFromAirtable().catch(() => null);
  if (fromAirtable && fromAirtable.length) {
    cache = fromAirtable;
    return cache;
  }

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
