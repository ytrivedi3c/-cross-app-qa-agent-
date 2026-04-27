/**
 * Example AppProfile — ships with the agent as a reference shape.
 *
 * Use this as your starting point when writing a new profile by hand, OR let
 * the wizard (`npm run adapt-app`) generate one for you. Every field here is
 * populated with generic seller/ecomm defaults that work on most apps, but
 * you should VERIFY each before running tests.
 *
 * DO NOT SET `APP_PROFILE=example` IN PRODUCTION — this profile points at a
 * fictional app. Create your own slug.
 */

import type { AppProfile } from "../app-profile.js";

const profile: AppProfile = {
  id: "example",
  domain: "seller-ecomm",
  displayName: "Example Seller App (reference profile)",

  // baseUrl: "https://app.example.com",  // optional; uncomment for a fixed host

  auth: {
    method: "jwt-query-param",
    loginPathPattern: "/auth/login?user_token={token}",
    tokenEnvVar: "EXAMPLE_ACCESS_TOKEN",
    // Matches ".../panel/<user-id>" so feature routes hang off that prefix.
    panelPathPattern: /^(https?:\/\/[^/]+\/panel\/[^/]+)/,
  },

  routes: {
    dashboard: "/dashboard",
    products: "/listing/products",
    orders: "/listing/orders",
    returns: "/listing/returns",
    config: "/settings",
    pricing: "/pricing",
    activities: "/activities",
  },

  labels: {
    tabs: {
      all: /^all$/i,
      active: /^active$/i,
      inactive: /^inactive$/i,
      live: /^live$/i,
      notUploaded: /^not\s*uploaded$/i,
      inProgress: /^in\s*progress$/i,
      reviewing: /^reviewing$/i,
      failed: /^failed$/i,
    },
    buttons: {
      upload: /upload/i,
      bulkAction: /bulk\s*action|more\s*action/i,
      filter: /^filter$/i,
      save: /^save$/i,
      cancel: /^cancel$/i,
      confirm: /confirm|ok|yes/i,
      next: /^next$/i,
      previous: /^(prev|previous)$/i,
      import: /^import/i,
      export: /^export/i,
    },
    search: {
      placeholder: /search/i,
    },
    headings: {
      basicInformation: /basic\s*information|product\s*details/i,
      productStatus: /product\s*status/i,
      orderStatus: /order\s*status/i,
    },
  },

  selectorHints: {
    dataGrid: "table, [class*='DataTable'], [class*='Grid']",
    gridRow: "table tbody tr, [class*='DataTable'] [class*='Row']",
    modalDialog: "[role='dialog'], [class*='Modal'], [class*='Dialog']",
    skuRowPattern: "SKU\\s*:?\\s*{value}(?!\\d)",
    rowTitleLink:
      "[class*='dataTable'] a, [class*='DataTable'] a, [class*='Row'] a, tbody tr a",
  },

  entityNames: {
    productId: "sku",
  },
};

export default profile;
