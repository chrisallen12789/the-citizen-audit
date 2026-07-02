const fs = require("fs");
const path = require("path");

function applyQaStatus({
  root,
  status,
  htmlPagesChecked,
  checksEnforced
}) {
  const metricsPath = path.join(root, "public/data/platform-metrics.json");
  const statusPath = path.join(root, "public/data/platform-status.json");
  const metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
  const platformStatus = JSON.parse(fs.readFileSync(statusPath, "utf8"));

  metrics.qaStatus = {
    status,
    validatedAt: new Date().toISOString(),
    htmlPagesChecked,
    checksEnforced
  };
  fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");

  platformStatus.qaStatus = status;
  platformStatus.generatedAt = new Date().toISOString();
  fs.writeFileSync(statusPath, `${JSON.stringify(platformStatus, null, 2)}\n`, "utf8");

  for (const [relativePath, marker] of [
    ["public/platform.html", "platform"],
    ["public/status.html", "status"]
  ]) {
    const filePath = path.join(root, relativePath);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const html = fs.readFileSync(filePath, "utf8").replace(
      new RegExp(`(<h2 data-qa-status-value="${marker}">)([\\s\\S]*?)(</h2>)`),
      `$1${status}$3`
    );
    fs.writeFileSync(filePath, html, "utf8");
  }
}

module.exports = {
  applyQaStatus
};
