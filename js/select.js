let openWrap = null;

function closeOpen() {
  if (!openWrap) return;
  openWrap.classList.remove("is-open");
  const btn = openWrap.querySelector(".cselect__btn");
  if (btn) btn.setAttribute("aria-expanded", "false");
  openWrap = null;
}

function isDisabledOption(opt) {
  if (!opt) return true;
  if (opt.disabled) return true;
  if (String(opt.value || "") === "" && opt.disabled) return true;
  return false;
}

function labelForSelect(select) {
  const idx = select.selectedIndex;
  const opt = idx >= 0 ? select.options[idx] : null;
  return String(opt?.textContent || "").trim();
}

function buildMenu({ select, wrap, btn, menu }) {
  menu.innerHTML = "";
  const selectedValue = select.value;
  Array.from(select.options || []).forEach((opt) => {
    const value = String(opt.value ?? "");
    const label = String(opt.textContent || "").trim();
    const item = document.createElement("button");
    item.type = "button";
    item.className = "cselect__opt";
    item.setAttribute("role", "option");
    item.setAttribute("data-value", value);
    item.setAttribute("aria-selected", String(value === selectedValue));
    item.disabled = isDisabledOption(opt);
    item.textContent = label;
    item.addEventListener("click", () => {
      if (item.disabled) return;
      select.value = value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      btn.querySelector("[data-cselect-label]").textContent = labelForSelect(select);
      Array.from(menu.querySelectorAll(".cselect__opt")).forEach((el) => {
        el.setAttribute("aria-selected", String(el.getAttribute("data-value") === select.value));
      });
      closeOpen();
      btn.focus();
    });
    menu.appendChild(item);
  });
}

function focusSelected(menu) {
  const selected = menu.querySelector(".cselect__opt[aria-selected=\"true\"]");
  const first = menu.querySelector(".cselect__opt:not([disabled])");
  (selected || first)?.focus?.();
}

function moveFocus(menu, dir) {
  const opts = Array.from(menu.querySelectorAll(".cselect__opt")).filter((x) => !x.disabled);
  if (!opts.length) return;
  const active = document.activeElement;
  const idx = Math.max(0, opts.indexOf(active));
  const next = opts[(idx + dir + opts.length) % opts.length];
  next?.focus?.();
}

function open(wrap) {
  if (openWrap && openWrap !== wrap) closeOpen();
  openWrap = wrap;
  const btn = wrap.querySelector(".cselect__btn");
  btn?.setAttribute?.("aria-expanded", "true");
  wrap.classList.add("is-open");
  const menu = wrap.querySelector(".cselect__menu");
  focusSelected(menu);
}

function toggle(wrap) {
  const isOpen = wrap.classList.contains("is-open");
  if (isOpen) closeOpen();
  else open(wrap);
}

function enhanceSelect(select) {
  if (!select || select.dataset.cselect === "0") return null;
  if (select.dataset.cselectEnhanced === "1") return select.closest(".cselect");

  const wrap = document.createElement("div");
  wrap.className = "cselect";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cselect__btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");

  const label = document.createElement("span");
  label.setAttribute("data-cselect-label", "1");
  label.textContent = labelForSelect(select) || "Select";

  const chev = document.createElement("span");
  chev.className = "cselect__chev";
  chev.setAttribute("aria-hidden", "true");

  btn.appendChild(label);
  btn.appendChild(chev);

  const menu = document.createElement("div");
  menu.className = "cselect__menu";
  menu.setAttribute("role", "listbox");

  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);
  wrap.appendChild(btn);
  wrap.appendChild(menu);

  select.classList.add("cselect__native");
  select.dataset.cselectEnhanced = "1";

  const rebuild = () => buildMenu({ select, wrap, btn, menu });
  rebuild();

  btn.addEventListener("click", () => toggle(wrap));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      open(wrap);
    }
  });

  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeOpen();
      btn.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus(menu, +1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(menu, -1);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      menu.querySelector(".cselect__opt:not([disabled])")?.focus?.();
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      const opts = Array.from(menu.querySelectorAll(".cselect__opt")).filter((x) => !x.disabled);
      opts[opts.length - 1]?.focus?.();
    }
  });

  select.addEventListener("change", () => {
    btn.querySelector("[data-cselect-label]").textContent = labelForSelect(select);
    rebuild();
  });

  return wrap;
}

export function initCustomSelects(root = document) {
  const scope = root || document;
  Array.from(scope.querySelectorAll("select")).forEach((s) => enhanceSelect(s));
}

export function closeCustomSelects() {
  closeOpen();
}

document.addEventListener("click", (e) => {
  if (!openWrap) return;
  const t = e.target;
  if (t && openWrap.contains(t)) return;
  closeOpen();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!openWrap) return;
  closeOpen();
});
