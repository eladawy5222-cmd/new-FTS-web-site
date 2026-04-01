# FTS Trip API (WordPress) Setup

## Configure the API base URL

The frontend loads tours from the existing FTS Trip API (WordPress) first, with mock data as a development fallback.

You can configure the API without changing the code in either of these ways:

1) **Preferred (hosting/runtime config):** define a global before loading the pages’ module scripts:

- `window.FTS_TRIP_API_BASE` = the API base URL (no trailing slash)
- `window.FTS_TRIPS_ENDPOINT` = the trips endpoint path (default: `/fts/v1/trips`)

2) **Fallback (code config):** edit defaults in [config.js](file:///D:/FTS%20Projects/new%20FTS%20web%20site/js/config.js):

- `DEFAULT_TRIP_API_BASE`
- `DEFAULT_TRIPS_ENDPOINT`

Notes:
- `window.FTS_API_BASE` is still supported for backward compatibility if `window.FTS_TRIP_API_BASE` is not set.
- Default production base: `https://ftstravels.com/wp-json`
- Default production endpoint: `/fts/v1/trips`
- If the API request fails, or returns an empty list, the site automatically falls back to mock tours from `js/data.js`.

## Mapper / adapter layer

The WordPress trip response is mapped to the frontend tour model using:

- [wpTripMapper.js](file:///D:/FTS%20Projects/new%20FTS%20web%20site/js/wpTripMapper.js)
- [toursRepository.js](file:///D:/FTS%20Projects/new%20FTS%20web%20site/js/toursRepository.js) (API-first loading + caching)

### Frontend tour model fields

The UI expects a normalized tour object with:

- `id`, `title`, `slug`
- `location`, `category`, `type`
- `duration` `{ label, days, hours }`
- `rating`, `reviewsCount`
- `price`, `oldPrice`
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
- `slug`: `core.slug` → `slug` → `post_name`

**Taxonomies**
- `location`: `taxonomies.locations[0].name` → `taxonomies.location[0].name` → `taxonomies.destinations[0].name` → `general.location`
- `category`: `taxonomies.categories[0].name` → `taxonomies.activities[0].name` → `general.category`
- `type`: `taxonomies.types[0].name` → `taxonomies.trip_types[0].name` → `general.type`

**Media**
- `image`: `featured_image.url` (or `featured_image.sizes.*`) → first gallery URL → location-based SVG fallback
- `gallery`: `gallery[]` (string URLs or objects with `url/src/sizes`) when present

**Pricing**
- If package pricing exists:
  - `price`: lowest of `pricing.packages[].pricing.categories[].sale_price` / `actual_price` / `price`
  - `oldPrice`: `pricing.packages[].pricing.categories[].regular_price` when greater than `price`
- Otherwise:
  - `price`: `pricing.actual_price` / `pricing.sale_price` / `pricing.from_price` / `pricing.price`
  - `oldPrice`: `pricing.base_price` / `pricing.regular_price` when greater than `price`

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
