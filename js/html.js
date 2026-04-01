const ALLOWED_TAGS = new Set([
  "A",
  "B",
  "BLOCKQUOTE",
  "BR",
  "CODE",
  "DIV",
  "EM",
  "H2",
  "H3",
  "H4",
  "LI",
  "OL",
  "P",
  "SPAN",
  "STRONG",
  "UL",
]);

function stripDangerous(el) {
  const blocked = el.querySelectorAll("script,style,iframe,object,embed,link,meta");
  blocked.forEach((n) => n.remove());

  const all = el.querySelectorAll("*");
  all.forEach((node) => {
    const tag = node.tagName;
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
      return;
    }

    Array.from(node.attributes || []).forEach((attr) => {
      const name = String(attr.name || "");
      const value = String(attr.value || "");

      if (name.toLowerCase().startsWith("on")) node.removeAttribute(name);
      else if (tag !== "A") node.removeAttribute(name);
      else if (!["href", "target", "rel"].includes(name.toLowerCase())) node.removeAttribute(name);
      else if (name.toLowerCase() === "href") {
        const v = value.trim();
        const isSafe =
          v.startsWith("http://") || v.startsWith("https://") || v.startsWith("mailto:") || v.startsWith("tel:") || v.startsWith("/");
        if (!isSafe) node.removeAttribute("href");
      }
    });

    if (tag === "A") {
      const href = node.getAttribute("href");
      if (href) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      } else {
        node.removeAttribute("target");
        node.removeAttribute("rel");
      }
    }
  });
}

export function sanitizeHtml(html) {
  const raw = String(html || "");
  if (!raw.trim()) return "";
  if (typeof DOMParser === "undefined") return raw.replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(raw, "text/html");
  stripDangerous(doc.body);
  return doc.body.innerHTML;
}

export function htmlToText(html) {
  const raw = String(html || "");
  if (!raw.trim()) return "";
  if (typeof DOMParser === "undefined") return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const doc = new DOMParser().parseFromString(raw, "text/html");
  return String(doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

export function decodeHtmlEntities(str) {
  const raw = String(str || "");
  if (!raw) return "";
  if (typeof document === "undefined") return raw;
  const t = document.createElement("textarea");
  t.innerHTML = raw;
  return t.value;
}
