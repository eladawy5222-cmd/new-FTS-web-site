function str(v) {
  return String(v == null ? "" : v).trim();
}

function obj(v) {
  return v && typeof v === "object" ? v : null;
}

export function getAirtableConfig() {
  const w = typeof window !== "undefined" ? window : null;
  const fromObj = obj(w?.FTS_AIRTABLE);

  const baseId = str(fromObj?.baseId || w?.FTS_AIRTABLE_BASE_ID);
  const table = str(fromObj?.table || w?.FTS_AIRTABLE_TABLE);
  const view = str(fromObj?.view || w?.FTS_AIRTABLE_VIEW);
  const token = str(fromObj?.token || w?.FTS_AIRTABLE_TOKEN);
  const proxyUrl = str(fromObj?.proxyUrl || w?.FTS_AIRTABLE_PROXY_URL);

  const fields = obj(fromObj?.fields) || {};
  const mergedFields = {
    id: fields.id || "id",
    title: fields.title || "title",
    slug: fields.slug || "slug",
    location: fields.location || "location",
    category: fields.category || "category",
    duration: fields.duration || "duration",
    rating: fields.rating || "rating",
    reviewsCount: fields.reviewsCount || "reviewsCount",
    price: fields.price || "price",
    oldPrice: fields.oldPrice || "oldPrice",
    badges: fields.badges || "badges",
    image: fields.image || "image",
    gallery: fields.gallery || "gallery",
    shortDescription: fields.shortDescription || "shortDescription",
    fullDescription: fields.fullDescription || "fullDescription",
    highlights: fields.highlights || "highlights",
    included: fields.included || "included",
    excluded: fields.excluded || "excluded",
    itinerary: fields.itinerary || "itinerary",
    cancellation: fields.cancellation || "cancellation",
    type: fields.type || "type",
    featured: fields.featured || "featured",
  };

  return {
    baseId,
    table,
    view,
    token,
    proxyUrl,
    fields: mergedFields,
  };
}

export function isAirtableConfigured() {
  const c = getAirtableConfig();
  return Boolean(c.baseId && c.table && (c.proxyUrl || c.token));
}

