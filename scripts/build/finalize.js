const { absoluteUrl } = require("../renderers/shared");

function buildSitemap(outputs) {
  const urls = ["/", "/press.html", ...outputs.filter((item) => item.endsWith(".html"))];
  const uniqueUrls = [...new Set(urls)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueUrls
    .map((url) => `  <url><loc>${absoluteUrl(url === "/index.html" ? "/" : url)}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
}

function buildRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`;
}

function finalizeBuild({
  writeFile,
  publicDir,
  getPage,
  renderPublicationPage,
  buildManifest,
  buildPlatformMetrics,
  buildPlatformStatus,
  searchIndex,
  traceRecords,
  manifestOutputs
}) {
  const manifest = buildManifest(manifestOutputs);
  const provisionalMetrics = buildPlatformMetrics(searchIndex, traceRecords);
  const provisionalStatus = buildPlatformStatus(provisionalMetrics, manifest);

  writeFile(
    publicDir,
    "platform.html",
    renderPublicationPage(getPage("PAGE-PLATFORM"), { metrics: provisionalMetrics })
  );
  writeFile(
    publicDir,
    "status.html",
    renderPublicationPage(getPage("PAGE-STATUS"), {
      metrics: provisionalMetrics,
      status: provisionalStatus,
      manifest
    })
  );

  const platformMetrics = buildPlatformMetrics(searchIndex, traceRecords);
  const platformStatus = buildPlatformStatus(platformMetrics, manifest);

  writeFile(
    publicDir,
    "platform.html",
    renderPublicationPage(getPage("PAGE-PLATFORM"), { metrics: platformMetrics })
  );
  writeFile(
    publicDir,
    "status.html",
    renderPublicationPage(getPage("PAGE-STATUS"), {
      metrics: platformMetrics,
      status: platformStatus,
      manifest
    })
  );
  writeFile(publicDir, "data/platform-status.json", `${JSON.stringify(platformStatus, null, 2)}\n`);
  writeFile(publicDir, "data/publication-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(publicDir, "data/platform-metrics.json", `${JSON.stringify(platformMetrics, null, 2)}\n`);
  writeFile(publicDir, "sitemap.xml", buildSitemap(manifest.outputs));
  writeFile(publicDir, "robots.txt", buildRobots());

  return {
    manifest,
    platformMetrics,
    platformStatus
  };
}

module.exports = {
  finalizeBuild
};
