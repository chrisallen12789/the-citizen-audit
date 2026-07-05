const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const nodesPath = path.join(root, "memory", "graph", "nodes.json");
const edgesPath = path.join(root, "memory", "graph", "edges.json");
const reportPath = path.join(root, "memory", "reports", "status.md");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const nodesFile = readJson(nodesPath);
const edgesFile = readJson(edgesPath);
const nodes = nodesFile.nodes || [];
const edges = edgesFile.edges || [];
const problems = [];
const ids = new Set();

for (const node of nodes) {
  if (ids.has(node.id)) problems.push(`Duplicate node ID: ${node.id}`);
  ids.add(node.id);
  if (node.path && !fs.existsSync(path.join(root, node.path))) {
    problems.push(`${node.id}: path does not exist: ${node.path}`);
  }
}

const edgeIds = new Set();
for (const edge of edges) {
  if (edgeIds.has(edge.id)) problems.push(`Duplicate edge ID: ${edge.id}`);
  edgeIds.add(edge.id);
  if (!ids.has(edge.from)) problems.push(`${edge.id}: missing from node ${edge.from}`);
  if (!ids.has(edge.to)) problems.push(`${edge.id}: missing to node ${edge.to}`);
}

const incoming = new Map();
const outgoing = new Map();
for (const node of nodes) {
  incoming.set(node.id, 0);
  outgoing.set(node.id, 0);
}
for (const edge of edges) {
  if (outgoing.has(edge.from)) outgoing.set(edge.from, outgoing.get(edge.from) + 1);
  if (incoming.has(edge.to)) incoming.set(edge.to, incoming.get(edge.to) + 1);
}

const orphanNodes = nodes.filter((node) => !incoming.get(node.id) && !outgoing.get(node.id));
const lines = [];
lines.push("# Memory Engine Status");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push("");
lines.push(`Nodes: ${nodes.length}`);
lines.push(`Edges: ${edges.length}`);
lines.push(`Orphan nodes: ${orphanNodes.length}`);
lines.push(`Problems: ${problems.length}`);
lines.push("");

lines.push("## Node types");
lines.push("");
const byType = new Map();
for (const node of nodes) byType.set(node.type, (byType.get(node.type) || 0) + 1);
for (const [type, count] of [...byType.entries()].sort()) lines.push(`- ${type}: ${count}`);
lines.push("");

lines.push("## Relationship types");
lines.push("");
const byRelationship = new Map();
for (const edge of edges) byRelationship.set(edge.relationship, (byRelationship.get(edge.relationship) || 0) + 1);
for (const [type, count] of [...byRelationship.entries()].sort()) lines.push(`- ${type}: ${count}`);
lines.push("");

lines.push("## Problems");
lines.push("");
if (!problems.length) lines.push("No memory graph problems.");
else for (const problem of problems) lines.push(`- ${problem}`);
lines.push("");

lines.push("## Orphan nodes");
lines.push("");
if (!orphanNodes.length) lines.push("No orphan nodes.");
else for (const node of orphanNodes) lines.push(`- ${node.id} — ${node.title}`);
lines.push("");

ensureDir(path.dirname(reportPath));
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Memory status report written to ${path.relative(root, reportPath)}`);

if (problems.length) process.exit(1);
