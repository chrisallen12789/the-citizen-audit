const fs = require("fs");
const path = require("path");
const sections = require("../data-model/sections");

const root = path.resolve(__dirname, "..");
const auditDir = path.join(root, "public", "audit");
const outputPath = path.join(root, "data-model", "section-content.js");

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractPanels(html) {
  return [...html.matchAll(/<section class="panel">([\s\S]*?)<\/section>/g)].map((match) => match[1]);
}

function parsePanel(panelHtml) {
  const headingMatch = panelHtml.match(/<h2>([\s\S]*?)<\/h2>/);
  const heading = headingMatch ? decodeEntities(headingMatch[1].replace(/<[^>]+>/g, "").trim()) : "";
  const body = panelHtml.replace(/<h2>[\s\S]*?<\/h2>/, "").trim();
  const blocks = [];

  if (heading) {
    blocks.push({ type: "heading", text: heading });
  }

  const tokenPattern =
    /(<div class="claim">[\s\S]*?<\/div>|<table>[\s\S]*?<\/table>|<ul>[\s\S]*?<\/ul>|<ol>[\s\S]*?<\/ol>|<p>[\s\S]*?<\/p>)/g;
  const tokens = body.match(tokenPattern) || [];

  for (const token of tokens) {
    if (token.startsWith("<div class=\"claim\">")) {
      blocks.push({ type: "callout", html: token });
      continue;
    }
    if (token.startsWith("<table>")) {
      blocks.push({ type: "table", html: token });
      continue;
    }
    if (token.startsWith("<ul>") || token.startsWith("<ol>")) {
      blocks.push({
        type: "list",
        html: token,
        ordered: token.startsWith("<ol>")
      });
      continue;
    }
    if (token.startsWith("<p>")) {
      const lowerHeading = heading.toLowerCase();
      const paragraphType = lowerHeading.includes("bottom line")
        ? "bottomLine"
        : lowerHeading.includes("method")
          ? "methodologyNote"
          : "paragraph";
      blocks.push({ type: paragraphType, html: token });
    }
  }

  return blocks;
}

const sectionContent = Object.fromEntries(
  sections
    .filter((section) => /^Section \d+$/.test(section.id))
    .map((section) => {
      const html = fs.readFileSync(path.join(root, "public", section.url.replace(/^\//, "")), "utf8");
      const panels = extractPanels(html);
      const contentBlocks = panels.flatMap(parsePanel);
      return [section.id, contentBlocks];
    })
);

const output = `module.exports = ${JSON.stringify(sectionContent, null, 2)};\n`;
fs.writeFileSync(outputPath, output, "utf8");
console.log(`Wrote ${outputPath}`);
