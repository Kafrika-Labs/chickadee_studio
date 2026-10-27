// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const test = require("node:test");
const assert = require("node:assert/strict");
test("exploration shows observed edges, bounds large graphs and terminates on cycles", async () => {
  const { explorationFlow } = await import("../src/inspection-model.mjs");
  const nodes = ["a", "b", "c"].map((id) => ({ id, kind: "page", url: `https://example.invalid/${id}`, status: "scanned" }));
  const edges = [{ id: "ab", source: "a", target: "b" }, { id: "bc", source: "b", target: "c" }, { id: "cb", source: "c", target: "b" }];
  const flow = explorationFlow({ nodes, edges });
  assert.equal(flow.nodes[1].position.x, 270);
  assert.equal(flow.edges.length, 3);
  const limited = explorationFlow({ nodes, edges }, 2);
  assert.equal(limited.omitted, 1);
  assert.equal(limited.edges.length, 1);
  assert.deepEqual(explorationFlow(null).nodes, []);
});

test("run markers frame branches without changing observed graph data", async () => {
  const { explorationFlow, withRunMarkers } = await import("../src/inspection-model.mjs");
  const graph = { nodes: ["a", "b", "c"].map((id) => ({ id, kind: "page" })), edges: [{ id: "ab", source: "a", target: "b" }, { id: "ac", source: "a", target: "c" }] };
  const observed = explorationFlow(graph);
  const framed = withRunMarkers(observed, "running");
  assert.equal(observed.nodes.length, 3);
  assert.equal(framed.nodes.length, 5);
  assert.equal(framed.edges.filter((edge) => edge.data?.displayOnly).length, 3);
  assert.equal(framed.nodes.find((node) => node.data.boundary === "end").data.caption, "검사 진행 중");
  assert.equal(withRunMarkers(observed, "stopped").nodes[1].data.caption, "검사 중단");
  assert.equal(withRunMarkers(explorationFlow(null)).edges.length, 0);
  for (const edge of framed.edges) {
    assert.ok(framed.nodes.some((node) => node.id === edge.source));
    assert.ok(framed.nodes.some((node) => node.id === edge.target));
  }
});
