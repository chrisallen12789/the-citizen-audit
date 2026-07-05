import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://thecitizenaudit.org",
  trailingSlash: "ignore",
  build: { format: "directory" },
  compressHTML: true,
});
