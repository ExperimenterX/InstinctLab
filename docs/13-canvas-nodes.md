# 13 — Canvas nodes: how three people build in parallel

> Current scope. Canvas only — no backend, no database, no auth. Supersedes the lane split in
> `MVP.md` §Lanes; everything else in `MVP.md` still holds.

---

## The model

A **node** is one canvas archetype: a visual grammar that a whole class of concepts can be
expressed in. Each node is a self-contained folder, documented, independently compiled, and able
to **spin up as a live interactive lab on its own** — no generator, no API, no other node.

```
src/canvas/
  types.ts            THE SEAM — the ArchetypeNode interface. Shared. Changes need agreement.
  theme.ts            validated palette (light + dark). Shared.
  primitives.ts       grid, axes, ticks, polyline, labels, markers. Shared.
  registry.ts         node lookup. One line added per node.

  archetypes/
    function-plot/    ← reference node, already working
      NODE.md
      schema.ts
      render.ts
      fixture.ts
    grid-automaton/   ← node
    graph-network/    ← node
    …
```

**Nodes never import each other.** A node touches only `types.ts`, `theme.ts`, `primitives.ts`,
and its own folder. That is what makes this parallelisable: three people, three folders, one
one-line registry edit each, no merge conflicts.

Run any node standalone at `/node/<id>` — it mounts that node's own fixture as a full lab, with
knobs, prediction, and quiz. That is the development loop: you never need anyone else's work to
see yours running.

---

## Node assignment

Ten grammars. `function-plot` is done and is the reference — read it before starting yours.

| Person | Nodes | Why these together |
|---|---|---|
| **A** | `grid-automaton`, `particle-field`, `layered-stack` | Spatial. All three place marks in 2D and animate them; shared intuition about per-cell/per-body iteration and fill performance. |
| **B** | `graph-network`, `state-machine`, `pipeline-flow` | Topological. All three are nodes-and-edges underneath — layout, edge routing, and tokens travelling along links. |
| **C** | `sequence-array`, `compounding-ledger`, `free-canvas` | Discrete/indexed. Cells, bars, periods, cursors. `free-canvas` last — it's the escape hatch, only worth building once the other nine exist. |

Order within a person's set is top to bottom. **Ship one node completely before starting the
next** — a finished node is something the generator can target; three half-nodes are nothing.

---

## What "done" means for a node

1. `NODE.md` written (template below)
2. `schema.ts` — config validates, every numeric bounded
3. `render.ts` — `compile` + `draw`, and **`draw` allocates nothing**
4. `fixture.ts` — a real lab that teaches something real
5. Registered in `registry.ts`
6. `/node/<your-id>` runs, the knobs visibly change the picture, and it holds 60fps
7. `npm test` still passes

---

## The rules every node follows

These are not style preferences; each one is a failure mode we've already hit or designed around.

**1. `compile` once, `draw` every frame, `draw` allocates nothing.**
No array literals, no object literals, no template strings for colour inside `draw`. Parse
expressions, resolve colours, and size every buffer in `compile`. An allocation per mark per frame
is a GC sawtooth you can feel while dragging a slider.

**2. Spec space in, pixels out.**
Use `frameOf(cssW, cssH)` and work in your own data coordinates, mapping to the frame. DPR is
already applied to the context transform — never read `devicePixelRatio`.

**3. Never auto-scale an axis on a knob change.**
This is the single easiest way to destroy a lab: a rescaling axis makes a growing curve look
static, hiding the exact effect the learner is meant to notice. Domains come from the spec and
stay put. There is a test asserting this for `function-plot`; write the equivalent for yours.

**4. Colour is semantic and already chosen.**
Use `theme.series[0..2]` and the ink/grid/axis roles from `theme.ts`. No hex in a node. The
palette is validated for CVD separation and contrast in both modes — light-mode `series-3` is
below 3:1, which is why **every series carries a visible direct label**. That label is the
accessibility relief, not decoration; if your node shows multiple series, it must label them.

**5. NaN never reaches the canvas.**
Expression output can be non-finite. Break the path (`moveTo` on the next finite sample); never
pass NaN to a canvas call — it silently kills the rest of the path.

**6. Clamp everything that came from a spec.**
Counts, radii, thicknesses, cell dimensions. A radius of `1e9` is a frozen tab, and specs are
model-authored.

**7. Generous hit targets.**
If your node supports direct manipulation, the pick radius is ≥ 3 spec units regardless of the
drawn size. A learner who can't grab a node concludes the lab is broken.

**8. Above ~2500 marks, stop using per-mark fills.**
`grid-automaton` in particular: at 40k cells, per-cell `fillRect` will not hold frame. Write into
an `ImageData` buffer and `putImageData` once.

---

## `NODE.md` template

Copy this into your node folder and fill it in. It is read by the person who maintains your node
next, and by whoever writes the generator prompt — so the "what makes a good lab here" section is
load-bearing, not filler.

```md
# Node: <id>

## What it draws
One paragraph. The visual grammar, not a topic.

## What class of concepts it fits
Phrased structurally. "Local rules producing global patterns", not "Game of Life".

## Config
| Field | Type | Bounds | Meaning |
|---|---|---|---|

## Interactions
What the learner can do directly on the canvas, and which param each gesture writes.

## What makes a good lab in this grammar
The part only you will know after building it. What makes the mechanism visible? What
configurations are degenerate or boring? What should the generator avoid?

## Performance notes
Mark count where the naive approach stops holding frame, and what to do instead.

## Worked example
The fixture, and one sentence on why it teaches what it teaches.
```

---

## Shared files: changing them needs agreement

`types.ts`, `theme.ts`, `primitives.ts`, `registry.ts`.

If you need a new primitive, add it rather than reimplementing it privately — a second polyline
routine is how two nodes end up looking subtly different. If you need the `ArchetypeNode`
interface to change, say so before you change it: both other people are compiling against it.

---

## Reference node

`archetypes/function-plot/` works end to end and is verified by `npm test` — 56 assertions
covering the expression compiler, the spec parser, and the canvas math (no NaN coordinates, every
point inside the frame, a knob provably moving the curve, the y-axis staying locked).

Read its `render.ts` before writing yours. Copy its structure; the `compile`/`draw` split and the
buffer preallocation are the parts worth imitating.
