import { getTourBySlug } from "./toursRepository.js";
import { formatPrice, initHeader, qs, renderStars } from "./ui.js";

function safeNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildWhatsAppLink({ phoneE164Digits, text }) {
  const base = `https://wa.me/${phoneE164Digits}`;
  const params = new URLSearchParams({ text });
  return `${base}?${params.toString()}`;
}

async function init() {
  initHeader();

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") || "";
  const tour = await getTourBySlug(slug);

  if (!tour) {
    const main = qs("#main .container");
    main.innerHTML = `<div class="empty"><div class="empty__title">Booking not available</div><div class="empty__text">Choose a tour first, then continue to booking.</div><div style="margin-top:14px"><a class="btn btn--primary" href="tours.html">Browse tours</a></div></div>`;
    return;
  }

  document.title = `Booking — ${tour.title} — FTS Travels v2`;

  const back = qs("[data-back-to-tour]");
  back.href = `tour-details.html?slug=${encodeURIComponent(tour.slug)}`;
  back.textContent = tour.title;

  qs("[data-tour-title]").textContent = tour.title;
  qs("[data-tour-meta]").textContent = `${tour.location} • ${tour.duration?.label || ""} • ${tour.category}`.replace(/\s+•\s+$/, "");

  const ratingHost = qs("[data-tour-rating]");
  ratingHost.innerHTML = "";
  ratingHost.appendChild(renderStars(tour.rating));
  const ratingText = document.createElement("span");
  ratingText.className = "muted";
  ratingText.style.marginLeft = "8px";
  ratingText.textContent = `${(Number(tour.rating) || 0).toFixed(1)} (${Number(tour.reviewsCount) || 0})`;
  ratingHost.appendChild(ratingText);

  qs("[data-price-each]").textContent = formatPrice(tour.price);
  qs("[data-cancellation]").textContent = tour.cancellation || "Cancellation policy will be shown here.";

  const form = qs("[data-booking-form]");
  const dateEl = qs("input[name='date']", form);
  const travelersEl = qs("input[name='travelers']", form);

  const initialDate = params.get("date") || "";
  const initialTravelers = safeNumber(params.get("travelers"), 2);
  if (initialDate) dateEl.value = initialDate;
  travelersEl.value = String(Math.max(1, Math.round(initialTravelers)));

  const whatsapp = qs("[data-whatsapp]");

  const sync = () => {
    const travelers = Math.max(1, Math.round(safeNumber(travelersEl.value, 1)));
    const date = dateEl.value || "";

    qs("[data-travelers]").textContent = String(travelers);
    qs("[data-date]").textContent = date || "—";
    qs("[data-total]").textContent = formatPrice((Number(tour.price) || 0) * travelers);

    const msg = [
      "Hi FTS Travels, I'd like to book:",
      `• Tour: ${tour.title}`,
      date ? `• Date: ${date}` : null,
      `• Travelers: ${travelers}`,
      `• Link: ${window.location.href}`,
    ]
      .filter(Boolean)
      .join("\n");

    whatsapp.href = buildWhatsAppLink({ phoneE164Digits: "201000000000", text: msg });

    const url = new URL(window.location.href);
    url.searchParams.set("slug", tour.slug);
    if (date) url.searchParams.set("date", date);
    else url.searchParams.delete("date");
    url.searchParams.set("travelers", String(travelers));
    history.replaceState({}, "", url.toString());
  };

  dateEl.addEventListener("change", sync);
  travelersEl.addEventListener("input", sync);
  sync();

  const success = qs("[data-success]");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    sync();
    const name = (qs("input[name='fullName']", form).value || "").trim();
    const date = dateEl.value || "";
    const travelers = Math.max(1, Math.round(safeNumber(travelersEl.value, 1)));
    success?.classList?.remove("is-hidden");
    if (success) success.textContent = `Thanks${name ? `, ${name}` : ""}! Your reservation for ${travelers} traveler${
      travelers === 1 ? "" : "s"
    }${date ? ` on ${date}` : ""} has been prepared. Use the WhatsApp button to confirm details with our team.`;
    success?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  });
}

document.addEventListener("DOMContentLoaded", init);

