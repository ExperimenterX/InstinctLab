import { useEffect, useRef } from "react";
import type { Stage } from "../canvas/stage.js";
import type { RenderCtx } from "../canvas/types.js";
import { drawStage } from "../canvas/stage.js";
import type { LabStore } from "../state/labStore.js";
import type { Mode } from "../canvas/theme.js";

/**
 * The canvas host.
 *
 * It mounts once per spec and takes **no animated props**. Everything that changes during play
 * arrives through the store or through a ref — never as a React prop — so this component does not
 * re-render while the learner drags a knob.
 *
 * `marker` and `dimmed` do change, but they change at interaction rate (a prediction commit), not
 * per frame. They are passed through a ref so even those do not trigger a re-render.
 */
export function LabCanvas({
  plot,
  store,
  mode,
  marker,
  dimmed = false,
}: {
  plot: Stage;
  store: LabStore;
  mode: Mode;
  marker?: RenderCtx["marker"];
  dimmed?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Live values the draw loop reads. Writing a ref does not re-render.
  const overlay = useRef<{ marker: RenderCtx["marker"]; dimmed: boolean; mode: Mode }>({
    marker, dimmed, mode,
  });
  overlay.current = { marker, dimmed, mode };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let cssW = 0;
    let cssH = 0;
    let raf = 0;
    let lastVersion = -1;
    let lastMode: Mode | null = null;
    let lastMarkerKey = "";
    let disposed = false;

    /**
     * Size the BACKING STORE only. The canvas's CSS box is 100%/100% of the wrapper.
     *
     * Writing `canvas.style.width = "<px>"` here caused the canvas to creep wider on its own:
     * the px width fed the grid track's content-based min-size, the track grew, the
     * ResizeObserver fired, we measured the larger box and set a larger width — a loop with no
     * user input. `clientWidth` (not getBoundingClientRect) also keeps this integral, so
     * sub-pixel rounding can't ratchet it upward.
     */
    const resize = () => {
      const w = Math.max(240, wrap.clientWidth);
      const h = Math.max(200, wrap.clientHeight);
      if (w === cssW && h === cssH) return;   // idempotent: identical size does no work

      cssW = w;
      cssH = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // 3x on mobile is wasted fill
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      // Handle DPR exactly once, here. Nothing downstream thinks about device pixels.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastVersion = -1; // force one redraw at the new size
    };

    const frame = () => {
      if (disposed) return;
      const { marker: mk, dimmed: dim, mode: md } = overlay.current;
      const markerKey = mk ? `${mk.kind}:${mk.value}:${mk.label}` : "";
      const v = store.version();

      // Only redraw when something actually changed. A static lab costs nothing, which keeps
      // fans quiet and batteries alive while the learner reads the question.
      if (v !== lastVersion || md !== lastMode || markerKey !== lastMarkerKey) {
        lastVersion = v;
        lastMode = md;
        lastMarkerKey = markerKey;
        try {
          drawStage(plot, ctx, cssW, cssH, { params: store.get(), mode: md, marker: mk, dimmed: dim });
        } catch (e) {
          // Contained at the frame boundary: freeze the last good frame rather than killing the
          // session. The learner can still read the knobs and the question.
          console.error("[canvas] draw failed", e);
          disposed = true;
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // `plot` and `store` are rebuilt together only when the spec changes — a genuine remount.
  }, [plot, store]);

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas ref={canvasRef} role="img" aria-label={plot.spec.title} />
    </div>
  );
}
