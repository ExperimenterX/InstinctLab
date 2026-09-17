import { clearSurface } from "../../primitives.js";
import { seriesColor } from "../../theme.js";
import {
  frameOf, type CanvasRenderer, type CompiledStage, type Frame,
  type NodeAnalysis, type RenderCtx,
} from "../../types.js";
import { StructureDiagramConfigSchema, type StructureDiagramConfig } from "./schema.js";
import {
  buildBTree, btreeHeight, btreeNodeCount, btreeSearchPath, layoutBTree, type BTreeLayout,
} from "./structures.js";
import { STRUCTURE_DIAGRAM_FIXTURE } from "./fixture.js";

/**
 * Boxes and pointers: linked lists and B-trees.
 *
 * Unlike `function-plot`, this renderer cannot precompute its geometry — the structure depends on
 * the knobs, so it is rebuilt when they change. To keep that off the frame path, the build is
 * **memoised on the knob values**: dragging within one configuration costs nothing, and only an
 * actual change pays for a rebuild.
 *
 * Structures are capped hard (`MAX_COUNT`). Config is model-authored, and "insert 10 million
 * keys" would otherwise be a frozen tab.
 */

const MAX_COUNT = 64;
const MAX_ORDER = 8;

interface SDCompiled extends CompiledStage {
  readonly renderer: "structure-diagram";
  cfg: StructureDiagramConfig;
  /** Memo keyed on the knob values that affect the structure. */
  memo: { key: string; btree?: BTreeLayout; count: number; cursor: number } | null;
}

export const structureDiagramRenderer: CanvasRenderer<StructureDiagramConfig> = {
  id: "structure-diagram",
  label: "Structure diagram",
  bestFor:
    "data structures made of nodes and pointers — linked lists, trees, indexes; where the shape determines the cost of an operation",

  configSchema: StructureDiagramConfigSchema,

  analyze(cfg, ctx): NodeAnalysis {
    const errors: string[] = [];
    const warnings: string[] = [];
    const referencedParams = new Set<string>();

    const need = (name: string | undefined, what: string) => {
      if (!name) return;
      if (!ctx.paramIds.includes(name)) {
        errors.push(`${what} "${name}" is not a declared param (have: ${ctx.paramIds.join(", ")}).`);
      } else {
        referencedParams.add(name);
      }
    };

    need(cfg.count_param, "count_param");
    need(cfg.cursor_param, "cursor_param");

    if (cfg.layout === "btree") {
      if (!cfg.order_param) errors.push('layout "btree" requires order_param.');
      else need(cfg.order_param, "order_param");
    }
    if (cfg.layout === "chain" && cfg.order_param) {
      warnings.push('order_param is ignored by layout "chain".');
    }
    if (!cfg.cursor_param) {
      warnings.push(
        "No cursor_param: the diagram will show the structure but not the cost of reaching into it.",
      );
    }

    return { errors, warnings, referencedParams };
  },

  compile(cfg): SDCompiled {
    return { renderer: "structure-diagram", cfg, memo: null };
  },

  /**
   * Facts about the structure, for read-outs.
   *
   * These come from the real built structure, not a formula. For a B-tree built by ascending
   * insertion that difference is large: nodes end up roughly half-full, so the analytic height
   * log_m(n) underestimates the actual depth — 4 vs 6 at order 3 with 64 keys. Reporting the
   * formula would put a number on screen that contradicts the tree next to it.
   */
  derivedNames(cfg) {
    return cfg.layout === "btree"
      ? ["tree_height", "nodes_read", "node_count", "max_keys_per_node"]
      : ["hops", "pointer_writes", "list_length"];
  },

  derive(cfg, params): Record<string, number> {
    const count = clampInt(params[cfg.count_param] ?? 0, 0, MAX_COUNT);
    const cursor = clampInt(cfg.cursor_param ? (params[cfg.cursor_param] ?? 0) : -1, -1, MAX_COUNT);

    if (cfg.layout === "btree") {
      const order = clampInt(cfg.order_param ? (params[cfg.order_param] ?? 3) : 3, 2, MAX_ORDER);
      const root = buildBTree(count, order);
      return {
        tree_height: count === 0 ? 0 : btreeHeight(root),
        // Nodes touched to find the key = page reads. The number the lab is really about.
        nodes_read: count === 0 || cursor < 1 ? 0 : btreeSearchPath(root, cursor).length,
        node_count: count === 0 ? 0 : btreeNodeCount(root),
        max_keys_per_node: Math.max(1, order - 1),
      };
    }
    return {
      // Reaching index k means touching k+1 nodes, bounded by the list itself.
      hops: count === 0 ? 0 : Math.min(Math.max(cursor, 0), count - 1) + 1,
      pointer_writes: 1,
      list_length: count,
    };
  },

  draw(compiled, rc) {
    const c = compiled as SDCompiled;
    const { cfg } = c;
    const f = frameOf(rc.cssW, rc.cssH);

    const count = clampInt(rc.params[cfg.count_param] ?? 0, 0, MAX_COUNT);
    const order = clampInt(cfg.order_param ? (rc.params[cfg.order_param] ?? 3) : 3, 2, MAX_ORDER);
    const cursor = clampInt(cfg.cursor_param ? (rc.params[cfg.cursor_param] ?? 0) : -1, -1, MAX_COUNT);

    clearSurface(rc);

    // Rebuild only when the structure actually changed.
    const key = `${cfg.layout}|${count}|${order}|${cursor}`;
    if (!c.memo || c.memo.key !== key) {
      if (cfg.layout === "btree") {
        const root = buildBTree(count, order);
        const path = cursor > 0 ? btreeSearchPath(root, cursor) : [];
        c.memo = { key, btree: layoutBTree(root, path), count, cursor };
      } else {
        c.memo = { key, count, cursor };
      }
    }

    if (cfg.note) {
      rc.ctx.fillStyle = rc.theme.muted;
      rc.ctx.font = `11px ${rc.theme.font}`;
      rc.ctx.textAlign = "left";
      rc.ctx.textBaseline = "top";
      rc.ctx.fillText(cfg.note, f.left, f.top - 12);
    }

    rc.ctx.save();
    if (rc.dimmed) rc.ctx.globalAlpha = 0.35;
    if (cfg.layout === "btree" && c.memo.btree) drawBTree(rc, f, c.memo.btree, cursor);
    else drawChain(rc, f, count, cursor);
    rc.ctx.restore();
  },

  fixtureJson: STRUCTURE_DIAGRAM_FIXTURE,
};

const clampInt = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(Number.isFinite(v) ? v : lo)));

// ── chain (linked list) ───────────────────────────────────────────────────────────────────────

/**
 * Nodes left to right with next-pointers, wrapping to more rows as the list grows.
 *
 * Everything up to the cursor is drawn in the accent colour: the highlighted run *is* the
 * traversal cost, so the learner sees "reaching index 12 means touching 13 nodes" rather than
 * reading it off a counter.
 */
function drawChain(rc: RenderCtx, f: Frame, count: number, cursor: number): void {
  const { ctx, theme } = rc;
  if (count <= 0) {
    ctx.fillStyle = theme.muted;
    ctx.font = `13px ${theme.font}`;
    ctx.textAlign = "center";
    ctx.fillText("empty list", f.left + f.w / 2, f.top + f.h / 2);
    return;
  }

  const perRow = Math.max(1, Math.min(count, Math.floor(f.w / 74)));
  const rows = Math.ceil(count / perRow);
  const boxW = Math.min(58, (f.w - (perRow - 1) * 16) / perRow);
  const boxH = Math.min(38, f.h / rows - 18);
  const gapX = perRow > 1 ? (f.w - perRow * boxW) / (perRow - 1) : 0;
  const rowH = boxH + 26;
  const y0 = f.top + (f.h - rows * rowH) / 2;

  const pos = (i: number) => ({
    x: f.left + (i % perRow) * (boxW + gapX),
    y: y0 + Math.floor(i / perRow) * rowH,
  });

  ctx.lineWidth = 2;
  ctx.font = `11px ${theme.font}`;

  for (let i = 0; i < count; i++) {
    const { x, y } = pos(i);
    const reached = cursor >= 0 && i <= cursor;
    const isTarget = i === cursor;

    // pointer to the next node
    if (i < count - 1) {
      const n = pos(i + 1);
      const sameRow = Math.floor((i + 1) / perRow) === Math.floor(i / perRow);
      ctx.strokeStyle = reached && i < cursor ? seriesColor(theme, "series-1") : theme.axis;
      ctx.beginPath();
      if (sameRow) {
        ctx.moveTo(x + boxW, y + boxH / 2);
        ctx.lineTo(n.x - 3, y + boxH / 2);
        ctx.lineTo(n.x - 7, y + boxH / 2 - 3);
        ctx.moveTo(n.x - 3, y + boxH / 2);
        ctx.lineTo(n.x - 7, y + boxH / 2 + 3);
      } else {
        // wrap: drop below and come back to the left edge
        ctx.moveTo(x + boxW / 2, y + boxH);
        ctx.lineTo(x + boxW / 2, y + boxH + 10);
        ctx.lineTo(n.x + boxW / 2, n.y - 10);
        ctx.lineTo(n.x + boxW / 2, n.y - 3);
      }
      ctx.stroke();
    }

    ctx.fillStyle = isTarget
      ? seriesColor(theme, "series-2")
      : reached
        ? seriesColor(theme, "series-1")
        : theme.surface;
    ctx.strokeStyle = reached ? "transparent" : theme.axis;
    ctx.beginPath();
    ctx.rect(x, y, boxW, boxH);
    ctx.fill();
    if (!reached) ctx.stroke();

    ctx.fillStyle = reached ? "#ffffff" : theme.textSecondary;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i), x + boxW / 2, y + boxH / 2);
  }

  // `null` terminator — the thing that makes it a list rather than a ring.
  const last = pos(count - 1);
  ctx.fillStyle = theme.muted;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("∅", last.x + boxW + 8, last.y + boxH / 2);
}

// ── btree ─────────────────────────────────────────────────────────────────────────────────────

/** Multi-key nodes by depth, with the search path highlighted. */
function drawBTree(rc: RenderCtx, f: Frame, L: BTreeLayout, cursor: number): void {
  const { ctx, theme } = rc;

  const slotW = Math.min(26, f.w / Math.max(1, L.slots));
  const levelH = Math.min(70, f.h / Math.max(1, L.depth));
  const boxH = Math.min(30, levelH - 22);
  const totalW = L.slots * slotW;
  const ox = f.left + (f.w - totalW) / 2;
  const oy = f.top + (f.h - L.depth * levelH) / 2 + 8;

  const cx = (p: { cx: number }) => ox + p.cx * slotW;
  const cy = (p: { depth: number }) => oy + p.depth * levelH;

  ctx.lineWidth = 1.5;
  for (const e of L.edges) {
    const onPath = e.from.onPath && e.to.onPath;
    ctx.strokeStyle = onPath ? seriesColor(theme, "series-1") : theme.axis;
    ctx.beginPath();
    ctx.moveTo(cx(e.from), cy(e.from) + boxH);
    ctx.lineTo(cx(e.to), cy(e.to));
    ctx.stroke();
  }

  ctx.font = `10px ${theme.font}`;
  for (const p of L.placed) {
    const w = Math.max(slotW * p.width, 16);
    const x = cx(p) - w / 2;
    const y = cy(p);

    ctx.fillStyle = p.onPath ? seriesColor(theme, "series-1") : theme.surface;
    ctx.strokeStyle = p.onPath ? "transparent" : theme.axis;
    ctx.beginPath();
    ctx.rect(x, y, w, boxH);
    ctx.fill();
    if (!p.onPath) ctx.stroke();

    // Key cells, so the branching factor is legible rather than implied by box width.
    const n = p.node.keys.length;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      const kx = x + (w * (i + 0.5)) / n;
      if (i > 0) {
        ctx.strokeStyle = p.onPath ? "rgba(255,255,255,0.45)" : theme.grid;
        ctx.beginPath();
        ctx.moveTo(x + (w * i) / n, y + 3);
        ctx.lineTo(x + (w * i) / n, y + boxH - 3);
        ctx.stroke();
      }
      const key = p.node.keys[i]!;
      const isTarget = key === cursor;
      ctx.fillStyle = isTarget ? seriesColor(theme, "series-2") : p.onPath ? "#ffffff" : theme.textSecondary;
      if (isTarget) {
        ctx.beginPath();
        ctx.arc(kx, y + boxH / 2, Math.min(9, w / n / 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
      }
      if (w / n > 13) ctx.fillText(String(key), kx, y + boxH / 2);
    }
  }
}
