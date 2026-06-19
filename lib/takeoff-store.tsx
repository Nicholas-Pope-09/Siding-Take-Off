"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ElevationId = "front" | "rear" | "left" | "right"

export type SectionType = "wall" | "gable" | "deduction"

export type ToolType = "select" | "calibrate" | "line" | "area" | "rect" | "measure"

export interface Point {
  x: number
  y: number
}

/** A single sheet/page of the plan set — its own blueprint image and scale. */
export interface Page {
  id: string
  name: string
  /** blueprint image as a data URL (or asset path for the sample) */
  blueprint: string
  /** pixels per foot, calibrated independently for this page */
  scale: number | null
}

export interface Section {
  id: string
  /** the page (sheet) this section was measured on */
  pageId: string
  elevation: ElevationId
  name: string
  type: SectionType
  pitch: string // e.g. "flat", "4/12"
  /** measurement geometry in blueprint pixel-space */
  points: Point[]
  /** whether the geometry is a closed polygon (area) or open polyline (line) */
  geometry: "line" | "area"
  material: string
  /** distinct highlight color for this section (from SECTION_PALETTE) */
  color: string
  /** raw measurement: sq ft for area, linear ft for line — before pitch */
  rawValue: number
  /** specific product from the catalog (assigned in Materials view) */
  productId: string | null
}

export interface ElevationMeta {
  id: ElevationId
  label: string
}

export const ELEVATIONS: ElevationMeta[] = [
  { id: "front", label: "Front Elevation" },
  { id: "rear", label: "Rear Elevation" },
  { id: "left", label: "Left Elevation" },
  { id: "right", label: "Right Elevation" },
]

export const SECTION_TYPE_LABEL: Record<SectionType, string> = {
  wall: "Wall",
  gable: "Gable",
  deduction: "Deduction/Window",
}

export const PITCH_OPTIONS = [
  "flat",
  "3/12",
  "4/12",
  "6/12",
  "8/12",
  "10/12",
  "12/12",
] as const

export const MATERIAL_OPTIONS = [
  "Vinyl Lap",
  "Fiber Cement",
  "Cedar Shake",
  "Board & Batten",
  "Stucco",
  "Brick Veneer",
] as const

export const WASTE_FACTOR = 0.1

/**
 * Distinct, high-visibility colors cycled per measured section so each
 * labeled take-off (1A, 1B, 1C…) reads as its own color on the blueprint
 * and across the sidebar + sheet. Violet/purple is intentionally avoided.
 */
export const SECTION_PALETTE = [
  "oklch(0.74 0.17 150)", // green
  "oklch(0.66 0.16 245)", // blue
  "oklch(0.63 0.23 25)", // red
  "oklch(0.79 0.16 75)", // amber
  "oklch(0.73 0.12 195)", // teal
  "oklch(0.7 0.19 45)", // orange
  "oklch(0.68 0.2 350)", // rose
  "oklch(0.8 0.18 125)", // lime
] as const

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function pitchMultiplier(pitch: string): number {
  if (pitch === "flat") return 1
  const rise = Number.parseFloat(pitch.split("/")[0])
  if (Number.isNaN(rise)) return 1
  return Math.sqrt(12 * 12 + rise * rise) / 12
}

/** Polygon area via shoelace, in px² */
function polygonAreaPx(points: Point[]): number {
  if (points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

/** Polyline length in px */
function polylineLengthPx(points: Point[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return len
}

export interface SectionComputed {
  baseArea: number // sq ft (or linear ft for line geometry)
  slopeArea: number // sq ft after pitch multiplier
  multiplier: number
  signed: number // negative for deductions (area only)
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

/**
 * Plain serializable snapshot of a take-off, persisted to the database.
 * `blueprint`/`scale` are legacy top-level fields kept only so older saved
 * projects (pre multi-page) can still be migrated on load.
 */
export interface TakeoffSnapshot {
  pages?: Page[]
  sections: Section[]
  /** @deprecated legacy single-page fields */
  blueprint?: string | null
  /** @deprecated legacy single-page fields */
  scale?: number | null
}

interface TakeoffState {
  // pages
  pages: Page[]
  activePageId: string | null
  /** blueprint of the active page (null if no pages yet) */
  blueprint: string | null
  /** scale (px per foot) of the active page */
  scale: number | null
  sections: Section[]
  selectedSectionId: string | null
  activeTool: ToolType
  // project identity / persistence
  currentProjectId: number | null
  projectName: string
  dirty: boolean
  setProjectName: (name: string) => void
  setCurrentProjectId: (id: number | null) => void
  markSaved: () => void
  serialize: () => TakeoffSnapshot
  loadSnapshot: (
    snapshot: TakeoffSnapshot,
    project: { id: number | null; name: string },
  ) => void
  resetProject: () => void
  // page actions
  addPage: (name: string, blueprint: string) => string
  addPages: (pages: { name: string; blueprint: string }[]) => void
  setActivePage: (id: string) => void
  renamePage: (id: string, name: string) => void
  deletePage: (id: string) => void
  /** replace the active page's blueprint image */
  setActivePageBlueprint: (url: string) => void
  // actions
  setScale: (pxPerFoot: number | null) => void
  setActiveTool: (tool: ToolType) => void
  selectSection: (id: string | null) => void
  addSection: (elevation: ElevationId, type: SectionType) => string
  updateSection: (id: string, patch: Partial<Section>) => void
  deleteSection: (id: string) => void
  setSectionGeometry: (
    id: string,
    points: Point[],
    geometry: "line" | "area",
  ) => void
  compute: (section: Section) => SectionComputed
}

const TakeoffContext = createContext<TakeoffState | null>(null)

let counter = 1
let colorCounter = 0
let pageCounter = 1

export function TakeoffProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<Page[]>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<ToolType>("select")
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null)
  const [projectName, setProjectName] = useState<string>("Untitled Take-off")
  const [dirty, setDirty] = useState<boolean>(false)

  // Active page + its blueprint/scale are derived so the rest of the app can
  // keep reading `blueprint`/`scale` unchanged.
  const activePage = pages.find((p) => p.id === activePageId) ?? null
  const blueprint = activePage?.blueprint ?? null
  const scale = activePage?.scale ?? null

  const addPage = useCallback((name: string, blueprint: string) => {
    const id = `page-${pageCounter++}`
    setPages((prev) => [...prev, { id, name, blueprint, scale: null }])
    setActivePageId(id)
    setSelectedSectionId(null)
    setActiveTool("select")
    setDirty(true)
    return id
  }, [])

  const addPages = useCallback(
    (incoming: { name: string; blueprint: string }[]) => {
      if (incoming.length === 0) return
      const created = incoming.map((p) => ({
        id: `page-${pageCounter++}`,
        name: p.name,
        blueprint: p.blueprint,
        scale: null as number | null,
      }))
      setPages((prev) => [...prev, ...created])
      setActivePageId(created[0].id)
      setSelectedSectionId(null)
      setActiveTool("select")
      setDirty(true)
    },
    [],
  )

  const setActivePage = useCallback((id: string) => {
    setActivePageId(id)
    setSelectedSectionId(null)
    setActiveTool("select")
  }, [])

  const renamePage = useCallback((id: string, name: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p)),
    )
    setDirty(true)
  }, [])

  const deletePage = useCallback((id: string) => {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      const next = prev.filter((p) => p.id !== id)
      // Move the active page to a sensible neighbor if we removed the active one.
      setActivePageId((cur) => {
        if (cur !== id) return cur
        if (next.length === 0) return null
        return next[Math.max(0, idx - 1)].id
      })
      return next
    })
    setSections((prev) => prev.filter((s) => s.pageId !== id))
    setSelectedSectionId(null)
    setDirty(true)
  }, [])

  const setActivePageBlueprint = useCallback(
    (url: string) => {
      if (!activePageId) return
      setPages((prev) =>
        prev.map((p) => (p.id === activePageId ? { ...p, blueprint: url } : p)),
      )
      setDirty(true)
    },
    [activePageId],
  )

  const setScale = useCallback(
    (pxPerFoot: number | null) => {
      if (!activePageId) return
      setPages((prev) =>
        prev.map((p) =>
          p.id === activePageId ? { ...p, scale: pxPerFoot } : p,
        ),
      )
      setDirty(true)
    },
    [activePageId],
  )

  const markSaved = useCallback(() => setDirty(false), [])

  const serialize = useCallback(
    (): TakeoffSnapshot => ({ pages, sections }),
    [pages, sections],
  )

  const loadSnapshot = useCallback(
    (
      snapshot: TakeoffSnapshot,
      project: { id: number | null; name: string },
    ) => {
      // Multi-page snapshot, or migrate a legacy single-blueprint snapshot.
      let loadedPages: Page[]
      let loadedSections = snapshot.sections ?? []
      if (snapshot.pages && snapshot.pages.length > 0) {
        loadedPages = snapshot.pages
      } else if (snapshot.blueprint) {
        const legacyId = "page-1"
        loadedPages = [
          {
            id: legacyId,
            name: "Sheet 1",
            blueprint: snapshot.blueprint,
            scale: snapshot.scale ?? null,
          },
        ]
        // Old sections had no pageId — attach them to the migrated page.
        loadedSections = loadedSections.map((s) => ({
          ...s,
          pageId: s.pageId ?? legacyId,
          productId: s.productId ?? null,
        }))
      } else {
        loadedPages = []
      }
      loadedSections = loadedSections.map((s) => ({
        ...s,
        productId: s.productId ?? null,
      }))

      setPages(loadedPages)
      setActivePageId(loadedPages[0]?.id ?? null)
      setSections(loadedSections)
      setSelectedSectionId(null)
      setActiveTool("select")
      setCurrentProjectId(project.id)
      setProjectName(project.name)
      setDirty(false)
      // Bump id/color/page counters past anything loaded so new ids stay unique.
      for (const s of loadedSections) {
        const n = Number.parseInt(s.id.replace(/^sec-/, ""), 10)
        if (!Number.isNaN(n) && n >= counter) counter = n + 1
      }
      for (const p of loadedPages) {
        const n = Number.parseInt(p.id.replace(/^page-/, ""), 10)
        if (!Number.isNaN(n) && n >= pageCounter) pageCounter = n + 1
      }
      colorCounter = loadedSections.length
    },
    [],
  )

  const resetProject = useCallback(() => {
    setPages([])
    setActivePageId(null)
    setSections([])
    setSelectedSectionId(null)
    setActiveTool("select")
    setCurrentProjectId(null)
    setProjectName("Untitled Take-off")
    setDirty(false)
  }, [])

  const compute = useCallback(
    (section: Section): SectionComputed => {
      const multiplier =
        section.type === "gable" ? pitchMultiplier(section.pitch) : 1
      // Each section is measured against the scale of its own page (sheet),
      // not the currently-active page — so totals stay correct across sheets.
      const pageScale =
        pages.find((p) => p.id === section.pageId)?.scale ?? null
      let base = 0
      if (section.points.length) {
        if (section.geometry === "area") {
          const areaPx = polygonAreaPx(section.points)
          base = pageScale ? areaPx / (pageScale * pageScale) : 0
        } else {
          const lenPx = polylineLengthPx(section.points)
          base = pageScale ? lenPx / pageScale : 0
        }
      }
      const slope = base * multiplier
      const signed = section.type === "deduction" ? -slope : slope
      return {
        baseArea: base,
        slopeArea: slope,
        multiplier,
        signed,
      }
    },
    [pages],
  )

  const addSection = useCallback(
    (elevation: ElevationId, type: SectionType) => {
      const id = `sec-${counter++}`
      const pageId = activePageId
      if (!pageId) return id
      setSections((prev) => {
        const countOfType = prev.filter(
          (s) =>
            s.pageId === pageId &&
            s.elevation === elevation &&
            s.type === type,
        ).length
        const baseName =
          type === "wall"
            ? "Wall"
            : type === "gable"
              ? "Gable"
              : "Deduction"
        const section: Section = {
          id,
          pageId,
          elevation,
          name: `${baseName} ${countOfType + 1}`,
          type,
          pitch: type === "gable" ? "6/12" : "flat",
          points: [],
          geometry: type === "deduction" ? "area" : "area",
          material: "Vinyl Lap",
          color: SECTION_PALETTE[colorCounter++ % SECTION_PALETTE.length],
          rawValue: 0,
          productId: null,
        }
        return [...prev, section]
      })
      setSelectedSectionId(id)
      setDirty(true)
      return id
    },
    [activePageId],
  )

  const updateSection = useCallback((id: string, patch: Partial<Section>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    )
    setDirty(true)
  }, [])

  const deleteSection = useCallback(
    (id: string) => {
      setSections((prev) => prev.filter((s) => s.id !== id))
      setSelectedSectionId((cur) => (cur === id ? null : cur))
      setDirty(true)
    },
    [],
  )

  const setSectionGeometry = useCallback(
    (id: string, points: Point[], geometry: "line" | "area") => {
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, points, geometry } : s)),
      )
      setDirty(true)
    },
    [],
  )

  const value = useMemo<TakeoffState>(
    () => ({
      pages,
      activePageId,
      blueprint,
      scale,
      sections,
      selectedSectionId,
      activeTool,
      currentProjectId,
      projectName,
      dirty,
      setProjectName,
      setCurrentProjectId,
      markSaved,
      serialize,
      loadSnapshot,
      resetProject,
      addPage,
      addPages,
      setActivePage,
      renamePage,
      deletePage,
      setActivePageBlueprint,
      setScale,
      setActiveTool,
      selectSection: setSelectedSectionId,
      addSection,
      updateSection,
      deleteSection,
      setSectionGeometry,
      compute,
    }),
    [
      pages,
      activePageId,
      blueprint,
      scale,
      sections,
      selectedSectionId,
      activeTool,
      currentProjectId,
      projectName,
      dirty,
      markSaved,
      serialize,
      loadSnapshot,
      resetProject,
      addPage,
      addPages,
      setActivePage,
      renamePage,
      deletePage,
      setActivePageBlueprint,
      setScale,
      addSection,
      updateSection,
      deleteSection,
      setSectionGeometry,
      compute,
    ],
  )

  return (
    <TakeoffContext.Provider value={value}>{children}</TakeoffContext.Provider>
  )
}

export function useTakeoff() {
  const ctx = useContext(TakeoffContext)
  if (!ctx) throw new Error("useTakeoff must be used within TakeoffProvider")
  return ctx
}
