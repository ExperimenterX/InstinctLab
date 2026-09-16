import { NotImplemented } from "@instinct/shared";
import type { ArchetypeDescriptor, ArchetypeRenderer } from "../types.js";

/** Stages with queues between them, and tokens flowing through. */
export const pipelineFlowRenderer: ArchetypeRenderer = {
  id: "pipeline-flow",
  compile() {
    // TODO(FRONTEND): lay stages left→right, size queue boxes from capacity
    throw new NotImplemented("pipeline-flow.compile");
  },
  draw() {
    // TODO(FRONTEND): stage boxes → queue depth fills → tokens in transit → drop indicators.
    // Make the BOTTLENECK visually obvious (saturated queue in `warn`) — locating the
    // bottleneck is the entire lesson of most pipeline labs, and the learner should be able to
    // spot it without reading a number.
    throw new NotImplemented("pipeline-flow.draw");
  },
  hitTest() {
    throw new NotImplemented("pipeline-flow.hitTest");
  },
};

export const pipelineFlowDescriptor: ArchetypeDescriptor = {
  id: "pipeline-flow",
  summary: "Sequential stages with queues between them and tokens flowing through.",
  bestFor: [
    "throughput limited by the slowest stage",
    "queueing, backpressure, and buffering",
    "latency versus utilisation trade-offs",
    "windowing and rate control",
  ],
  supportedMarks: ["rect", "token", "arrow", "text"],
  interactions: ["throttle a stage", "resize a queue", "change arrival rate", "inject a burst"],
  maxEntities: 800,
  examples: ["CPU pipelines", "flow control windows", "assembly lines", "request tracing"],
  renderer: pipelineFlowRenderer,
};
