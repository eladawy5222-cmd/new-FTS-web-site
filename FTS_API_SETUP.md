# FTS Trip API (WordPress) Setup

## Configure the API base URL

The frontend loads tours from the existing FTS Trip API (WordPress) first, with mock data as a development fallback.

You can configure the API without changing the code in either of these ways:

1) **Preferred (hosting/runtime config):** define a global before loading the pages’ module scripts:

- `window.FTS_TRIP_API_BASE` = the API base URL (no trailing slash)
- `window.FTS_TRIPS_ENDPOINT` = the trips endpoint path (default: `/fts/v1/trips`)
- `window.FTS_TRIPS_PAGE` = default page (default: `1`)
- `window.FTS_TRIPS_PER_PAGE` = page size (default: `50`)
- `window.FTS_DISPLAY_CURRENCY` = currency code for display formatting (default: `USD`)

2) **Fallback (code config):** edit defaults in [config.js](file:///D:/FTS%20Projects/new%20FTS%20web%20site/js/config.js):

- `DEFAULT_TRIP_API_BASE`
- `DEFAULT_TRIPS_ENDPOINT`

Notes:
- `window.FTS_API_BASE` is still supported for backward compatibility if `window.FTS_TRIP_API_BASE` is not set.
- Default production base: `https://ftstravels.com/wp-json`
- Default production endpoint: `/fts/v1/trips`
- This endpoint requires pagination params (`page` and `per_page`). The frontend sends them automatically.
- If the API request fails, or returns an empty list, the site automatically falls back to mock tours from `js/data.js`.

## Mapper / adapter layer

The WordPress trip response is mapped to the frontend tour model using:

- [wpTripMapper.js](file:///D:/FTS%20Projects/new%20FTS%20web%20site/js/wpTripMapper.js)
- [toursRepository.js](file:///D:/FTS%20Projects/new%20FTS%20web%20site/js/toursRepository.js) (API-first loading + caching)

### Frontend tour model fields

The UI expects a normalized tour object with:

- `id`, `title`, `slug`
- `location`, `category`, `type`
- `destinations[]` (optional; used to build destination filters more accurately)
- `duration` `{ label, days, hours }`
- `rating`, `reviewsCount`
- `price`, `oldPrice`
- `currency` (ISO 4217 code when provided by the API, e.g. `EUR`)
- `badges[]`
- `image`, `gallery[]`
- `shortDescription`, `fullDescription` (sanitized HTML)
- `highlights[]`, `included[]`, `excluded[]`
- `itinerary[]` (`{ title, description }`)
- `cancellation`
- `featured` (boolean)

### API fields used (mapping strategy)

The mapper aligns to the production payload and is defensive across small variations:

**Identity**
- `id`: `core.id` → `id` → `core.ID` → `ID`
- `title`: `core.title.rendered` → `core.title` → `title.rendered` → `title`
- `slug`: `core.slug` → `core.permalink_slug` → `slug` → `post_name` (fallback: `id`)

**Taxonomies**
- `destinations[]`: first available from `taxonomies.locations|location|destinations|destination|places|place` (all term names)
- `location`: primary destination chosen from `destinations[]` (prefers a non-generic term when multiple exist) → `general.location`
- `category`: `taxonomies.categories[0].name` → `taxonomies.activities[0].name` → `general.category`
- `type`: `taxonomies.types[0].name` → `taxonomies.trip_types[0].name` → `general.type`

**Media**
- `image`:
  - Prefer direct URLs from `featured_image.*` (`url/src/source_url/media_details.sizes.*`)
  - If the payload only exposes attachment IDs, resolve `featured_image.id` / `meta._thumbnail_id` via `wp-json/wp/v2/media`
  - Final fallback is a location-based SVG icon when real media is unavailable
- `gallery`:
  - Prefer direct URLs from `gallery[]` and other common gallery fields
  - Support ID-based galleries from:
    - `meta.wp_travel_engine_setting.wpte_gallery_id` (object of attachment IDs)
    - `meta.referenced_media_ids` (array of attachment IDs)
  - Resolve IDs via `wp-json/wp/v2/media?include=...` and de-duplicate results

**Pricing**
- If package pricing exists:
  - `currency`: `pricing.currency` (fallback) → `pricing.packages[].pricing.categories[].currency`
  - `price`: for each category use `sale_price` when sale is enabled (or when `sale_price < regular_price`), otherwise `actual_price`/`regular_price`; if `group_pricing` exists, uses the tier for `pax=1`
  - `oldPrice`: `regular_price` when greater than `price`
- Otherwise:
  - `currency`: `pricing.currency`
  - `price`: prefers explicit `sale_price`/`regular_price`; otherwise derives from `actual_price` + `base_price` safely (handles swapped values)
  - `oldPrice`: `regular_price` when greater than `price`

**Content**
- `fullDescription`: `core.content_html` (sanitized) → `core.content.rendered` → `general.content` → `content.rendered`
- `shortDescription`: `core.excerpt.rendered` (text) → `seo.description` → truncated text from `fullDescription`

**Structured trip details**
- `highlights`: `meta.wp_travel_engine_setting.trip_highlights`
- `included`: `meta.wp_travel_engine_setting.cost.cost_includes` (newline-split)
- `excluded`: `meta.wp_travel_engine_setting.cost.cost_excludes` (newline-split)
- `itinerary`: `meta.wp_travel_engine_setting.trip_itinerary` (array of objects) with fallback support
- `duration`: `meta.wp_travel_engine_setting.trip_duration` plus optional `duration_days/duration_hours`
- `cancellation`: `general.cancellation` → `meta.cancellation_policy`

**Derived fields**
- `featured`: `general.featured` → `featured` → `meta.featured` → `core.sticky`
- `badges`:
  - “Best Seller” if `featured`
  - “Top Rated” only when `rating` and `reviewsCount` are explicitly present and meet the threshold
  - “Free Cancellation” if cancellation text contains “free” and “cancel”
  - “Instant Confirmation” if `general.instant_confirmation` / `meta.booking.instant_confirmation`

## Fallback behavior

- If the API base URL is not configured, or the API request fails, or the API returns an empty list, `toursRepository.js` falls back to mock data from `js/data.js`.
- The UI continues to work with either data source because everything is normalized to the same frontend tour model.
