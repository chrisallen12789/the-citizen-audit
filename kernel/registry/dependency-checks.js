function dependencyCycles(objects) {
  const graph = new Map(objects.map((item) => [item.id, Array.isArray(item.dependsOn) ? item.dependsOn : []]));
  const state = new Map();
  const stack = [];
  const cycles = [];

  function visit(id) {
    const status = state.get(id) || 0;
    if (status === 2) return;
    if (status === 1) {
      cycles.push([...stack.slice(stack.indexOf(id)), id]);
      return;
    }
    state.set(id, 1);
    stack.push(id);
    for (const dependency of graph.get(id) || []) if (graph.has(dependency)) visit(dependency);
    stack.pop();
    state.set(id, 2);
  }

  for (const id of [...graph.keys()].sort()) visit(id);
  return cycles;
}

module.exports = { dependencyCycles };
