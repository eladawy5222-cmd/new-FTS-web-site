function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function tokenize(query) {
  const q = normalize(query);
  if (!q) return [];
  return q.split(/\s+/g).filter(Boolean);
}

export function matchesSearch(tour, query) {
  const tokens = tokenize(query);
  if (!tokens.length) return true;

  const hay = normalize(
    [
      tour.title,
      tour.location,
      tour.category,
      tour.shortDescription,
      tour.fullDescription,
      Array.isArray(tour.badges) ? tour.badges.join(" ") : "",
    ].join(" ")
  );

  return tokens.every((t) => hay.includes(t));
}

