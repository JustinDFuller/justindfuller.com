import { defineConfig } from "cf/config";

export default defineConfig({
  accountId: "9dce34804a27754a4ea66a5789827dfa",
  worker: {
    name: "justindfuller-site",
    compatibilityDate: "2026-10-03",
    workersDev: true,
    previewUrls: false,
    domains: [],
    triggers: [],
    assets: {
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "404-page",
    },
  },
});
