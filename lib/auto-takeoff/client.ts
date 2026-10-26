"use client"

import type {
  AutoOpening,
  AutoSurface,
  AutoTakeoffResult,
} from "@/lib/auto-takeoff/schema"
import type {
  Confidence,
  ElevationId,
  OpeningKind,
  Page,
  Point,
  ScaleSource,
  Section,
} from "@/lib/takeoff-store"

/** Longest image edge the vision model reads at full fidelity. */
const MAX_EDGE = 2576

/* ------------------------------------------------------------------ */
/* Image preparation                                                   */
/* ------------------------------------------------------------------ */

export interface PreparedSheet {
  /** base64 (no data: prefix) of the image sent to the model */
  base64: string
  mediaType: "image/png" | "image/jpeg"
  width: number
  height: number
  /** multiply model coordinates by this to get blueprint pixels */
  toBlueprint: number
  /** grayscale of the full-resolution blueprint, for snapping */
  gray: Uint8Array
  fullWidth: number
  fullHeight: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not load the sheet image."))
    img.src = src
  })
}

export async function prepareSheet(blueprint: string): Promise<PreparedSheet> {
  const img = await loadImage(blueprint)
  const fullWidth = img.naturalWidth
  const fullHeight = img.naturalHeight

  // Full-resolution grayscale, used to snap edges onto the drawn lines.
  const full = document.createElement("canvas")
  full.width = fullWidth
  full.height = fullHeight
  const fctx = full.getContext("2d", { willReadFrequently: true })
  if (!fctx) throw new Error("Could not get a 2D canvas context.")
  fctx.fillStyle = "#ffffff"
  fctx.fillRect(0, 0, fullWidth, fullHeight)
  fctx.drawImage(img, 0, 0)
  const rgba = fctx.getImageData(0, 0, fullWidth, fullHeight).data
  const gray = new Uint8Array(fullWidth * fullHeight)
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    gray[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000
  }

  const factor = Math.min(1, MAX_EDGE / Math.max(fullWidth, fullHeight))
  const width = Math.round(fullWidth * factor)
  const height = Math.round(fullHeight * factor)
  const small = document.createElement("canvas")
  small.width = width
  small.height = height
  const sctx = small.getContext("2d")
  if (!sctx) throw new Error("Could not get a 2D canvas context.")
  sctx.fillStyle = "#ffffff"
  sctx.fillRect(0, 0, width, height)
  sctx.imageSmoothingQuality = "high"
  sctx.drawImage(img, 0, 0, width, height)

  // Line drawings compress well as PNG; fall back to JPEG for photo-like scans.
  let dataUrl = small.toDataURL("image/png")
  let mediaType: PreparedSheet["mediaType"] = "image/png"
  if (dataUrl.length > 4_500_000) {
    dataUrl = small.toDataURL("image/jpeg", 0.92)
    mediaType = "image/jpeg"
  }

  return {
    base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mediaType,
    width,
    height,
    toBlueprint: fullWidth / width,
    gray,
    fullWidth,
    fullHeight,
  }
}

/* ------------------------------------------------------------------ */
/* Self-calibration                                                    */
/* ------------------------------------------------------------------ */

export interface Calibration {
  scale: number
  source: ScaleSource
  confidence: Confidence
  note: string
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const pct = (a: number, b: number) => Math.abs(a - b) / b

/**
 * Work out pixels-per-foot from up to three independent sources, best first:
 * the printed scale (exact for PDFs, whose paper size is known), printed
 * dimension strings, and standard-size items such as doors. Sources are
 * cross-checked so a reduced-size print or a misread is called out.
 */
export function calibrate(
  result: AutoTakeoffResult,
  toBlueprint: number,
  pxPerInch: number | null | undefined,
): Calibration | null {
  const refs = result.scaleReferences
    .map((r) => {
      const px =
        Math.hypot(r.end.x - r.start.x, r.end.y - r.start.y) * toBlueprint
      return { ...r, pxPerFoot: r.feet > 0 && px > 20 ? px / r.feet : 0 }
    })
    .filter((r) => r.pxPerFoot > 0)
  const dims = refs.filter((r) => r.kind === "dimension")
  const stds = refs.filter((r) => r.kind === "standard_size")

  const notation =
    pxPerInch && result.paperInchesPerFoot && result.paperInchesPerFoot > 0
      ? pxPerInch * result.paperInchesPerFoot
      : null
  const dimScale = dims.length ? median(dims.map((r) => r.pxPerFoot)) : null
  const label = result.scaleNotation ?? "printed scale"

  if (notation && dimScale) {
    const diff = pct(notation, dimScale)
    if (diff <= 0.06) {
      return {
        scale: notation,
        source: "auto-notation",
        confidence: "high",
        note: `From ${label}, confirmed by ${dims.length} printed dimension${dims.length > 1 ? "s" : ""} (within ${(diff * 100).toFixed(1)}%).`,
      }
    }
    return {
      scale: dimScale,
      source: "auto-dimension",
      confidence: "medium",
      note: `${label} disagrees with the printed dimensions by ${(diff * 100).toFixed(0)}% (the set may be printed reduced), so the scale comes from ${dims.length} dimension${dims.length > 1 ? "s" : ""}: ${dims.map((d) => d.description).join("; ")}.`,
    }
  }
  if (notation) {
    return {
      scale: notation,
      source: "auto-notation",
      confidence: "medium",
      note: `From ${label} on a PDF sheet. No printed dimensions to cross-check, so check one known length.`,
    }
  }
  if (dimScale) {
    const spread =
      dims.length > 1
        ? Math.max(...dims.map((d) => pct(d.pxPerFoot, dimScale)))
        : 1
    return {
      scale: dimScale,
      source: "auto-dimension",
      confidence: dims.length > 1 && spread <= 0.04 ? "high" : "medium",
      note: `From ${dims.length} printed dimension${dims.length > 1 ? "s" : ""}: ${dims.map((d) => d.description).join("; ")}.`,
    }
  }
  if (stds.length) {
    return {
      scale: median(stds.map((r) => r.pxPerFoot)),
      source: "auto-standard",
      confidence: "low",
      note: `Estimated from standard sizes (${stds.map((d) => d.description).join("; ")}). No scale or dimensions were found, so verify with a known length.`,
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Edge snapping                                                       */
/* ------------------------------------------------------------------ */

const DARK = 140

/** Fraction of a horizontal (or vertical) run that is drawn ink, ±1px thick. */
function lineInk(
  sheet: PreparedSheet,
  horizontal: boolean,
  at: number,
  from: number,
  to: number,
): number {
  const { gray, fullWidth: W, fullHeight: H } = sheet
  const a = Math.max(0, Math.round(Math.min(from, to)))
  const b = Math.min(horizontal ? W - 1 : H - 1, Math.round(Math.max(from, to)))
  if (b <= a) return 0
  let hits = 0
  for (let t = a; t <= b; t++) {
    let dark = false
    for (let d = -1; d <= 1 && !dark; d++) {
      const c = Math.round(at) + d
      if (horizontal) {
        if (c >= 0 && c < H && gray[c * W + t] < DARK) dark = true
      } else if (c >= 0 && c < W && gray[t * W + c] < DARK) dark = true
    }
    if (dark) hits++
  }
  return hits / (b - a + 1)
}

/** Move a horizontal/vertical edge onto the nearest strong drawn line. */
function snapEdge(
  sheet: PreparedSheet,
  horizontal: boolean,
  at: number,
  from: number,
  to: number,
): number {
  const radius = Math.max(4, Math.round(0.006 * Math.max(sheet.fullWidth, sheet.fullHeight)))
  // Score the central 80% of the edge so corners/neighbouring lines don't dominate.
  const inset = (to - from) * 0.1
  let best = at
  let bestScore = -1
  for (let o = -radius; o <= radius; o++) {
    const score =
      lineInk(sheet, horizontal, at + o, from + inset, to - inset) -
      0.01 * Math.abs(o)
    if (score > bestScore) {
      bestScore = score
      best = at + o
    }
  }
  return bestScore >= 0.5 ? best : at
}

function snapBox(sheet: PreparedSheet, box: AutoOpening["box"], k: number) {
  const l = box.left * k
  const r = box.right * k
  const t = box.top * k
  const b = box.bottom * k
  const left = snapEdge(sheet, false, l, t, b)
  const right = snapEdge(sheet, false, r, t, b)
  const top = snapEdge(sheet, true, t, l, r)
  const bottom = snapEdge(sheet, true, b, l, r)
  return { left, right, top, bottom }
}

/** Snap the near-horizontal and near-vertical edges of an outline. */
function snapOutline(sheet: PreparedSheet, pts: Point[]): Point[] {
  const n = pts.length
  const xs: number[][] = pts.map(() => [])
  const ys: number[][] = pts.map(() => [])
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    if (dx > 20 && dy < dx * 0.03) {
      const y = snapEdge(sheet, true, (a.y + b.y) / 2, a.x, b.x)
      ys[i].push(y)
      ys[(i + 1) % n].push(y)
    } else if (dy > 20 && dx < dy * 0.03) {
      const x = snapEdge(sheet, false, (a.x + b.x) / 2, a.y, b.y)
      xs[i].push(x)
      xs[(i + 1) % n].push(x)
    }
  }
  const avg = (v: number[], d: number) =>
    v.length ? v.reduce((s, x) => s + x, 0) / v.length : d
  return pts.map((p, i) => ({ x: avg(xs[i], p.x), y: avg(ys[i], p.y) }))
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

/** Ray-casting point-in-polygon test. */
function insidePolygon(pt: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside
  }
  return inside
}

/** Clip a box to the bounding box of an outline. */
function clipToBounds(
  box: { left: number; top: number; right: number; bottom: number },
  poly: Point[],
) {
  const xs = poly.map((p) => p.x)
  const ys = poly.map((p) => p.y)
  return {
    left: Math.max(box.left, Math.min(...xs)),
    right: Math.min(box.right, Math.max(...xs)),
    top: Math.max(box.top, Math.min(...ys)),
    bottom: Math.min(box.bottom, Math.max(...ys)),
  }
}

type NewSection = Omit<Section, "id" | "pageId" | "color" | "rawValue" | "productId">

const PREFIX: Record<ElevationId, string> = {
  front: "F",
  rear: "R",
  left: "L",
  right: "Rt",
}

const CLADDING_MATERIAL: Partial<Record<AutoSurface["cladding"], string>> = {
  board_and_batten: "Board & Batten",
  shake: "Cedar Shake",
  stucco: "Stucco",
  brick: "Brick Veneer",
}

const CLADDING_LABEL: Record<AutoSurface["cladding"], string> = {
  lap_siding: "lap siding",
  board_and_batten: "board & batten",
  shake: "shakes",
  stucco: "stucco",
  brick: "brick",
  stone: "stone",
  unknown: "cladding not identified",
}

const OPENING_LABEL: Record<OpeningKind, string> = {
  window: "W",
  door: "D",
  garage_door: "GD",
}

function normalizePitch(pitch: string | null): string {
  const m = pitch?.match(/(\d+(?:\.\d+)?)\s*\/\s*12/)
  return m ? `${m[1]}/12` : "6/12"
}

/** Turn the model's read into labeled, snapped sections in blueprint pixels. */
export function buildSections(
  result: AutoTakeoffResult,
  sheet: PreparedSheet,
): NewSection[] {
  const k = sheet.toBlueprint
  const out: NewSection[] = []
  // Snapped outlines of this elevation's surfaces, for clipping openings.
  let surfaces: { name: string; points: Point[] }[] = []

  for (const el of result.elevations) {
    const p = PREFIX[el.elevation]
    surfaces = []
    let walls = 0
    let gables = 0
    const openingCounts: Record<OpeningKind, number> = {
      window: 0,
      door: 0,
      garage_door: 0,
    }

    for (const s of el.surfaces) {
      if (s.outline.length < 3) continue
      const scaled = s.outline.map((pt) => ({ x: pt.x * k, y: pt.y * k }))
      const isGable = s.kind === "gable"
      const n = isGable ? ++gables : ++walls
      const name = `${p}-${isGable ? "Gable" : "Wall"} ${n}`
      const points = snapOutline(sheet, scaled)
      surfaces.push({ name, points })
      out.push({
        elevation: el.elevation,
        name,
        type: isGable ? "gable" : "wall",
        pitch: isGable ? normalizePitch(s.pitch) : "flat",
        points,
        geometry: "area",
        material: CLADDING_MATERIAL[s.cladding] ?? "Vinyl Lap",
        source: "auto",
        verified: false,
        confidence: s.confidence,
        opening: null,
        note: [s.description, CLADDING_LABEL[s.cladding], isGable && s.pitch ? `pitch ${s.pitch}` : null]
          .filter(Boolean)
          .join(" · "),
      })
    }

    for (const o of el.openings) {
      const snapped = snapBox(sheet, o.box, k)
      // Only deduct the part of the opening that lies on a measured surface,
      // e.g. a garage door that runs below the wall outline down to the slab.
      const host = surfaces.find((s) =>
        insidePolygon(
          { x: (snapped.left + snapped.right) / 2, y: (snapped.top + snapped.bottom) / 2 },
          s.points,
        ),
      )
      const box = host ? clipToBounds(snapped, host.points) : snapped
      const clipped =
        host &&
        (box.left !== snapped.left ||
          box.right !== snapped.right ||
          box.top !== snapped.top ||
          box.bottom !== snapped.bottom)
      if (box.right - box.left < 4 || box.bottom - box.top < 4) continue
      const n = ++openingCounts[o.kind]
      out.push({
        elevation: el.elevation,
        name: `${p}-${OPENING_LABEL[o.kind]}${n}`,
        type: "deduction",
        pitch: "flat",
        points: [
          { x: box.left, y: box.top },
          { x: box.right, y: box.top },
          { x: box.right, y: box.bottom },
          { x: box.left, y: box.bottom },
        ],
        geometry: "area",
        material: "Vinyl Lap",
        source: "auto",
        verified: false,
        confidence: o.confidence,
        opening: o.kind,
        note: [
          o.kind === "garage_door" ? "garage door" : o.kind,
          o.tag ? `mark ${o.tag}` : null,
          o.sizeCallout ? `callout ${o.sizeCallout}` : null,
          clipped ? `trimmed to ${host.name}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** 3.0 -> 3'-0", 6.67 -> 6'-8" */
export function feetInches(feet: number): string {
  let ft = Math.floor(feet)
  let inch = Math.round((feet - ft) * 12)
  if (inch === 12) {
    ft += 1
    inch = 0
  }
  return `${ft}'-${inch}"`
}

/** Width × height of an axis-aligned outline, in feet. */
export function boxFeet(points: Point[], scale: number) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    w: (Math.max(...xs) - Math.min(...xs)) / scale,
    h: (Math.max(...ys) - Math.min(...ys)) / scale,
  }
}

/** True when a page's scale was set by hand (legacy pages had no source). */
export function isManualScale(page: Page): boolean {
  return Boolean(page.scale) && (!page.scaleSource || page.scaleSource === "manual")
}
