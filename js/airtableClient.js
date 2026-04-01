import { getAirtableConfig } from "./airtableConfig.js";

function buildAirtableUrl({ baseId, table, view, offset }) {
  const url = new URL(`https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`);
  url.searchParams.set("pageSize", "100");
  if (view) url.searchParams.set("view", view);
  if (offset) url.searchParams.set("offset", offset);
  return url.toString();
}

async function fetchJson(url, { headers }) {
  const res = await fetch(url, { headers: { Accept: "application/json", ...(headers || {}) } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function listRecordsDirect(config) {
  const headers = { Authorization: `Bearer ${config.token}` };
  const all = [];
  let offset = "";
  for (let i = 0; i < 25; i++) {
    const url = buildAirtableUrl({ baseId: config.baseId, table: config.table, view: config.view, offset });
    const data = await fetchJson(url, { headers });
    const records = Array.isArray(data?.records) ? data.records : [];
    all.push(...records);
    offset = String(data?.offset || "");
    if (!offset) break;
  }
  return all;
}

async function listRecordsViaProxy(config) {
  const url = new URL(config.proxyUrl, typeof window !== "undefined" ? window.location.href : "http://localhost/");
  url.searchParams.set("baseId", config.baseId);
  url.searchParams.set("table", config.table);
  if (config.view) url.searchParams.set("view", config.view);
  const data = await fetchJson(url.toString(), { headers: {} });
  return Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : [];
}

export async function airtableListRecords() {
  const config = getAirtableConfig();
  if (!config.baseId || !config.table) return [];
  if (config.proxyUrl) return listRecordsViaProxy(config);
  if (config.token) return listRecordsDirect(config);
  return [];
}

