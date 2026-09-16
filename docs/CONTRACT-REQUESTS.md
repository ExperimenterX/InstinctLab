# Contract requests

`packages/lab-schema` and `packages/shared` are edited by **API only** (N1, doc 00).

Need a type, field, or limit that doesn't exist? **Do not** add it locally, cast to `any`, or widen
an existing type. Append a request here, then write your code as if the field already exists with a
`TODO(API): CR-###` comment above it, and let the typecheck fail loudly. API sweeps this file.

A failing typecheck at an agreed boundary is a *feature* — it's how seven parallel agents find out
they disagreed, in seconds instead of at integration.

---

## Template

```md
### CR-###  ·  <one-line summary>
- **From:** A#
- **Needs:** `packages/lab-schema/src/<file>.ts` — exact shape you need
- **Why:** what breaks without it (one sentence)
- **Blocking?:** yes / no (can you proceed with a stub?)
- **Status:** open / accepted / rejected / superseded
- **API note:**
```

---

## Requests

### CR-001 · Example — delete when the first real one lands
- **From:** A0
- **Needs:** `src/model.ts` — `Assignment { target: VarId; expr: Expr }` exported as a named type
- **Why:** `Dynamics.step` is `Assignment[]` and BACKEND's expr-vm needs the type to compile a step list
- **Blocking?:** no — BACKEND can inline the shape and swap the import
- **Status:** accepted
- **API note:** exported from `src/model.ts`, re-exported from `src/index.ts`
