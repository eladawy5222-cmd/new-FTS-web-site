function hashString(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function formatCompactNumber(num) {
  const n = Number(num) || 0;
  if (n < 1000) return String(Math.round(n));
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`.replace(".0k", "k");
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000000).toFixed(1)}M`.replace(".0M", "M");
}

export function getDecisionCues(tour) {
  const key = `${tour?.id || ""}|${tour?.slug || ""}|${tour?.location || ""}`;
  const h = hashString(key);

  const reviews = Number(tour?.reviewsCount) || 0;
  const rating = Number(tour?.rating) || 0;
  const featured = Boolean(tour?.featured);
  const badges = Array.isArray(tour?.badges) ? tour.badges.map((b) => String(b).toLowerCase()) : [];

  const highDemand = featured || badges.some((b) => b.includes("best seller")) || reviews >= 1200 || rating >= 4.8;
  const urgencyLevel = highDemand ? (reviews >= 1500 || rating >= 4.85 ? "high" : "medium") : "low";

  const bookedBase = highDemand ? 80 : 35;
  const bookedVar = highDemand ? 220 : 120;
  const booked = bookedBase + (h % bookedVar);

  const viewingBase = highDemand ? 20 : 8;
  const viewingVar = highDemand ? 55 : 28;
  const viewing = viewingBase + ((h >>> 8) % viewingVar);

  const reason =
    urgencyLevel === "high"
      ? "Likely to sell out"
      : urgencyLevel === "medium"
        ? "Popular choice"
        : "Well-reviewed";

  const bookedWindow = urgencyLevel === "high" ? "this week" : "recently";
  const proof = `${formatCompactNumber(booked)}+ booked ${bookedWindow}`;

  return {
    urgencyLevel,
    urgencyLabel: reason,
    proofLine: proof,
    viewingNow: clamp(viewing, 4, 99),
  };
}

