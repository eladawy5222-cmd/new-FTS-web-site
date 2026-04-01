import { matchesSearch } from "./search.js";

export function buildFacetOptions(tours) {
  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));

  return {
    locations: uniq(tours.map((t) => t.location)),
    categories: uniq(tours.map((t) => t.category)),
    types: uniq(tours.map((t) => t.type)),
    price: {
      min: Math.floor(Math.min(...tours.map((t) => Number(t.price) || 0))),
      max: Math.ceil(Math.max(...tours.map((t) => Number(t.price) || 0))),
    },
  };
}

export function parseStateFromParams(params) {
  const num = (v, fallback = null) => {
    if (v == null || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    q: params.get("q") || "",
    location: params.get("location") || "",
    category: params.get("category") || "",
    type: params.get("type") || "",
    ratingMin: num(params.get("ratingMin"), 0),
    duration: params.get("duration") || "",
    priceMin: num(params.get("priceMin"), null),
    priceMax: num(params.get("priceMax"), null),
    sort: params.get("sort") || "recommended",
  };
}

export function filterTours(tours, state) {
  return tours.filter((t) => {
    if (!matchesSearch(t, state.q)) return false;
    if (state.location && t.location !== state.location) return false;
    if (state.category && t.category !== state.category) return false;
    if (state.type && t.type !== state.type) return false;
    if (Number(state.ratingMin) && Number(t.rating) < Number(state.ratingMin)) return false;

    if (state.duration) {
      const h = Number(t.duration?.hours) || 0;
      const d = Number(t.duration?.days) || 0;
      const totalHours = d ? d * 24 : h;

      if (state.duration === "lt3" && !(totalHours > 0 && totalHours < 3)) return false;
      if (state.duration === "3to6" && !(totalHours >= 3 && totalHours <= 6)) return false;
      if (state.duration === "6to10" && !(totalHours > 6 && totalHours <= 10)) return false;
      if (state.duration === "10plus" && !(totalHours > 10)) return false;
      if (state.duration === "multiday" && !(d >= 1)) return false;
    }

    const price = Number(t.price) || 0;
    if (state.priceMin != null && price < state.priceMin) return false;
    if (state.priceMax != null && price > state.priceMax) return false;

    return true;
  });
}

export function sortTours(tours, sortKey) {
  const by = [...tours];
  if (sortKey === "topRated") {
    by.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0) || (Number(b.reviewsCount) || 0) - (Number(a.reviewsCount) || 0));
    return by;
  }
  if (sortKey === "priceLow") {
    by.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    return by;
  }
  if (sortKey === "newest") {
    by.sort((a, b) => String(b.id).localeCompare(String(a.id)));
    return by;
  }

  by.sort((a, b) => {
    const af = a.featured ? 1 : 0;
    const bf = b.featured ? 1 : 0;
    if (bf !== af) return bf - af;
    return (Number(b.rating) || 0) - (Number(a.rating) || 0);
  });
  return by;
}

