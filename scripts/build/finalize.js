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

  return {
    manifest,
    platformMetrics,
    platformStatus
  };
}

module.exports = {
  finalizeBuild
};
