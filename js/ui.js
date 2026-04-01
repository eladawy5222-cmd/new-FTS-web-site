import { getDecisionCues } from "./decision.js";
import { getDisplayCurrency } from "./config.js";

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function formatPrice(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  const code = String(currency || getDisplayCurrency() || "USD")
    .trim()
    .toUpperCase();
  const safe = /^[A-Z]{3}$/.test(code) ? code : "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: safe, maximumFractionDigits: 0 }).format(n);
  } catch {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  }
}

export function clamp(num, min, max) {
  return Math.min(max, Math.max(min, num));
}

export function renderStars(rating, { max = 5 } = {}) {
  const r = clamp(Number(rating) || 0, 0, max);
  const full = Math.floor(r);
  const half = r - full >= 0.5 ? 1 : 0;
  const empty = max - full - half;

  const wrap = document.createElement("span");
  wrap.className = "stars";
  wrap.setAttribute("aria-label", `${r.toFixed(1)} out of ${max}`);

  const make = (kind) => {
    const s = document.createElement("span");
    s.className = `star star--${kind}`;
    s.textContent = "★";
    return s;
  };

  for (let i = 0; i < full; i++) wrap.appendChild(make("full"));
  for (let i = 0; i < half; i++) wrap.appendChild(make("half"));
  for (let i = 0; i < empty; i++) wrap.appendChild(make("empty"));
  return wrap;
}

export function createBadge(label) {
  const el = document.createElement("span");
  const text = String(label || "").trim();
  const key = text.toLowerCase();
  const kinds = [];
  if (key.includes("best seller")) kinds.push("badge--best");
  if (key.includes("top rated")) kinds.push("badge--top");
  if (key.includes("free cancellation")) kinds.push("badge--cancel");
  if (key.includes("instant confirmation")) kinds.push("badge--instant");
  if (key === "new") kinds.push("badge--new");

  el.className = `badge${kinds.length ? ` ${kinds.join(" ")}` : ""}`;
  el.textContent = text;
  return el;
}

export function buildTourUrl(tour) {
  return `tour-details.html?slug=${encodeURIComponent(tour.slug)}`;
}

export function buildBookingUrl(tour, { date = "", travelers = "" } = {}) {
  const params = new URLSearchParams({ slug: tour.slug });
  if (date) params.set("date", date);
  if (travelers) params.set("travelers", String(travelers));
  return `booking.html?${params.toString()}`;
}

export function createTourCard(tour, { compact = false } = {}) {
  const card = document.createElement("article");
  card.className = `tour-card${compact ? " tour-card--compact" : ""}`;

  const link = document.createElement("a");
  link.className = "tour-card__link";
  link.href = buildTourUrl(tour);
  link.setAttribute("aria-label", tour.title);

  const media = document.createElement("div");
  media.className = "tour-card__media";

  const img = document.createElement("img");
  img.className = "tour-card__img";
  img.loading = "lazy";
  img.alt = tour.title;
  img.src = tour.image;
  media.appendChild(img);

  if (Array.isArray(tour.badges) && tour.badges.length) {
    const badges = document.createElement("div");
    badges.className = "tour-card__badges";
    tour.badges.slice(0, 3).forEach((b) => badges.appendChild(createBadge(b)));
    media.appendChild(badges);
  }

  const body = document.createElement("div");
  body.className = "tour-card__body";

  const cues = getDecisionCues(tour);

  const top = document.createElement("div");
  top.className = "tour-card__top";

  const title = document.createElement("h3");
  title.className = "tour-card__title";
  title.textContent = tour.title;

  const pricePill = document.createElement("div");
  pricePill.className = "tour-card__pricepill";
  pricePill.innerHTML = `<span class="tour-card__from">From</span><span class="tour-card__amount">${escapeHtml(
    formatPrice(tour.price, tour.currency)
  )}</span>`;
  if (tour.oldPrice && tour.oldPrice > tour.price) {
    const old = document.createElement("span");
    old.className = "tour-card__old";
    old.textContent = formatPrice(tour.oldPrice, tour.currency);
    pricePill.appendChild(old);
  }

  top.appendChild(title);
  top.appendChild(pricePill);

  const meta = document.createElement("div");
  meta.className = "tour-card__meta";
  meta.textContent = `${tour.location} • ${tour.category}`.replace(/\s+•\s+$/, "");

  const facts = document.createElement("div");
  facts.className = "tour-card__facts";

  const addFact = (text) => {
    const p = document.createElement("span");
    p.className = "info-pill";
    p.textContent = text;
    facts.appendChild(p);
  };

  const ratingNum = Number(tour.rating);
  const reviewsNum = Number(tour.reviewsCount);
  const hasReviews = Number.isFinite(ratingNum) && ratingNum > 0 && Number.isFinite(reviewsNum) && reviewsNum > 0;
  if (hasReviews) {
    const ratingPill = document.createElement("div");
    ratingPill.className = "rating-pill";
    const ratingStar = document.createElement("span");
    ratingStar.className = "rating-pill__star";
    ratingStar.textContent = "★";
    const ratingValue = document.createElement("span");
    ratingValue.className = "rating-pill__value";
    ratingValue.textContent = ratingNum.toFixed(1);
    const ratingCount = document.createElement("span");
    ratingCount.className = "rating-pill__count";
    ratingCount.textContent = `${reviewsNum.toLocaleString()} reviews`;
    ratingPill.appendChild(ratingStar);
    ratingPill.appendChild(ratingValue);
    ratingPill.appendChild(ratingCount);
    facts.appendChild(ratingPill);
  } else {
    addFact("New");
  }
  if (tour.duration?.label) addFact(tour.duration.label);
  if (tour.type) addFact(tour.type);

  const ratingRow = document.createElement("div");
  ratingRow.className = "tour-card__rating";

  const stars = renderStars(tour.rating);
  const score = document.createElement("span");
  score.className = "tour-card__score";
  score.textContent = (Number(tour.rating) || 0).toFixed(1);

  const reviews = document.createElement("span");
  reviews.className = "tour-card__reviews";
  reviews.textContent = `(${Number(tour.reviewsCount) || 0})`;

  ratingRow.appendChild(stars);
  ratingRow.appendChild(score);
  ratingRow.appendChild(reviews);

  const proof = document.createElement("div");
  proof.className = `tour-card__proof tour-card__proof--${cues.urgencyLevel}`;
  proof.textContent = `${cues.urgencyLabel} • ${cues.proofLine}${
    cues.urgencyLevel === "high" ? ` • ${cues.viewingNow} viewing now` : ""
  }`;

  const desc = document.createElement("p");
  desc.className = "tour-card__desc";
  desc.textContent = tour.shortDescription || "";

  body.appendChild(top);
  body.appendChild(meta);
  body.appendChild(facts);
  if (compact && hasReviews) body.appendChild(ratingRow);
  body.appendChild(proof);
  if (!compact) body.appendChild(desc);

  link.appendChild(media);
  link.appendChild(body);
  card.appendChild(link);

  const actions = document.createElement("div");
  actions.className = "tour-card__actions";

  const btn = document.createElement("a");
  btn.className = "btn btn--primary btn--block";
  btn.href = buildBookingUrl(tour);
  btn.textContent = "Reserve";

  const details = document.createElement("a");
  details.className = "btn btn--ghost btn--block";
  details.href = buildTourUrl(tour);
  details.textContent = "Details";

  actions.appendChild(btn);
  actions.appendChild(details);
  card.appendChild(actions);

  return card;
}

export function mountTourGrid(container, items, { emptyMessage = "No tours match your filters.", onReset } = {}) {
  container.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = `<div class="empty__title">No results</div><div class="empty__text">${escapeHtml(emptyMessage)}</div>`;
    if (typeof onReset === "function") {
      const actions = document.createElement("div");
      actions.className = "empty__actions";
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "btn btn--primary";
      reset.textContent = "Reset filters";
      reset.addEventListener("click", onReset);
      const browse = document.createElement("a");
      browse.className = "btn btn--ghost";
      browse.href = "tours.html";
      browse.textContent = "Browse all";
      actions.appendChild(reset);
      actions.appendChild(browse);
      empty.appendChild(actions);
    }
    container.appendChild(empty);
    return;
  }
  items.forEach((t) => container.appendChild(createTourCard(t)));
}

export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function initHeader() {
  const toggle = qs("[data-nav-toggle]");
  const nav = qs("[data-nav]");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.getAttribute("data-open") === "true";
      nav.setAttribute("data-open", String(!open));
      toggle.setAttribute("aria-expanded", String(!open));
    });
  }

  const year = qs("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  const searchForm = qs("[data-header-search]");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = qs("input[name='q']", searchForm);
      const q = (input?.value || "").trim();
      const url = new URL("tours.html", window.location.href);
      if (q) url.searchParams.set("q", q);
      window.location.href = url.toString();
    });
  }
}

export function setFormFromParams(form, params) {
  qsa("input, select, textarea", form).forEach((el) => {
    const name = el.getAttribute("name");
    if (!name) return;
    const v = params.get(name);
    if (v == null) return;
    if (el.type === "checkbox") {
      el.checked = v === "1" || v === "true" || v === "on";
    } else {
      el.value = v;
    }
  });
}

export function updateParamsFromForm(params, form, { allowEmpty = false } = {}) {
  qsa("input, select, textarea", form).forEach((el) => {
    const name = el.getAttribute("name");
    if (!name) return;
    let v = "";
    if (el.type === "checkbox") v = el.checked ? "1" : "";
    else v = (el.value || "").trim();
    if (v || allowEmpty) params.set(name, v);
    else params.delete(name);
  });
}
