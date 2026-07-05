const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const nodesFile = JSON.parse(fs.readFileSync(path.join(root, "memory", "graph", "nodes.json"), "utf8"));
const edgesFile = JSON.parse(fs.readFileSync(path.join(root, "memory", "graph", "edges.json"), "utf8"));
const outputPath = path.join(root, "public", "data", "memory-graph.json");

const nodes = nodesFile.nodes || [];
const edges = edgesFile.edges || [];
const nodeIds = new Set(nodes.map((node) => node.id));
const problems = [];

for (const edge of edges) {
  if (!nodeIds.has(edge.from)) problems.push(`${edge.id}: missing from node ${edge.from}`);
  if (!nodeIds.has(edge.to)) problems.push(`${edge.id}: missing to node ${edge.to}`);
}

const exportPayload = {
  version: "1.0.0",
  generated: new Date().toISOString(),
  summary: {
    nodes: nodes.length,
    edges: edges.length,
    problems: problems.length
  },
  nodes,
  edges
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(exportPayload, null, 2)}\n`, "utf8");
console.log(`Memory graph exported to ${path.relative(root, outputPath)}`);

if (problems.length) {
  console.error("Memory graph export found problems:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
