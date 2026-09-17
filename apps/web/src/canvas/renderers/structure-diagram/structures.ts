/**
 * The data structures the `structure-diagram` renderer draws.
 *
 * These are real implementations, not pictures of implementations. The B-tree does actual
 * sequential insertion with node splits, so the shape on screen is the shape the algorithm
 * produces — including the asymmetries you get from inserting in ascending order.
 *
 * That matters for the product: if we faked a tidy balanced tree, the lab would teach a diagram
 * rather than the algorithm, and the "increase the order and watch the height collapse" moment
 * would be a scripted animation instead of a consequence.
 */

// ── B-tree ────────────────────────────────────────────────────────────────────────────────────

export interface BTreeNode {
  keys: number[];
  children: BTreeNode[];
}

const isLeaf = (n: BTreeNode) => n.children.length === 0;

/**
 * Build a B-tree by inserting 1..count in order, with `order` = maximum children per node
 * (so maximum keys per node is order - 1).
 *
 * Uses the standard preemptive-split insertion: split any full child on the way down, which
 * guarantees there is always room to insert at the leaf.
 */
export function buildBTree(count: number, order: number): BTreeNode {
  const maxKeys = Math.max(1, order - 1);
  let root: BTreeNode = { keys: [], children: [] };

  for (let k = 1; k <= count; k++) {
    if (root.keys.length === maxKeys) {
      // Root is full: grow upward. This is the only way a B-tree gains height, which is why
      // height changes in steps rather than smoothly as you add keys.
      const newRoot: BTreeNode = { keys: [], children: [root] };
      splitChild(newRoot, 0, maxKeys);
      root = newRoot;
    }
    insertNonFull(root, k, maxKeys);
  }
  return root;
}

function splitChild(parent: BTreeNode, i: number, maxKeys: number): void {
  const child = parent.children[i]!;
  const mid = Math.floor(child.keys.length / 2);
  const midKey = child.keys[mid]!;

  const right: BTreeNode = {
    keys: child.keys.slice(mid + 1),
    children: isLeaf(child) ? [] : child.children.slice(mid + 1),
  };
  child.keys = child.keys.slice(0, mid);
  if (!isLeaf(child)) child.children = child.children.slice(0, mid + 1);

  parent.keys.splice(i, 0, midKey);
  parent.children.splice(i + 1, 0, right);
  void maxKeys;
}

function insertNonFull(node: BTreeNode, key: number, maxKeys: number): void {
  if (isLeaf(node)) {
    let i = node.keys.length - 1;
    while (i >= 0 && node.keys[i]! > key) i--;
    node.keys.splice(i + 1, 0, key);
    return;
  }
  let i = node.keys.length - 1;
  while (i >= 0 && node.keys[i]! > key) i--;
  i++;
  if (node.children[i]!.keys.length === maxKeys) {
    splitChild(node, i, maxKeys);
    if (key > node.keys[i]!) i++;
  }
  insertNonFull(node.children[i]!, key, maxKeys);
}

export function btreeHeight(n: BTreeNode): number {
  return isLeaf(n) ? 1 : 1 + btreeHeight(n.children[0]!);
}

export function btreeNodeCount(n: BTreeNode): number {
  return 1 + n.children.reduce((s, c) => s + btreeNodeCount(c), 0);
}

/** Nodes visited to find a key — i.e. disk reads. This is the number the lab is really about. */
export function btreeSearchPath(root: BTreeNode, key: number): BTreeNode[] {
  const path: BTreeNode[] = [];
  let node: BTreeNode | undefined = root;
  while (node) {
    path.push(node);
    if (node.keys.includes(key)) return path;
    if (isLeaf(node)) return path;
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]!) i++;
    node = node.children[i];
  }
  return path;
}

// ── Laid-out geometry, in the renderer's own units ────────────────────────────────────────────

export interface PlacedNode {
  node: BTreeNode;
  depth: number;
  /** Centre, in slot units (0 .. totalSlots). */
  cx: number;
  /** Width in slot units, proportional to how many keys the node holds. */
  width: number;
  onPath: boolean;
}

export interface BTreeLayout {
  placed: PlacedNode[];
  edges: { from: PlacedNode; to: PlacedNode }[];
  depth: number;
  slots: number;
}

/**
 * Lay the tree out by walking the leaves left to right.
 *
 * Leaves take sequential slots; an internal node is centred over its children. This is the
 * standard tidy-tree approach and it keeps sibling subtrees from overlapping without needing a
 * full Reingold–Tilford pass, which would be overkill at these sizes.
 */
export function layoutBTree(root: BTreeNode, highlightPath: BTreeNode[]): BTreeLayout {
  const placed: PlacedNode[] = [];
  const edges: { from: PlacedNode; to: PlacedNode }[] = [];
  const onPath = new Set(highlightPath);
  let cursor = 0;
  let maxDepth = 0;

  const walk = (node: BTreeNode, depth: number): PlacedNode => {
    maxDepth = Math.max(maxDepth, depth);
    const width = Math.max(1, node.keys.length);

    if (isLeaf(node)) {
      const p: PlacedNode = { node, depth, cx: cursor + width / 2, width, onPath: onPath.has(node) };
      cursor += width + 0.6;   // gap so adjacent leaves read as separate nodes
      placed.push(p);
      return p;
    }

    const kids = node.children.map((c) => walk(c, depth + 1));
    const first = kids[0]!;
    const last = kids[kids.length - 1]!;
    const p: PlacedNode = {
      node,
      depth,
      cx: (first.cx + last.cx) / 2,
      width,
      onPath: onPath.has(node),
    };
    placed.push(p);
    for (const k of kids) edges.push({ from: p, to: k });
    return p;
  };

  walk(root, 0);
  return { placed, edges, depth: maxDepth + 1, slots: Math.max(1, cursor) };
}
