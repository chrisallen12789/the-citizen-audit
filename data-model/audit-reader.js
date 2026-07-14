const sections = require("./sections");

const contents = sections
  .filter((section) => /^Section \d+$/.test(section.id) || /^Appendix [AB]$/.test(section.id))
  .map((section, index) => ({
    stableId: section.id,
    route: section.url,
    label: section.label,
    title: section.title,
    order: index + 1
  }));

module.exports = {
  contents,
  canonicalPdf: {
    notice:
      "The Citizen Audit v1.0 PDF remains the canonical publication. These web pages are a structured reader conversion provided for navigation and inspection.",
    href: "/downloads/the-citizen-audit-v1.0.pdf",
    label: "Open the canonical PDF"
  }
};
