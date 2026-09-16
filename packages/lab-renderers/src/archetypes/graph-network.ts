import { NotImplemented } from "@instinct/shared";
import type { ArchetypeDescriptor, ArchetypeRenderer } from "../types.js";

/** Nodes, edges, and optional packets travelling along them. */
export const graphNetworkRenderer: ArchetypeRenderer = {
  id: "graph-network",
  compile() {
    // TODO(FRONTEND): buildEdges → run the chosen layout ONCE → freeze positions.
    // A graph that keeps drifting under the cursor is unusable, and a live force sim competing
    // with the concept's own dynamics for frame budget is worse.
    throw new NotImplemented("graph-network.compile");
  },
  draw() {
    // TODO(FRONTEND): edges first (thickness by weight) → packets → nodes → labels.
    // Edges under nodes, always: an edge drawn over a node reads as a line through it.
    throw new NotImplemented("graph-network.draw");
  },
  hitTest() {
    // nodes by nearestInColumns, then edges by distanceToSegment — nodes win ties
    throw new NotImplemented("graph-network.hitTest");
  },
  onDrag() {
    throw new NotImplemented("graph-network.onDrag");
  },
};

export const graphNetworkDescriptor: ArchetypeDescriptor = {
  id: "graph-network",
  summary: "Nodes connected by edges, with optional packets flowing along them.",
  bestFor: [
    "things that propagate between connected entities",
    "topology-dependent behaviour",
    "reachability, paths, and bottlenecks",
    "failure and recovery when a link or node is removed",
  ],
  supportedMarks: ["circle", "line", "arrow", "text", "token"],
  interactions: ["drag a node", "cut an edge", "inject a packet", "click a node"],
  maxEntities: 400,
  examples: ["routing convergence", "dependency graphs", "social contagion", "gossip protocols"],
  renderer: graphNetworkRenderer,
};
