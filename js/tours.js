import { buildBookingUrl, buildTourUrl, createTourCard, escapeHtml, initHeader, mountTourGrid, qs, qsa, setFormFromParams, updateParamsFromForm } from "./ui.js";
import { buildFacetOptions, filterTours, parseStateFromParams, sortTours } from "./filters.js";
import { getDisplayCurrency } from "./config.js";
import { initCustomSelects } from "./select.js";
import { getTours } from "./toursRepository.js";
import { getDecisionCues } from "./decision.js";

function fillSelect(select, values, { placeholder = "Any" } = {}) {
  if (!select) return;
  select.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  select.appendChild(opt0);
  values.forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}

function renderActiveChips(state, host, { onClearOne, onClearAll } = {}) {
  host.innerHTML = "";
  const chips = [];
  const currency = getDisplayCurrency();

  const add = (label, key) => {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "chip";
    c.textContent = label;
    c.addEventListener("click", () => onClearOne?.(key));
    chips.push(c);
  };

  if (state.q) add(`Search: ${state.q}`, "q");
  if (state.location) add(`Location: ${state.location}`, "location");
  if (state.category) add(`Category: ${state.category}`, "category");
  if (state.type) add(`Type: ${state.type}`, "type");
  if (Number(state.ratingMin)) add(`Rating: ${state.ratingMin}+`, "ratingMin");
  if (state.duration) add(`Duration: ${durationLabel(state.duration)}`, "duration");
  if (state.priceMin != null) add(`Min: ${currency} ${state.priceMin}`, "priceMin");
  if (state.priceMax != null) add(`Max: ${currency} ${state.priceMax}`, "priceMax");

  if (!chips.length) {
    const p = document.createElement("div");
    p.className = "muted";
    p.textContent = "Tip: Use filters to find the perfect experience.";
    host.appendChild(p);
    return;
  }

  chips.forEach((c) => host.appendChild(c));

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "chip chip--clear";
  clear.textContent = "Clear all";
  clear.addEventListener("click", () => onClearAll?.());
  host.appendChild(clear);
}

function durationLabel(code) {
  return (
    {
      lt3: "< 3h",
      "3to6": "3–6h",
      "6to10": "6–10h",
      "10plus": "10h+",
      multiday: "Multi-day",
    }[code] || code
  );
}

function setParam(params, key, value) {
  if (value == null || value === "" || value === "0") params.delete(key);
  else params.set(key, String(value));
}

function renderTopPick(host, tour) {
  if (!host) return;
  if (!tour) {
    host.classList.add("is-hidden");
    host.innerHTML = "";
    return;
  }

  host.classList.remove("is-hidden");
  const cues = getDecisionCues(tour);
  const detailsUrl = buildTourUrl(tour);
  const bookingUrl = buildBookingUrl(tour);
  host.innerHTML = `<strong>Top pick:</strong> <a href="${escapeHtml(detailsUrl)}">${escapeHtml(
    tour.title
  )}</a> <span class="muted">• ${escapeHtml(cues.urgencyLabel)} • ${escapeHtml(cues.proofLine)}</span><div class="trust-inline mt-16"><a class="pill-link" href="${escapeHtml(
    bookingUrl
  )}">Book now</a><a class="pill-link" href="${escapeHtml(detailsUrl)}">See details</a></div>`;
}

async function init() {
  initHeader();

  const allTours = await getTours();
  const facets = buildFacetOptions(allTours);

  const form = qs("[data-filters-form]");
  const grid = qs("[data-tours-grid]");
  const gridHost = grid?.parentElement;
  const count = qs("[data-results-count]");
  const active = qs("[data-active-filters]");
  const topPick = qs("[data-top-pick]");
  const sortSelects = qsa("[data-sort]");

  const PAGE_SIZE = 12;
  let visibleCount = PAGE_SIZE;
  let renderedCount = 0;
  let currentKey = "";
  let currentSorted = [];

  const loadMoreWrap = document.createElement("div");
  loadMoreWrap.className = "load-more";
  const loadMoreBtn = document.createElement("button");
  loadMoreBtn.type = "button";
  loadMoreBtn.className = "btn btn--ghost";
  loadMoreBtn.textContent = "Load more";
  loadMoreWrap.appendChild(loadMoreBtn);
  if (gridHost) gridHost.appendChild(loadMoreWrap);

  const updateLoadMore = () => {
    const remaining = Math.max(0, currentSorted.length - visibleCount);
    if (remaining <= 0) {
      loadMoreWrap.style.display = "none";
      return;
    }
    loadMoreWrap.style.display = "flex";
    loadMoreBtn.textContent = `Load more (${Math.min(PAGE_SIZE, remaining)} of ${remaining} remaining)`;
  };

  const renderIncremental = ({ reset = false, onReset } = {}) => {
    if (!grid) return;
    if (!currentSorted.length) {
      mountTourGrid(grid, [], { onReset });
      renderedCount = 0;
      loadMoreWrap.style.display = "none";
      return;
    }

    const target = Math.min(visibleCount, currentSorted.length);
    if (reset) {
      grid.innerHTML = "";
      renderedCount = 0;
    }

    const frag = document.createDocumentFragment();
    for (let i = renderedCount; i < target; i++) frag.appendChild(createTourCard(currentSorted[i]));
    grid.appendChild(frag);
    renderedCount = target;
    updateLoadMore();
  };

  loadMoreBtn.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    renderIncremental({ reset: false });
  });

  fillSelect(qs("select[name='location']", form), facets.locations, { placeholder: "All locations" });
  fillSelect(qs("select[name='category']", form), facets.categories, { placeholder: "All categories" });
  fillSelect(qs("select[name='type']", form), facets.types, { placeholder: "Any type" });
  initCustomSelects();

  const url = new URL(window.location.href);
  const params = url.searchParams;
  const initialState = parseStateFromParams(params);

  if (initialState.priceMin == null && initialState.priceMax == null) {
    const minHint = qs("[data-price-min-hint]");
    const maxHint = qs("[data-price-max-hint]");
    if (minHint) minHint.textContent = String(facets.price.min);
    if (maxHint) maxHint.textContent = String(facets.price.max);
  }

  setFormFromParams(form, params);

  const setAllSorts = (value) => sortSelects.forEach((s) => (s.value = value));
  setAllSorts(initialState.sort || "recommended");

  const drawer = qs("[data-filters-drawer]");
  const drawerBody = qs("[data-filters-drawer-body]");
  const panelBody = qs("[data-filters-panel-body]");
  const openBtns = qsa("[data-open-filters]");
  const closeBtns = qsa("[data-close-filters]");

  const closeDrawer = () => {
    if (!drawer) return;
    if (drawerBody && panelBody && form && drawerBody.contains(form)) panelBody.appendChild(form);
    drawer.setAttribute("data-open", "false");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  };

  const openDrawer = () => {
    if (!drawer) return;
    if (drawerBody && panelBody && form && panelBody.contains(form)) drawerBody.appendChild(form);
    drawer.setAttribute("data-open", "true");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    const first = qs("input, select, textarea, button", form);
    first?.focus?.();
  };

  if (drawer) {
    openBtns.forEach((b) => b.addEventListener("click", openDrawer));
    closeBtns.forEach((b) => b.addEventListener("click", closeDrawer));
    drawer.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.matches && t.matches("[data-close-filters]")) closeDrawer();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    });
    window.addEventListener("resize", () => {
      if (window.matchMedia("(min-width: 721px)").matches) closeDrawer();
    });
  }

  const apply = () => {
    const url2 = new URL(window.location.href);
    const p2 = url2.searchParams;
    updateParamsFromForm(p2, form);
    if (p2.get("ratingMin") === "0") p2.delete("ratingMin");
    const sortValue = sortSelects[0]?.value || "recommended";
    setParam(p2, "sort", sortValue);

    const state = parseStateFromParams(p2);
    const filtered = filterTours(allTours, state);
    const sorted = sortTours(filtered, state.sort);

    count.textContent = `${sorted.length} tour${sorted.length === 1 ? "" : "s"}`;
    const newKey = p2.toString();
    const changed = newKey !== currentKey;
    if (changed) {
      currentKey = newKey;
      visibleCount = PAGE_SIZE;
      currentSorted = sorted;
      renderIncremental({
        reset: true,
        onReset: () => {
          form.reset();
          setAllSorts("recommended");
          apply();
        },
      });
    } else {
      currentSorted = sorted;
      updateLoadMore();
    }
    renderTopPick(topPick, sorted[0] || null);

    renderActiveChips(state, active, {
      onClearOne: (key) => {
        p2.delete(key);
        if (key === "ratingMin") p2.delete("ratingMin");
        if (key === "priceMin") p2.delete("priceMin");
        if (key === "priceMax") p2.delete("priceMax");
        if (key === "duration") p2.delete("duration");
        if (key === "q") p2.delete("q");
        if (key === "location") p2.delete("location");
        if (key === "category") p2.delete("category");
        if (key === "type") p2.delete("type");
        const newUrl = `${url2.pathname}?${p2.toString()}`;
        history.replaceState({}, "", newUrl);
        setFormFromParams(form, p2);
        setAllSorts(p2.get("sort") || "recommended");
        apply();
      },
      onClearAll: () => {
        const keep = new URLSearchParams();
        if (p2.get("q")) keep.set("q", p2.get("q"));
        const newUrl = `${url2.pathname}?${keep.toString()}`;
        history.replaceState({}, "", newUrl);
        form.reset();
        setAllSorts("recommended");
        apply();
      },
    });

    const newUrl = `${url2.pathname}?${p2.toString()}`;
    history.replaceState({}, "", newUrl);
  };

  let t = null;
  const schedule = () => {
    window.clearTimeout(t);
    t = window.setTimeout(apply, 120);
  };

  qsa("input, select", form).forEach((el) => el.addEventListener("input", schedule));
  sortSelects.forEach((sel) =>
    sel.addEventListener("change", (e) => {
      const value = e.target.value;
      setAllSorts(value);
      apply();
    })
  );

  const clearBtn = qs("[data-clear-filters]");
  if (clearBtn)
    clearBtn.addEventListener("click", () => {
      form.reset();
      setAllSorts("recommended");
      apply();
    });

  apply();
}

document.addEventListener("DOMContentLoaded", init);
