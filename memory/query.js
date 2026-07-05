const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const nodesFile = JSON.parse(fs.readFileSync(path.join(root, "memory", "graph", "nodes.json"), "utf8"));
const edgesFile = JSON.parse(fs.readFileSync(path.join(root, "memory", "graph", "edges.json"), "utf8"));
const nodeId = process.argv[2];

if (!nodeId) {
  console.error("Usage: node memory/query.js NODE-ID");
  process.exit(1);
}

const nodes = nodesFile.nodes || [];
const edges = edgesFile.edges || [];
const nodeById = new Map(nodes.map((node) => [node.id, node]));
const node = nodeById.get(nodeId);

if (!node) {
  console.error(`Memory node not found: ${nodeId}`);
  process.exit(1);
}

const outgoing = edges.filter((edge) => edge.from === nodeId);
const incoming = edges.filter((edge) => edge.to === nodeId);

function describeNode(id) {
  const item = nodeById.get(id);
  return item ? `${item.id} — ${item.title}` : id;
}

console.log(`${node.id} — ${node.title}`);
console.log("");
console.log(`Type: ${node.type}`);
console.log(`Status: ${node.status}`);
if (node.path) console.log(`Path: ${node.path}`);
if (node.summary) console.log(`Summary: ${node.summary}`);
console.log("");

console.log(`Outgoing relationships: ${outgoing.length}`);
for (const edge of outgoing) {
  console.log(`- ${edge.relationship} -> ${describeNode(edge.to)}`);
  if (edge.summary) console.log(`  ${edge.summary}`);
}
console.log("");

console.log(`Incoming relationships: ${incoming.length}`);
for (const edge of incoming) {
  console.log(`- ${describeNode(edge.from)} -> ${edge.relationship}`);
  if (edge.summary) console.log(`  ${edge.summary}`);
}
