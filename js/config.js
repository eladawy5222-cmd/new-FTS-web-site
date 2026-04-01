const DEFAULT_WHATSAPP_E164 = "201000000000";
const DEFAULT_TRIP_API_BASE = "https://ftstravels.com/wp-json";
const DEFAULT_TRIPS_ENDPOINT = "/fts/v1/trips";

if (typeof window !== "undefined") {
  const existing = String(window.FTS_WHATSAPP_E164 || "").trim();
  if (!existing) window.FTS_WHATSAPP_E164 = DEFAULT_WHATSAPP_E164;

  const apiExisting = String(window.FTS_TRIP_API_BASE || window.FTS_API_BASE || "").trim();
  if (!apiExisting && DEFAULT_TRIP_API_BASE) window.FTS_TRIP_API_BASE = DEFAULT_TRIP_API_BASE;

  const endpointExisting = String(window.FTS_TRIPS_ENDPOINT || "").trim();
  if (!endpointExisting && DEFAULT_TRIPS_ENDPOINT) window.FTS_TRIPS_ENDPOINT = DEFAULT_TRIPS_ENDPOINT;
}

export function getWhatsAppE164() {
  const raw = typeof window !== "undefined" ? String(window.FTS_WHATSAPP_E164 || DEFAULT_WHATSAPP_E164) : DEFAULT_WHATSAPP_E164;
  const digits = raw.replace(/\D/g, "");
  return digits || DEFAULT_WHATSAPP_E164;
}

export function getTripApiBase() {
  const raw =
    typeof window !== "undefined"
      ? String(window.FTS_TRIP_API_BASE || window.FTS_API_BASE || DEFAULT_TRIP_API_BASE || "")
      : String(DEFAULT_TRIP_API_BASE || "");
  return raw.trim().replace(/\/+$/, "");
}

export function getTripsEndpoint() {
  const raw = typeof window !== "undefined" ? String(window.FTS_TRIPS_ENDPOINT || DEFAULT_TRIPS_ENDPOINT) : DEFAULT_TRIPS_ENDPOINT;
  const v = raw.trim() || DEFAULT_TRIPS_ENDPOINT;
  return v.startsWith("/") ? v : `/${v}`;
}
