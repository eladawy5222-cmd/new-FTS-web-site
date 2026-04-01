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
  const s = String(v)
    .replaceAll(",", "")
    .replace(/[^\d.-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeCurrencyCode(v) {
  const raw = String(v || "").trim().toUpperCase();
  if (!raw) return "";
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  return "";
}

function listFromUnknown(v) {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (x && typeof x === "object") {
          const t = x.highlight_text ?? x.text ?? x.label ?? x.title ?? x.name ?? x.value ?? "";
          return String(t || "").trim();
        }
        return String(x || "").trim();
      })
      .filter(Boolean);
  }
  const text = htmlToText(v);
  if (!text) return [];
  return text
    .split(/\r?\n|•|\u2022|;|\s{2,}/g)
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function listFromNewlines(v) {
  if (!v) return [];
  if (Array.isArray(v)) return listFromUnknown(v);
  const raw = String(v || "").replaceAll("\\r", "\r").replaceAll("\\n", "\n");
  const normalized = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h2|h3|h4)>\s*/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n");
  const text = decodeHtmlEntities(normalized.replace(/<[^>]*>/g, ""));
  if (!text) return [];
  const lines = text
    .split(/\r?\n/g)
    .map((x) => x.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  return listFromUnknown(text);
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
      .map((x) =>
        typeof x === "string"
          ? x
          : x?.url ||
            x?.src ||
            x?.source_url ||
            x?.guid?.rendered ||
            x?.image ||
            x?.full ||
            x?.sizes?.large ||
            x?.sizes?.medium_large ||
            x?.sizes?.medium ||
            x?.media_details?.sizes?.large?.source_url ||
            x?.media_details?.sizes?.medium_large?.source_url ||
            x?.media_details?.sizes?.medium?.source_url
      )
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }
  if (typeof v === "object") {
    const url =
      v.url ||
      v.src ||
      v.source_url ||
      v.guid?.rendered ||
      v.full ||
      v.sizes?.large ||
      v.sizes?.medium_large ||
      v.sizes?.medium ||
      v.media_details?.sizes?.large?.source_url ||
      v.media_details?.sizes?.medium_large?.source_url ||
      v.media_details?.sizes?.medium?.source_url;
    return url ? [String(url)] : [];
  }
  return [];
}

function normalizeMediaUrlKey(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  const noHash = raw.split("#")[0];
  return noHash;
}

function dedupeMediaUrls(urls) {
  const out = [];
  const seen = new Set();
  (urls || []).forEach((u) => {
    const url = String(u || "").trim();
    const key = normalizeMediaUrlKey(url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(url);
  });
  return out;
}

function derivePricing(pricing, { pax = 1 } = {}) {
  const p = pricing && typeof pricing === "object" ? pricing : {};
  const rootCurrency = normalizeCurrencyCode(p.currency);

  const packages = Array.isArray(p.packages) ? p.packages : Array.isArray(p.package_pricing) ? p.package_pricing : [];
  if (packages.length) {
    const entries = [];

    packages.forEach((pkg) => {
      const cats = pkg?.pricing?.categories;
      if (Array.isArray(cats) && cats.length) {
        cats.forEach((cat) => {
          const currency = normalizeCurrencyCode(cat?.currency) || rootCurrency;
          const regular = num(cat?.regular_price ?? cat?.base_price ?? cat?.original_price ?? null);
          const saleEnabled = Boolean(cat?.sale_enabled ?? cat?.enabled_sale ?? cat?.sale ?? false);
          const sale = num(cat?.sale_price ?? null);
          const actual = num(cat?.actual_price ?? cat?.price ?? cat?.cost ?? null);

          let price = null;
          if (saleEnabled && sale != null && sale > 0) price = sale;
          else if (sale != null && regular != null && sale > 0 && sale < regular) price = sale;
          else price = actual != null ? actual : sale != null ? sale : regular;

          const gp = Array.isArray(cat?.group_pricing) ? cat.group_pricing : [];
          if (gp.length) {
            const tier = gp.find((t) => {
              const from = num(t?.from);
              const to = num(t?.to);
              if (from == null || to == null) return false;
              return pax >= from && pax <= to;
            });
            const tierPrice = num(tier?.price);
            if (tierPrice != null && tierPrice > 0) price = tierPrice;
          }

          if (price != null || regular != null) entries.push({ price: price != null ? price : regular, regular, currency });
        });
        return;
      }

      const currency = normalizeCurrencyCode(pkg?.currency) || rootCurrency;
      const regular = num(pkg?.regular_price ?? pkg?.base_price ?? null);
      const sale = num(pkg?.sale_price ?? null);
      const actual = num(pkg?.actual_price ?? pkg?.price ?? pkg?.cost ?? null);
      const saleEnabled = Boolean(pkg?.sale_enabled ?? pkg?.enabled_sale ?? false);

      let price = null;
      if (saleEnabled && sale != null && sale > 0) price = sale;
      else if (sale != null && regular != null && sale > 0 && sale < regular) price = sale;
      else price = actual != null ? actual : sale != null ? sale : regular;

      if (price != null || regular != null) entries.push({ price: price != null ? price : regular, regular, currency });
    });

    const best = entries
      .filter((x) => x.price != null)
      .sort((a, b) => (a.price || 0) - (b.price || 0))[0];

    const price = best?.price != null ? best.price : 0;
    const oldPrice = best?.regular != null && best.regular > price ? best.regular : null;
    const currency = best?.currency || rootCurrency || "";
    return { price, oldPrice, currency };
  }

  const currency = rootCurrency;
  const sale = num(p.sale_price ?? null);
  const regular = num(p.regular_price ?? null);
  const actual = num(p.actual_price ?? p.from_price ?? p.price ?? p.cost ?? null);
  const base = num(p.base_price ?? p.original_price ?? null);

  if (sale != null && regular != null) {
    const price = sale > 0 ? sale : regular;
    const oldPrice = regular > price ? regular : null;
    return { price, oldPrice, currency };
  }

  if (actual != null && base != null) {
    const price = Math.min(actual, base);
    const oldPrice = Math.max(actual, base) > price ? Math.max(actual, base) : null;
    return { price, oldPrice, currency };
  }

  const price = sale != null ? sale : actual != null ? actual : base != null ? base : regular != null ? regular : 0;
  const oldPrice = regular != null && regular > price ? regular : null;
  return { price, oldPrice, currency };
}

function buildBadges({ featured, rating, reviewsCount, cancellation, instant }) {
  const badges = [];
  if (featured) badges.push("Best Seller");
  if (rating != null && reviewsCount != null && rating >= 4.8 && reviewsCount >= 40) badges.push("Top Rated");
  const c = String(cancellation || "").toLowerCase();
  if (c.includes("free") && c.includes("cancel")) badges.push("Free Cancellation");
  if (instant) badges.push("Instant Confirmation");
  return badges;
}

function pickFeaturedImage(trip) {
  const f = pick(trip, ["featured_image", "core.featured_image", "general.featured_image", "media.featured_image"], null);
  const urls = extractMediaUrls(f);
  return urls[0] || "";
}

function extractWpGalleryIds(settings, metaRoot) {
  const raw =
    pick(settings, ["wpte_gallery_id"], null) ||
    pick(metaRoot, ["wpte_gallery_id", "wp_travel_engine_setting.wpte_gallery_id"], null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out = [];
  Object.entries(raw).forEach(([k, v]) => {
    if (k === "enable") return;
    const n = num(v);
    if (n != null && n > 0) out.push(Math.floor(n));
  });
  return out;
}

function extractDestinationTerms(tax) {
  const obj = tax && typeof tax === "object" ? tax : {};
  const keys = ["locations", "location", "destinations", "destination", "places", "place"];
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v) && v.length) {
      return v
        .map((t) => String(t?.name || t?.label || t?.title || t || "").trim())
        .map((s) => decodeHtmlEntities(htmlToText(s)))
        .filter(Boolean);
    }
  }
  return [];
}

function normalizeDestinationName(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  const cleaned = decodeHtmlEntities(htmlToText(s)).trim();
  const key = cleaned.toLowerCase().replace(/\s+/g, " ").trim();
  const aliases = {
    "sharm el sheikh": "Sharm El Sheikh",
    "sharm el-sheikh": "Sharm El Sheikh",
    "sharm elsheikh": "Sharm El Sheikh",
    "sharm": "Sharm El Sheikh",
    "hurghada": "Hurghada",
    "cairo": "Cairo",
    "luxor": "Luxor",
    "aswan": "Aswan",
    "marsa alam": "Marsa Alam",
    "marsa alam ": "Marsa Alam",
    "dahab": "Dahab",
  };
  return aliases[key] || cleaned;
}

function buildDestinations({ taxDestinations, city }) {
  const cityNorm = normalizeDestinationName(city);
  const terms = Array.isArray(taxDestinations) ? taxDestinations.map(normalizeDestinationName).filter(Boolean) : [];
  const hasEgypt = terms.some((x) => x.toLowerCase() === "egypt");
  const filtered = terms.filter((x) => x.toLowerCase() !== "egypt");
  const all = [cityNorm, ...filtered].filter(Boolean);
  if (!all.length && hasEgypt) return ["Egypt"];
  return dedupeMediaUrls(all);
}

function pickPrimaryDestination(destinations) {
  const list = Array.isArray(destinations) ? destinations.map((x) => String(x || "").trim()).filter(Boolean) : [];
  if (!list.length) return "";
  const nonGeneric = list.find((x) => !["egypt"].includes(x.toLowerCase()));
  return nonGeneric || list[list.length - 1] || "";
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
  const html = pick(trip, ["core.content_html", "core.content.rendered", "core.content", "general.content", "content.rendered", "content"], "");
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
        title: String(s?.title || s?.itinerary_title || s?.label || s?.heading || "").trim(),
        description: htmlToText(s?.content || s?.itinerary_content || s?.description || s?.desc || ""),
      }))
      .filter((x) => x.title || x.description);
  }
  if (typeof v === "object") {
    const titleMap = v?.itinerary_title;
    const contentMap = v?.itinerary_content;
    const daysLabelMap = v?.itinerary_days_label;
    if (titleMap && typeof titleMap === "object" && contentMap && typeof contentMap === "object") {
      const keys = Array.from(
        new Set([
          ...Object.keys(titleMap || {}),
          ...Object.keys(contentMap || {}),
          ...Object.keys(daysLabelMap || {}),
        ])
      )
        .filter((k) => /^\d+$/.test(String(k)))
        .sort((a, b) => Number(a) - Number(b));
      const items = keys
        .map((k) => ({
          title: String(daysLabelMap?.[k] || titleMap?.[k] || `Day ${k}`).trim(),
          description: htmlToText(contentMap?.[k] || ""),
        }))
        .filter((x) => x.title || x.description);
      if (items.length) return items;
    }
  }
  const text = htmlToText(v);
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return lines.slice(0, 8).map((line, idx) => ({ title: `Stop ${idx + 1}`, description: line }));
}

export function mapWpTripToTour(trip) {
  const core = pick(trip, ["core"], {});
  const metaRoot = pick(trip, ["meta"], {});
  const settings = pick(trip, ["meta.wp_travel_engine_setting", "wp_travel_engine_setting"], {});
  const tax = pick(trip, ["taxonomies"], {});

  const id = String(pick(trip, ["core.id", "core.ID", "id", "ID"], "") || "");
  const titleRaw = pick(trip, ["core.title.rendered", "core.title", "title.rendered", "title", "general.title", "post_title"], "");
  const title = decodeHtmlEntities(htmlToText(titleRaw) || String(titleRaw || ""));
  const slugPicked = String(pick(trip, ["core.slug", "core.permalink_slug", "slug", "post_name"], "") || "");
  const slug = slugPicked || id;

  const city = String(pick(trip, ["general.location", "location"], "") || "");
  const destinations = buildDestinations({ taxDestinations: extractDestinationTerms(tax), city });
  const location = pickPrimaryDestination(destinations) || normalizeDestinationName(city);
  const category =
    firstTermName(tax, ["categories", "category", "activities", "activity", "trip_categories", "trip_category"]) ||
    String(pick(trip, ["general.category", "category"], "") || "");
  const type =
    firstTermName(tax, ["types", "type", "trip_types", "trip_type"]) || String(pick(trip, ["general.type", "type"], "") || "");

  const duration = parseDuration(pick(trip, ["general.duration", "duration"], ""), metaRoot);

  const rating = num(pick(trip, ["general.rating", "rating", "meta.rating", "core.rating"], null));
  const reviewsCount = num(pick(trip, ["general.reviewsCount", "general.reviews", "reviewsCount", "reviews", "meta.reviewsCount"], null));

  const pricing = derivePricing(pick(trip, ["pricing", "general.pricing", "meta.pricing"], {}), { pax: 1 });

  const featured = Boolean(pick(trip, ["general.featured", "featured", "core.featured", "meta.featured", "core.sticky"], false));
  const cancellation = String(pick(trip, ["general.cancellation", "cancellation", "meta.cancellation_policy", "meta.cancellation"], "") || "");

  const instant = Boolean(
    pick(trip, ["general.instant_confirmation", "general.instant", "meta.instant_confirmation", "meta.instant", "meta.booking.instant_confirmation"], false)
  );

  const badges = buildBadges({ featured, rating, reviewsCount, cancellation, instant });

  const image = pickFeaturedImage(trip);
  const featuredImageId = Math.floor(
    num(pick(trip, ["featured_image.id", "featured_image.ID", "core.featured_image.id", "meta._thumbnail_id"], null)) || 0
  );
  const referencedMediaIds = Array.isArray(metaRoot?.referenced_media_ids)
    ? metaRoot.referenced_media_ids
        .map((x) => Math.floor(num(x) || 0))
        .filter((x) => Number.isFinite(x) && x > 0)
    : [];
  const galleryIds = Array.from(new Set([...extractWpGalleryIds(settings, metaRoot), ...referencedMediaIds])).filter(
    (x) => x !== featuredImageId
  );
  const galleryRaw = [
    ...extractMediaUrls(pick(trip, ["gallery", "general.gallery", "media.gallery"], null)),
    ...extractMediaUrls(pick(trip, ["core.gallery", "meta.gallery"], null)),
  ].filter(Boolean);
  const gallery = dedupeMediaUrls(galleryRaw);

  const fullDescription = pickContent(trip);
  const excerpt = pickExcerpt(trip);
  const shortDescription = truncate(excerpt || htmlToText(fullDescription) || "", 160);

  const highlights = listFromUnknown(pick(settings, ["trip_highlights", "highlights"], null)).slice(0, 10);
  const includedRaw =
    pick(settings, ["cost.cost_includes"], null) ||
    pick(trip, ["general.raw.cost.cost_includes", "pricing.raw.settings.cost.cost_includes", "general.raw.settings.cost.cost_includes"], null);
  const excludedRaw =
    pick(settings, ["cost.cost_excludes"], null) ||
    pick(trip, ["general.raw.cost.cost_excludes", "pricing.raw.settings.cost.cost_excludes", "general.raw.settings.cost.cost_excludes"], null);
  const included = listFromNewlines(includedRaw).slice(0, 16);
  const excluded = listFromNewlines(excludedRaw).slice(0, 16);
  const itinerary = normalizeItinerary(pick(settings, ["trip_itinerary", "itinerary"], null)).slice(0, 10);

  const ordered = dedupeMediaUrls([image, ...gallery]);
  const primaryImage = ordered[0] || fallbackImageByLocation(location);
  const safeGallery = ordered.length ? ordered : primaryImage ? [primaryImage] : [];

  return {
    id,
    title,
    slug,
    location,
    destinations,
    category,
    duration,
    rating,
    reviewsCount,
    price: pricing.price || 0,
    oldPrice: pricing.oldPrice,
    currency: pricing.currency || "",
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
    _mediaIds: {
      featuredImageId: featuredImageId > 0 ? featuredImageId : null,
      galleryIds,
    },
  };
}

export function mapTripsResponseToTours(data) {
  const root = data && typeof data === "object" ? data : {};
  const list =
    Array.isArray(data) ? data : Array.isArray(root.trips) ? root.trips : Array.isArray(root.items) ? root.items : Array.isArray(root.data) ? root.data : [];
  return list.map(mapWpTripToTour).filter((t) => t && t.slug);
}
