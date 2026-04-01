import { getRelatedTours, getTourBySlug } from "./toursRepository.js";
import { getDecisionCues } from "./decision.js";
import { buildBookingUrl, createBadge, createTourCard, formatPrice, initHeader, qs, qsa, renderStars } from "./ui.js";

function buildWhatsAppLink({ phoneE164Digits, text }) {
  const base = `https://wa.me/${phoneE164Digits}`;
  const params = new URLSearchParams({ text });
  return `${base}?${params.toString()}`;
}

function mountList(host, items) {
  host.innerHTML = "";
  (items || []).forEach((x) => {
    const li = document.createElement("li");
    li.textContent = x;
    host.appendChild(li);
  });
}

function mountItinerary(host, items) {
  host.innerHTML = "";
  (items || []).forEach((s, idx) => {
    const card = document.createElement("li");
    const title = document.createElement("strong");
    const num = document.createElement("span");
    num.className = "timeline__num";
    num.textContent = String(idx + 1);
    const label = document.createElement("span");
    label.textContent = s.title;
    title.appendChild(num);
    title.appendChild(label);
    const desc = document.createElement("div");
    desc.className = "muted";
    desc.style.marginTop = "6px";
    desc.textContent = s.description || "";
    card.appendChild(title);
    card.appendChild(desc);
    host.appendChild(card);
  });
}

function buildMockReviews(tour) {
  const names = ["Maya", "Omar", "Sofia", "Daniel", "Noura", "James"];
  const topics = [
    "Great guide and clear explanations.",
    "Smooth pickup and the timing was perfect.",
    "Loved the photo stops and local tips.",
    "Felt safe and well organized.",
    "Worth every dollar — would book again.",
    "Exactly as described with no surprises.",
  ];
  const base = Math.max(4.2, Math.min(5, Number(tour.rating) || 4.7));
  return Array.from({ length: 3 }).map((_, i) => {
    const rating = Math.max(4.0, Math.min(5, base - i * 0.1));
    return {
      name: names[(tour.slug.length + i) % names.length],
      rating,
      text: topics[(tour.id.length + i) % topics.length],
    };
  });
}

async function init() {
  initHeader();

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") || "";
  const tour = await getTourBySlug(slug);

  if (!tour) {
    const main = qs("#main .container");
    main.innerHTML = `<div class="empty"><div class="empty__title">Tour not found</div><div class="empty__text">Return to the tours page and pick an experience.</div><div style="margin-top:14px"><a class="btn btn--primary" href="tours.html">Browse tours</a></div></div>`;
    return;
  }

  document.title = `${tour.title} — FTS Travels v2`;

  const breadcrumbTitle = qs("[data-breadcrumb-title]");
  if (breadcrumbTitle) breadcrumbTitle.textContent = tour.title;

  qs("[data-title]").textContent = tour.title;

  const meta = qs("[data-meta]");
  meta.textContent = `${tour.location} • ${tour.duration?.label || ""} • ${tour.category}`.replace(/\s+•\s+$/, "");

  const ratingHost = qs("[data-rating]");
  ratingHost.innerHTML = "";
  ratingHost.appendChild(renderStars(tour.rating));
  const r = document.createElement("span");
  r.style.fontWeight = "800";
  r.style.marginLeft = "8px";
  r.textContent = `${(Number(tour.rating) || 0).toFixed(1)} (${Number(tour.reviewsCount) || 0})`;
  ratingHost.appendChild(r);

  const badges = qs("[data-badges]");
  badges.innerHTML = "";
  (tour.badges || []).forEach((b) => badges.appendChild(createBadge(b)));

  qs("[data-description]").textContent = tour.fullDescription || "";
  qs("[data-cancellation]").textContent = tour.cancellation || "";

  mountList(qs("[data-highlights]"), tour.highlights);
  mountList(qs("[data-included]"), tour.included);
  mountList(qs("[data-excluded]"), tour.excluded);
  mountItinerary(qs("[data-itinerary]"), tour.itinerary);

  const price = qs("[data-price]");
  price.textContent = formatPrice(tour.price);

  const old = qs("[data-old-price]");
  if (tour.oldPrice && tour.oldPrice > tour.price) old.textContent = formatPrice(tour.oldPrice);
  else old.textContent = "";

  const cues = getDecisionCues(tour);
  const urgency = qs("[data-urgency]");
  if (urgency) urgency.textContent = `${cues.urgencyLabel} • ${cues.proofLine}`;

  const mainImg = qs("[data-gallery-main]");
  const thumbs = qs("[data-gallery-thumbs]");
  const imgs = Array.isArray(tour.gallery) && tour.gallery.length ? tour.gallery : [tour.image].filter(Boolean);

  const setMain = (src) => {
    mainImg.src = src;
    mainImg.alt = tour.title;
    qsa(".thumb", thumbs).forEach((t) => t.setAttribute("aria-current", "false"));
    const active = qsa(".thumb", thumbs).find((el) => el.getAttribute("data-src") === src);
    if (active) active.setAttribute("aria-current", "true");
  };

  thumbs.innerHTML = "";
  imgs.forEach((src, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "thumb";
    b.setAttribute("data-src", src);
    b.setAttribute("aria-current", idx === 0 ? "true" : "false");
    const i = document.createElement("img");
    i.loading = "lazy";
    i.alt = "";
    i.src = src;
    b.appendChild(i);
    b.addEventListener("click", () => setMain(src));
    thumbs.appendChild(b);
  });
  setMain(imgs[0]);

  const box = qs("[data-booking-box]");
  const whatsapp = qs("[data-whatsapp]");

  const syncWhatsApp = () => {
    if (!whatsapp) return;
    const date = qs("input[name='date']", box)?.value || "";
    const travelers = qs("input[name='travelers']", box)?.value || "2";
    const msg = [
      "Hi FTS Travels, quick question about this tour:",
      `• Tour: ${tour.title}`,
      date ? `• Date: ${date}` : null,
      travelers ? `• Travelers: ${travelers}` : null,
      `• Link: ${window.location.href}`,
    ]
      .filter(Boolean)
      .join("\n");
    whatsapp.href = buildWhatsAppLink({ phoneE164Digits: "201000000000", text: msg });
  };

  qsa("input", box).forEach((el) => el.addEventListener("input", syncWhatsApp));
  syncWhatsApp();

  box.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = qs("input[name='date']", box)?.value || "";
    const travelers = qs("input[name='travelers']", box)?.value || "1";
    window.location.href = buildBookingUrl(tour, { date, travelers });
  });

  const relatedHost = qs("[data-related]");
  relatedHost.innerHTML = "";
  (await getRelatedTours(tour.slug, 4)).forEach((t) => relatedHost.appendChild(createTourCard(t, { compact: true })));

  const reviewsHost = qs("[data-reviews]");
  reviewsHost.innerHTML = "";
  buildMockReviews(tour).forEach((rev) => {
    const el = document.createElement("div");
    el.className = "review";
    const title = document.createElement("strong");
    title.textContent = `${rev.name} • ${(Number(rev.rating) || 0).toFixed(1)}`;
    const stars = renderStars(rev.rating);
    stars.style.marginTop = "6px";
    const p = document.createElement("p");
    p.textContent = rev.text;
    el.appendChild(title);
    el.appendChild(stars);
    el.appendChild(p);
    reviewsHost.appendChild(el);
  });
}

document.addEventListener("DOMContentLoaded", init);

