import { bindings, defineConfig } from "cf/config";

export default defineConfig(({ mode, isPreview }) => {
  if (!["production", "preview", "staging"].includes(mode ?? ""))
    throw new Error("Cloudflare mode must be production, preview or staging");
  const production = mode === "production" && !isPreview;
  const staging = mode === "staging";
  return {
    accountId: "9dce34804a27754a4ea66a5789827dfa",
    worker: {
      name: staging ? "justindfuller-site-staging" : "justindfuller-site",
      entrypoint: production ? undefined : "./worker/private.mjs",
      compatibilityDate: "2026-10-03",
      workersDev: !production && !staging,
      previewUrls: !staging,
      domains: production
        ? ["justindfuller.com", "www.justindfuller.com"]
        : staging
          ? ["staging.justindfuller.com"]
          : [],
      env: production
        ? {}
        : {
            ASSETS: bindings.assets(),
            OBSIDIAN_SOURCE: bindings.r2({
              name: "justindfuller-obsidian-source",
            }),
          },
      triggers: [],
      assets: {
        htmlHandling: "auto-trailing-slash",
        notFoundHandling: "404-page",
        runWorkerFirst: !production,
      },
    },
  };
});
