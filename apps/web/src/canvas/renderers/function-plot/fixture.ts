/**
 * A complete lab using this node, so it can be spun up standalone at /node/function-plot.
 *
 * Untyped on purpose: it goes through `parseLabSpec` exactly like model output does, so the
 * fixture proves the whole path (schema → node config → expression compile → render) rather than
 * type-asserting its way past it. If the schema changes, this is the first thing that breaks —
 * which is the point.
 */
export const FUNCTION_PLOT_FIXTURE = {
  title: "Carrying Capacity",
  caption: "Two predictions of the same colony. Only one is bounded.",
  teaching_angle:
    "Growth rate sets how fast the ceiling is reached, not how high it is — the environment decides the ceiling.",
  params: [
    {
      id: "growth_rate",
      label: "Growth rate",
      min: 0.05,
      max: 0.6,
      step: 0.01,
      default: 0.25,
      explain: "How fast the colony divides when there is room",
    },
    {
      id: "capacity",
      label: "Carrying capacity",
      min: 100,
      max: 900,
      step: 10,
      default: 500,
      explain: "How much life the environment can sustain",
    },
  ],
  observables: [
    {
      id: "pop_at_24h",
      label: "Population at 24h",
      format: "number",
      precision: 0,
      expr: "capacity / (1 + (capacity / 10 - 1) * exp(0 - growth_rate * 24))",
    },
  ],
  stage: {
    renderer: "function-plot",
    config: {
      x_label: "Hours",
      y_label: "Population",
      x_domain: [0, 48],
      y_domain: [0, 1000],
      series: [
        {
          label: "Actual (bounded)",
          color: "series-1",
          style: "line",
          expr: "capacity / (1 + (capacity / 10 - 1) * exp(0 - growth_rate * x))",
        },
        {
          label: "If growth never slowed",
          color: "series-2",
          style: "dashed",
          expr: "min(10 * exp(growth_rate * x), 1000)",
        },
      ],
    },
  },
  prediction: {
    question: "Push the growth rate to its maximum. What is the population at 24 hours?",
    observable_id: "pop_at_24h",
    at_params: { growth_rate: 0.6, capacity: 500 },
    tolerance: 45,
    why_correct:
      "It lands on the capacity, not above it. A faster rate arrives at the ceiling sooner; it does not raise it.",
  },
  quiz: [
    {
      prompt: "Doubling the growth rate barely changed the population at 24 hours. Why?",
      options: [
        "It had already reached the environment's ceiling",
        "Growth rate does not affect population",
        "The colony started dying",
        "24 hours is too early to matter",
      ],
      correct_index: 0,
      why: "Once the curve saturates, the binding constraint is capacity, so rate stops mattering.",
    },
    {
      prompt: "Which knob would you change to actually end up with more bacteria at 48 hours?",
      options: [
        "Carrying capacity",
        "Growth rate",
        "Neither — the curve is fixed",
        "Both change it equally",
      ],
      correct_index: 0,
      why: "Capacity sets the ceiling. Rate only sets how quickly you get there.",
    },
    {
      prompt: "The dashed line leaves the top of the chart. What does that represent?",
      options: [
        "The prediction you get from ignoring limits",
        "A measurement error",
        "A second colony",
        "The population after a crash",
      ],
      correct_index: 0,
      why: "Unbounded exponential growth is the intuition that fails, which is why it is drawn.",
    },
  ],
} as const;
