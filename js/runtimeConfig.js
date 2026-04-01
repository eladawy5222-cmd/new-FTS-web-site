(function () {
  if (typeof window === "undefined") return;

  if (!String(window.FTS_WHATSAPP_E164 || "").trim()) window.FTS_WHATSAPP_E164 = "201000000000";

  if (!window.FTS_AIRTABLE || typeof window.FTS_AIRTABLE !== "object") {
    window.FTS_AIRTABLE = {
      baseId: "",
      table: "",
      view: "",
      proxyUrl: "",
      token: "",
      fields: {
        id: "id",
        title: "title",
        slug: "slug",
        location: "location",
        category: "category",
        duration: "duration",
        rating: "rating",
        reviewsCount: "reviewsCount",
        price: "price",
        oldPrice: "oldPrice",
        badges: "badges",
        image: "image",
        gallery: "gallery",
        shortDescription: "shortDescription",
        fullDescription: "fullDescription",
        highlights: "highlights",
        included: "included",
        excluded: "excluded",
        itinerary: "itinerary",
        cancellation: "cancellation",
        type: "type",
        featured: "featured",
      },
    };
  }
})();

