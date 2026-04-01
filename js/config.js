const DEFAULT_WHATSAPP_E164 = "201000000000";

if (typeof window !== "undefined") {
  const existing = String(window.FTS_WHATSAPP_E164 || "").trim();
  if (!existing) window.FTS_WHATSAPP_E164 = DEFAULT_WHATSAPP_E164;
}

export function getWhatsAppE164() {
  const raw = typeof window !== "undefined" ? String(window.FTS_WHATSAPP_E164 || DEFAULT_WHATSAPP_E164) : DEFAULT_WHATSAPP_E164;
  const digits = raw.replace(/\D/g, "");
  return digits || DEFAULT_WHATSAPP_E164;
}
