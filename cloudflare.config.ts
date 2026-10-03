import { defineConfig } from "cf/config";

export default defineConfig(({ mode, isPreview }) => {
  if (!["production", "preview"].includes(mode ?? ""))
    throw new Error("Cloudflare mode must be production or preview");
  const production = mode === "production" && !isPreview;
  return {
    accountId: "9dce34804a27754a4ea66a5789827dfa",
    worker: {
      name: "justindfuller-site",
      compatibilityDate: "2026-10-03",
      workersDev: !production,
      previewUrls: true,
      domains: production ? ["justindfuller.com", "www.justindfuller.com"] : [],
      triggers: [],
      assets: {
        htmlHandling: "auto-trailing-slash",
        notFoundHandling: "404-page",
      },
    },
  };
});
