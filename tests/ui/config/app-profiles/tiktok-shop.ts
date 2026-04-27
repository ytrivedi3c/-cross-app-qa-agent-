/**
 * AppProfile for TikTok Shop seller panel — extracted from the original
 * QA-automation POMs as they existed at time-zero. This is the profile the
 * user's own test suite effectively implements; it ships with the agent so
 * anyone cloning can test against a real reference implementation.
 *
 * If you're onboarding a DIFFERENT app, DO NOT reuse this profile — run
 * `npm run adapt-app` and get your own.
 */

import type { AppProfile } from "../app-profile.js";

const profile: AppProfile = {
  id: "tiktok-shop",
  domain: "seller-ecomm",
  displayName: "TikTok Shop (seller panel)",

  auth: {
    method: "jwt-query-param",
    loginPathPattern: "/auth/login?user_token={token}",
    tokenEnvVar: "SELLER_ACCESS_TOKEN",
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
      all: /all/i,
      active: /active/i,
      inactive: /inactive/i,
      live: /live/i,
      notUploaded: /not\s*uploaded/i,
      inProgress: /in\s*progress/i,
      reviewing: /reviewing/i,
      failed: /failed/i,
    },
    buttons: {
      upload: /upload/i,
      bulkAction: /bulk\s*action|more\s*action/i,
      filter: /filter/i,
      save: /^save$/i,
      cancel: /^cancel$/i,
      confirm: /confirm|ok|yes/i,
      next: /^next$/i,
      previous: /^(prev|previous)$/i,
      import: /import/i,
      export: /export/i,
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
      ".inte-dataTable__row a, .inte-dataTable__row .inte-btn--textButton, [class*='dataTable'] a",
  },

  entityNames: {
    productId: "sku",
  },
};

export default profile;
