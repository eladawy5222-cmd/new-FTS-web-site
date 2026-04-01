## Airtable integration (Airtable-first, mock fallback)

This project is a static multi-page site (plain HTML/CSS/JS). Data loading is centralized in `js/toursRepository.js`, which now loads tours in this order:

1. Airtable (if configured)
2. Custom API (`window.FTS_API_BASE` + `/tours`) if present
3. Local mock dataset (`js/data.js`)

No UI/pages were rebuilt; only the data layer and image robustness were upgraded.

---

## Where Airtable config goes

All pages load `js/runtimeConfig.js` in `<head>`. Configure Airtable by setting values on `window.FTS_AIRTABLE` there (recommended), or by defining:

- `window.FTS_AIRTABLE_BASE_ID`
- `window.FTS_AIRTABLE_TABLE`
- `window.FTS_AIRTABLE_VIEW`
- `window.FTS_AIRTABLE_PROXY_URL` or `window.FTS_AIRTABLE_TOKEN`

`runtimeConfig.js` ships with safe defaults (empty Airtable settings), so mock data stays active until you configure Airtable.

---

## Security note (important)

The Airtable REST API requires a token. Do not commit a real Airtable token into a public repository.

Recommended production approach on standard hosting:

- Create a small server-side proxy endpoint on your hosting (PHP is typical on cPanel).
- Set `window.FTS_AIRTABLE_PROXY_URL` to that endpoint.
- The frontend uses `fetch()` to call your proxy; the proxy attaches the Airtable token server-side.

Direct-to-Airtable in the browser is supported only if you inject the token at runtime in a private environment.

---

## Airtable table/fields expected

The data mapper is configurable, but the default expects Airtable field names to match these keys (lowerCamelCase):

- `id`
- `title`
- `slug` (optional; generated from title if missing)
- `location`
- `category`
- `duration` (string is fine)
- `rating`
- `reviewsCount`
- `price`
- `oldPrice`
- `badges` (array or comma/newline separated string)
- `image` (attachment array or URL string)
- `gallery` (attachment array, URL list, or comma/newline separated string)
- `shortDescription`
- `fullDescription`
- `highlights` (array or string list)
- `included` (array or string list)
- `excluded` (array or string list)
- `itinerary` (JSON array string or newline list)
- `cancellation`
- `type`
- `featured` (boolean)

---

## Image handling

Cards and the details gallery are robust for real content:

- Accepts Airtable attachment arrays and URL strings.
- Supports gallery arrays.
- Falls back to a category/location-based local SVG if images are missing or fail to load.

---

## How to switch from mock to Airtable

1. Create an Airtable base/table for tours.
2. Put the Airtable configuration into `js/runtimeConfig.js` (base/table/view + proxy URL or token).
3. Deploy.

Once Airtable is configured, the site automatically uses Airtable records as the primary source.

