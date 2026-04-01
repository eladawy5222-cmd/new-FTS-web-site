import { decodeHtmlEntities, htmlToText, sanitizeHtml } from "./html.js";

function pick(obj, paths, fallback = "") {
  for (const path of paths) {
    const parts = String(path || "").split(".");
    let cur = obj;
    let ok = true;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p];
      else {
        ok = false;
        break;
      }
    }
    if (ok && cur != null && String(cur).trim() !== "") return cur;
  }
  return fallback;
}

function num(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).replace(/[^\d.]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function listFromUnknown(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  const text = htmlToText(v);
  if (!text) return [];
  return text
    .split(/\r?\n|•|\u2022|;|\s{2,}/g)
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function firstTermName(tax, keys) {
  const obj = tax && typeof tax === "object" ? tax : {};
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v) && v.length) {
      const n = v[0]?.name || v[0]?.label || v[0]?.title || v[0];
      if (n) return String(n);
    }
  }
  return "";
}

function parseDuration(raw, meta) {
  const fromMeta = pick(meta, ["wp_travel_engine_setting.duration", "wp_travel_engine_setting.trip_duration"], "");
  const base = String(raw || fromMeta || "").trim();

  const days = num(pick(meta, ["wp_travel_engine_setting.duration_days", "wp_travel_engine_setting.trip_duration_days"], null));
  const hours = num(pick(meta, ["wp_travel_engine_setting.duration_hours", "wp_travel_engine_setting.trip_duration_hours"], null));
  if (days || hours) {
    const label = base || (days ? `${days} day${days === 1 ? "" : "s"}` : `${hours} hours`);
    return { label, days: days || 0, hours: hours || 0 };
  }

  const mDay = base.match(/(\d+(?:\.\d+)?)\s*(day|days|night|nights)/i);
  const mHour = base.match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)/i);
  if (mDay) return { label: base, days: Number(mDay[1]) || 0, hours: 0 };
  if (mHour) return { label: base, days: 0, hours: Number(mHour[1]) || 0 };

  return { label: base, days: 0, hours: 0 };
}

function extractMediaUrls(v) {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "string" ? x : x?.url || x?.src || x?.image || x?.full || x?.sizes?.large))
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }
  if (typeof v === "object") {
    const url = v.url || v.src || v.full || v.sizes?.large || v.sizes?.medium_large || v.sizes?.medium;
    return url ? [String(url)] : [];
  }
  return [];
}

function derivePricing(pricing) {
  const p = pricing && typeof pricing === "object" ? pricing : {};

  const packages = Array.isArray(p.packages) ? p.packages : Array.isArray(p.package_pricing) ? p.package_pricing : [];
  if (packages.length) {
    const values = packages
      .map((pkg) => ({
        actual: num(pkg.actual_price ?? pkg.sale_price ?? pkg.price ?? pkg.cost ?? null),
        base: num(pkg.base_price ?? pkg.regular_price ?? null),
      }))
      .filter((x) => x.actual != null || x.base != null);

    const bestActual = values.map((x) => x.actual).filter((n) => n != null).sort((a, b) => a - b)[0];
    const bestBase = values.map((x) => x.base).filter((n) => n != null).sort((a, b) => a - b)[0];
    const price = bestActual != null ? bestActual : bestBase != null ? bestBase : 0;
    const oldPrice = bestBase != null && bestBase > price ? bestBase : null;
    return { price, oldPrice };
  }

  const actual = num(p.actual_price ?? p.sale_price ?? p.from_price ?? p.price ?? p.cost ?? null);
  const base = num(p.base_price ?? p.regular_price ?? p.original_price ?? null);
  const price = actual != null ? actual : base != null ? base : 0;
  const oldPrice = base != null && base > price ? base : null;
  return { price, oldPrice };
}

function buildBadges({ featured, rating, reviewsCount, cancellation, instant }) {
  const badges = [];
  if (featured) badges.push("Best Seller");
  if ((rating || 0) >= 4.8 && (reviewsCount || 0) >= 40) badges.push("Top Rated");
  const c = String(cancellation || "").toLowerCase();
  if (c.includes("free") && c.includes("cancel")) badges.push("Free Cancellation");
  if (instant) badges.push("Instant Confirmation");
  return badges;
}

function pickFeaturedImage(trip) {
  const f = pick(trip, ["featured_image"], null);
  const urls = extractMediaUrls(f);
  return urls[0] || "";
}

function fallbackImageByLocation(location) {
  const map = {
    Cairo: "assets/images/cairo.svg",
    Luxor: "assets/images/luxor.svg",
    Aswan: "assets/images/aswan.svg",
    Hurghada: "assets/images/hurghada.svg",
    "Sharm El Sheikh": "assets/images/sharm.svg",
  };
  return map[String(location || "")] || "assets/images/nile.svg";
}

function pickContent(trip) {
  const html = pick(trip, ["core.content.rendered", "core.content", "general.content", "content.rendered", "content"], "");
  return sanitizeHtml(html);
}

function pickExcerpt(trip) {
  const html = pick(trip, ["core.excerpt.rendered", "core.excerpt", "general.excerpt", "excerpt.rendered", "excerpt", "seo.description"], "");
  return htmlToText(html);
}

function truncate(s, max = 160) {
  const str = String(s || "").trim();
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1).trim()}…`;
}

function normalizeItinerary(v) {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((s) => ({
        title: String(s?.title || s?.label || s?.heading || "").trim(),
        description: htmlToText(s?.description || s?.desc || s?.content || ""),
      }))
      .filter((x) => x.title || x.description);
  }
  const text = htmlToText(v);
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return lines.slice(0, 8).map((line, idx) => ({ title: `Stop ${idx + 1}`, description: line }));
}

export function mapWpTripToTour(trip) {
  const core = pick(trip, ["core"], {});
  const meta = pick(trip, ["meta.wp_travel_engine_setting", "meta", "wp_travel_engine_setting"], {});
  const tax = pick(trip, ["taxonomies"], {});

  const id = String(pick(trip, ["core.id", "core.ID", "id", "ID"], "") || "");
  const titleRaw = pick(trip, ["core.title.rendered", "core.title", "title.rendered", "title", "general.title", "post_title"], "");
  const title = decodeHtmlEntities(htmlToText(titleRaw) || String(titleRaw || ""));
  const slug = String(pick(trip, ["core.slug", "slug", "post_name"], "") || "");

  const location =
    firstTermName(tax, ["locations", "location", "destinations", "destination", "places", "place"]) ||
    String(pick(trip, ["general.location", "location"], "") || "");
  const category =
    firstTermName(tax, ["categories", "category", "activities", "activity", "trip_categories", "trip_category"]) ||
    String(pick(trip, ["general.category", "category"], "") || "");
  const type =
    firstTermName(tax, ["types", "type", "trip_types", "trip_type"]) || String(pick(trip, ["general.type", "type"], "") || "");

  const duration = parseDuration(pick(trip, ["general.duration", "duration"], ""), meta);

  const rating = num(pick(trip, ["general.rating", "rating", "meta.rating", "core.rating"], null)) || 0;
  const reviewsCount = num(pick(trip, ["general.reviewsCount", "general.reviews", "reviewsCount", "reviews", "meta.reviewsCount"], null)) || 0;

  const pricing = derivePricing(pick(trip, ["pricing", "general.pricing", "meta.pricing"], {}));

  const featured = Boolean(pick(trip, ["general.featured", "featured", "core.featured", "meta.featured", "core.sticky"], false));
  const cancellation = String(pick(trip, ["general.cancellation", "cancellation", "meta.cancellation_policy", "meta.cancellation"], "") || "");

  const instant = Boolean(
    pick(trip, ["general.instant_confirmation", "general.instant", "meta.instant_confirmation", "meta.instant", "meta.booking.instant_confirmation"], false)
  );

  const badges = buildBadges({ featured, rating, reviewsCount, cancellation, instant });

  const image = pickFeaturedImage(trip);
  const gallery = [
    ...extractMediaUrls(pick(trip, ["gallery", "general.gallery", "media.gallery"], null)),
    ...extractMediaUrls(pick(trip, ["core.gallery", "meta.gallery"], null)),
  ].filter(Boolean);

  const fullDescription = pickContent(trip);
  const excerpt = pickExcerpt(trip);
  const shortDescription = truncate(excerpt || htmlToText(fullDescription) || "", 160);

  const highlights = listFromUnknown(pick(meta, ["trip_highlights", "highlights", "general.highlights"], null)).slice(0, 10);
  const included = listFromUnknown(pick(meta, ["trip_includes", "includes", "included"], null)).slice(0, 12);
  const excluded = listFromUnknown(pick(meta, ["trip_excludes", "excludes", "excluded"], null)).slice(0, 12);
  const itinerary = normalizeItinerary(pick(meta, ["itinerary", "trip_itinerary", "general.itinerary"], null)).slice(0, 10);

  const primaryImage = image || gallery[0] || fallbackImageByLocation(location);
  const safeGallery = gallery.length ? gallery : primaryImage ? [primaryImage] : [];

  return {
    id,
    title,
    slug,
    location,
    category,
    duration,
    rating,
    reviewsCount,
    price: pricing.price || 0,
    oldPrice: pricing.oldPrice,
    badges,
    image: primaryImage,
    gallery: safeGallery,
    shortDescription,
    fullDescription,
    highlights,
    included,
    excluded,
    itinerary,
    cancellation,
    type,
    featured,
  };
}

export function mapTripsResponseToTours(data) {
  const root = data && typeof data === "object" ? data : {};
  const list =
    Array.isArray(data) ? data : Array.isArray(root.trips) ? root.trips : Array.isArray(root.items) ? root.items : Array.isArray(root.data) ? root.data : [];
  return list.map(mapWpTripToTour).filter((t) => t && t.slug);
}
