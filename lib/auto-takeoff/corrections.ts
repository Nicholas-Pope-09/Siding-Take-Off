import type {
  Page,
  Point,
  Section,
  TakeoffSnapshot,
} from "@/lib/takeoff-store"

/**
 * How the estimator's final take-off differs from what the auto take-off
 * produced, item by item. These rows are the raw material for learning
 * estimating rules and size biases later.
 */
export type CorrectionOutcome = "confirmed" | "adjusted" | "deleted" | "added"

export interface CorrectionRow {
  /** stable per project: `${runAt}|${sectionId}` */
  sectionKey: string
  runAt: string
  pageName: string
  elevation: string
  /** window | door | garage_door | wall | gable | deduction (hand-drawn) | line */
  kind: string
  name: string
  outcome: CorrectionOutcome
  confidence: string | null
  model: string
  /** px per foot of the sheet when saved */
  scale: number | null
  scaleSource: string | null
  original: { points: Point[]; pitch?: string } | null
  final: { points: Point[]; pitch?: string } | null
  metrics: CorrectionMetrics | null
}

export interface CorrectionMetrics {
  originalSf: number | null
  finalSf: number | null
  /** inches each bounding-box edge moved outward (negative = moved inward) */
  edgeIn: { left: number; right: number; top: number; bottom: number } | null
  widthIn: number | null
  heightIn: number | null
  pitchChanged: boolean
}

/** Movement under this many blueprint pixels is treated as no change. */
const MOVE_TOLERANCE_PX = 1.5

function polygonArea(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

function bounds(points: Point[]) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  }
}

function geometryChanged(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return true
  return a.some(
    (p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y) > MOVE_TOLERANCE_PX,
  )
}

function kindOf(s: Pick<Section, "type" | "opening" | "geometry">): string {
  if (s.geometry === "line") return "line"
  if (s.type === "deduction") return s.opening ?? "deduction"
  return s.type
}

function metrics(
  original: Point[] | null,
  final: Point[] | null,
  scale: number | null,
  pitchChanged: boolean,
): CorrectionMetrics | null {
  if (!scale) return null
  const sf = (pts: Point[] | null) =>
    pts && pts.length >= 3 ? polygonArea(pts) / (scale * scale) : null
  let edgeIn: CorrectionMetrics["edgeIn"] = null
  let widthIn: number | null = null
  let heightIn: number | null = null
  if (original?.length && final?.length) {
    const o = bounds(original)
    const f = bounds(final)
    const inches = (px: number) => Math.round((px / scale) * 12 * 10) / 10
    edgeIn = {
      left: inches(o.left - f.left),
      right: inches(f.right - o.right),
      top: inches(o.top - f.top),
      bottom: inches(f.bottom - o.bottom),
    }
    widthIn = inches(f.right - f.left - (o.right - o.left))
    heightIn = inches(f.bottom - f.top - (o.bottom - o.top))
  }
  return {
    originalSf: sf(original),
    finalSf: sf(final),
    edgeIn,
    widthIn,
    heightIn,
    pitchChanged,
  }
}

/** Corrections for one sheet's latest auto run (empty if it has none). */
export function pageCorrections(page: Page, sections: Section[]): CorrectionRow[] {
  const run = page.autoTakeoff
  if (!run) return []
  const base = {
    runAt: run.runAt,
    pageName: page.name,
    model: run.model,
    scale: page.scale ?? null,
    scaleSource: page.scaleSource ?? null,
  }
  const rows: CorrectionRow[] = []
  const onPage = sections.filter((s) => s.pageId === page.id)

  for (const s of onPage) {
    if (s.source === "auto" && s.original) {
      const pitchChanged = s.type === "gable" && s.pitch !== s.original.pitch
      const changed = geometryChanged(s.original.points, s.points) || pitchChanged
      // An untouched, unverified item tells us nothing yet.
      if (!changed && !s.verified) continue
      rows.push({
        ...base,
        sectionKey: `${run.runAt}|${s.id}`,
        elevation: s.elevation,
        kind: kindOf(s),
        name: s.name,
        outcome: changed ? "adjusted" : "confirmed",
        confidence: s.confidence ?? null,
        original: s.original,
        final: { points: s.points, pitch: s.pitch },
        metrics: metrics(s.original.points, s.points, base.scale, pitchChanged),
      })
    } else if (
      s.source !== "auto" &&
      s.points.length > 0 &&
      !(run.manualAtRun ?? []).includes(s.id)
    ) {
      rows.push({
        ...base,
        sectionKey: `${run.runAt}|${s.id}`,
        elevation: s.elevation,
        kind: kindOf(s),
        name: s.name,
        outcome: "added",
        confidence: null,
        original: null,
        final: { points: s.points, pitch: s.pitch },
        metrics: metrics(null, s.points, base.scale, false),
      })
    }
  }

  for (const d of page.deletedAuto ?? []) {
    rows.push({
      ...base,
      sectionKey: `${run.runAt}|${d.id}`,
      elevation: d.elevation,
      kind: kindOf({ type: d.type, opening: d.opening, geometry: "area" }),
      name: d.name,
      outcome: "deleted",
      confidence: d.confidence,
      original: { points: d.points },
      final: null,
      metrics: metrics(d.points, null, base.scale, false),
    })
  }
  return rows
}

export function extractCorrections(data: TakeoffSnapshot): CorrectionRow[] {
  return (data.pages ?? []).flatMap((p) => pageCorrections(p, data.sections ?? []))
}
