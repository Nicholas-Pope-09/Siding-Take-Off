"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { PdfPagePicker, type PickedPage } from "@/components/pdf-page-picker"
import {
  PITCH_OPTIONS,
  pitchMultiplier,
  useTakeoff,
  type Point,
  type ToolType,
} from "@/lib/takeoff-store"
import {
  MousePointer2,
  Ruler,
  Spline,
  Maximize,
  ZoomIn,
  ZoomOut,
  Upload,
  Triangle,
  Check,
  X,
  Crop,
  Crosshair,
  GripVertical,
  RectangleHorizontal,
  Plus,
  Pencil,
} from "lucide-react"

const TOOLS: {
  id: ToolType
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "select", label: "Pan / Select", hint: "Drag to pan, click a shape to select", icon: MousePointer2 },
  { id: "calibrate", label: "Calibrate Scale", hint: "Draw a line of known length", icon: Ruler },
  { id: "line", label: "Measure Line", hint: "Trim & perimeter (linear ft)", icon: Spline },
  { id: "rect", label: "Rectangle Area", hint: "Click two opposite corners (sq ft)", icon: RectangleHorizontal },
  { id: "area", label: "Polygon Area", hint: "Click each corner for irregular shapes (sq ft)", icon: Crop },
]

/** Build an axis-aligned rectangle (4 ordered corners) from two opposite corners. */
function rectCorners(a: Point, b: Point): Point[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y },
  ]
}

function centroid(points: Point[]): Point {
  const n = points.length
  if (!n) return { x: 0, y: 0 }
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  }
}

export function TakeoffCanvas() {
  const {
    pages,
    activePageId,
    addPage,
    addPages,
    setActivePage,
    renamePage,
    deletePage,
    setActivePageBlueprint,
    blueprint,
    scale,
    setScale,
    activeTool,
    setActiveTool,
    sections,
    selectedSectionId,
    selectSection,
    setSectionGeometry,
    updateSection,
    compute,
  } = useTakeoff()

  const svgRef = useRef<SVGSVGElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pitchPanelRef = useRef<HTMLDivElement>(null)
  // null = default docked top-right; otherwise a dragged {x,y} inside the canvas.
  const [pitchPos, setPitchPos] = useState<{ x: number; y: number } | null>(null)

  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [draft, setDraft] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [calib, setCalib] = useState<{ pts: Point[]; open: boolean; feet: string }>({
    pts: [],
    open: false,
    feet: "",
  })
  const panRef = useRef<{ active: boolean; sx: number; sy: number; tx: number; ty: number }>({
    active: false,
    sx: 0,
    sy: 0,
    tx: 0,
    ty: 0,
  })

  const selected = sections.find((s) => s.id === selectedSectionId) ?? null
  // Only the active page's geometry is drawn on the canvas.
  const pageSections = sections.filter((s) => s.pageId === activePageId)
  const drawingTool =
    activeTool === "line" || activeTool === "area" || activeTool === "rect"
  const areaTool = activeTool === "area" || activeTool === "rect"

  /* ----- coordinate helpers ----- */
  const screenToImage = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const sx = clientX - rect.left
      const sy = clientY - rect.top
      return { x: (sx - view.tx) / view.scale, y: (sy - view.ty) / view.scale }
    },
    [view],
  )

  /* ----- fit image to container ----- */
  const fitView = useCallback(
    (size: { w: number; h: number }) => {
      const c = containerRef.current
      if (!c) return
      const cw = c.clientWidth
      const ch = c.clientHeight
      const s = Math.min(cw / size.w, ch / size.h) * 0.92
      setView({
        scale: s,
        tx: (cw - size.w * s) / 2,
        ty: (ch - size.h * s) / 2,
      })
    },
    [],
  )

  /* ----- file upload ----- */
  const loadFile = useCallback(
    (file: File) => {
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
      if (isPdf) {
        // Defer to the page picker; it renders the chosen sheet to an image.
        setPdfFile(file)
        return
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload a PDF, PNG, or JPG of the blueprint.")
        return
      }
      // Read as a data URL (not an object URL) so the blueprint can be saved
      // to a project and survive a reload.
      const reader = new FileReader()
      reader.onload = () => {
        const name = file.name.replace(/\.[^.]+$/, "") || `Sheet ${pages.length + 1}`
        addPage(name, reader.result as string)
        toast.success("Sheet added. Calibrate its scale to begin.")
      }
      reader.onerror = () => toast.error("Could not read that image file.")
      reader.readAsDataURL(file)
    },
    [addPage, pages.length],
  )

  const handlePdfPages = useCallback(
    (picked: PickedPage[]) => {
      addPages(picked.map((p) => ({ name: p.label, blueprint: p.dataUrl })))
      setPdfFile(null)
      toast.success(
        picked.length === 1
          ? "Sheet added. Calibrate its scale to begin."
          : `${picked.length} sheets added. Calibrate each one's scale.`,
      )
    },
    [addPages],
  )

  const loadSample = useCallback(() => {
    addPage("Sample Elevation", "/sample-elevation.png")
    toast.success("Sample sheet loaded. Calibrate the scale to begin.")
  }, [addPage])

  // Replace the active sheet's image in place (keeps its measurements/scale).
  const replaceFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Replacement must be a PNG or JPG image.")
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setActivePageBlueprint(reader.result as string)
        toast.success("Sheet image replaced.")
      }
      reader.onerror = () => toast.error("Could not read that image file.")
      reader.readAsDataURL(file)
    },
    [setActivePageBlueprint],
  )

  /* ----- finishing a draft ----- */
  const finishDraft = useCallback(() => {
    if (!drawingTool) return
    const min = areaTool ? 3 : 2
    if (draft.length < min) {
      toast.error(
        areaTool
          ? "An area needs at least 3 points."
          : "A line needs at least 2 points.",
      )
      return
    }
    if (!selected) {
      toast.error("Select a section in the left panel before measuring.")
      return
    }
    setSectionGeometry(selected.id, draft, areaTool ? "area" : "line")
    setDraft([])
    setCursor(null)
    setActiveTool("select")
    toast.success(`Measurement applied to ${selected.name}.`)
  }, [areaTool, draft, drawingTool, selected, setActiveTool, setSectionGeometry])

  const cancelDraft = useCallback(() => {
    setDraft([])
    setCursor(null)
    setCalib((c) => ({ ...c, pts: [] }))
  }, [])

  /* ----- keyboard ----- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cancelDraft()
      if (e.key === "Enter" && drawingTool) finishDraft()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [cancelDraft, finishDraft, drawingTool])

  /* ----- pointer interactions ----- */
  function handlePointerDown(e: React.PointerEvent) {
    if (!blueprint) return
    if (activeTool === "select") {
      panRef.current = {
        active: true,
        sx: e.clientX,
        sy: e.clientY,
        tx: view.tx,
        ty: view.ty,
      }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (panRef.current.active) {
      setView((v) => ({
        ...v,
        tx: panRef.current.tx + (e.clientX - panRef.current.sx),
        ty: panRef.current.ty + (e.clientY - panRef.current.sy),
      }))
      return
    }
    if (drawingTool || activeTool === "calibrate") {
      setCursor(screenToImage(e.clientX, e.clientY))
    }
  }

  function handlePointerUp() {
    panRef.current.active = false
  }

  function handleClick(e: React.MouseEvent) {
    if (!blueprint || panRef.current.active) return
    const p = screenToImage(e.clientX, e.clientY)
    if (activeTool === "calibrate") {
      setCalib((c) => {
        const pts = [...c.pts, p]
        if (pts.length === 2) return { pts, open: true, feet: "" }
        return { ...c, pts }
      })
      return
    }
    if (drawingTool) {
      if (!selected) {
        toast.error("Select a section first, then draw your measurement.")
        return
      }
      // Screen-space tolerance (in image units) for snap/dedupe.
      const tol = 10 / view.scale

      // Rectangle: first click sets a corner, second click sets the opposite
      // corner and commits a perfect 4-corner rectangle (no self-intersection).
      if (activeTool === "rect") {
        if (draft.length === 0) {
          setDraft([p])
          return
        }
        const a = draft[0]
        if (Math.hypot(p.x - a.x, p.y - a.y) < tol) return // ignore tiny rect
        const corners = rectCorners(a, p)
        setSectionGeometry(selected.id, corners, "area")
        setDraft([])
        setCursor(null)
        setActiveTool("select")
        toast.success(`Measurement applied to ${selected.name}.`)
        return
      }

      // Click on/near the first vertex to close a polygon area.
      if (activeTool === "area" && draft.length >= 3) {
        const first = draft[0]
        if (Math.hypot(p.x - first.x, p.y - first.y) < tol) {
          finishDraft()
          return
        }
      }
      // Ignore a click that lands on the previous point (also strips the
      // duplicate point a double-click would otherwise add).
      const last = draft[draft.length - 1]
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < tol) return
      setDraft((d) => [...d, p])
    }
  }

  function handleWheel(e: React.WheelEvent) {
    if (!blueprint) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    setView((v) => {
      const ns = Math.min(Math.max(v.scale * factor, 0.08), 12)
      const k = ns / v.scale
      return { scale: ns, tx: sx - (sx - v.tx) * k, ty: sy - (sy - v.ty) * k }
    })
  }

  function confirmCalibration() {
    const feet = Number.parseFloat(calib.feet)
    if (!feet || feet <= 0) {
      toast.error("Enter a valid length in feet.")
      return
    }
    const [a, b] = calib.pts
    const px = Math.hypot(b.x - a.x, b.y - a.y)
    const pxPerFoot = px / feet
    setScale(pxPerFoot)
    setCalib({ pts: [], open: false, feet: "" })
    setActiveTool("select")
    toast.success(`Scale set: ${pxPerFoot.toFixed(1)} px = 1 ft`)
  }

  const zoom = (factor: number) => {
    const c = containerRef.current
    if (!c) return
    const sx = c.clientWidth / 2
    const sy = c.clientHeight / 2
    setView((v) => {
      const ns = Math.min(Math.max(v.scale * factor, 0.08), 12)
      const k = ns / v.scale
      return { scale: ns, tx: sx - (sx - v.tx) * k, ty: sy - (sy - v.ty) * k }
    })
  }

  /* ----- drag the floating pitch panel out of the way ----- */
  function startPitchDrag(e: React.PointerEvent) {
    e.preventDefault()
    const container = containerRef.current
    const panel = pitchPanelRef.current
    if (!container || !panel) return
    const crect = container.getBoundingClientRect()
    const prect = panel.getBoundingClientRect()
    const offX = e.clientX - prect.left
    const offY = e.clientY - prect.top
    const move = (ev: PointerEvent) => {
      const maxX = crect.width - prect.width
      const maxY = crect.height - prect.height
      const x = Math.min(Math.max(ev.clientX - crect.left - offX, 0), Math.max(maxX, 0))
      const y = Math.min(Math.max(ev.clientY - crect.top - offY, 0), Math.max(maxY, 0))
      setPitchPos({ x, y })
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const inv = 1 / view.scale

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-card/40 px-4 py-2.5">
        <ToggleGroup
          value={[activeTool]}
          onValueChange={(val) => {
            const next = (val[0] ?? "select") as ToolType
            setActiveTool(next)
            cancelDraft()
          }}
          className="gap-1"
        >
          {TOOLS.map((t) => (
            <Tooltip key={t.id}>
              <TooltipTrigger
                render={
                  <ToggleGroupItem
                    value={t.id}
                    aria-label={t.label}
                    disabled={!blueprint}
                    className={cn(
                      "h-9 gap-2 px-3 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground",
                    )}
                  >
                    <t.icon className="size-4" />
                    <span className="hidden text-xs font-medium lg:inline">
                      {t.label}
                    </span>
                  </ToggleGroupItem>
                }
              />
              <TooltipContent>
                <p className="font-medium">{t.label}</p>
                <p className="text-muted-foreground">{t.hint}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>

        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant={scale ? "secondary" : "outline"}
            className={cn(
              "gap-1.5 font-mono",
              !scale && "border-accent/50 text-accent",
            )}
          >
            <Crosshair className="size-3" />
            {scale ? `${scale.toFixed(1)} px/ft` : "Not calibrated"}
          </Badge>
          <Separator />
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!blueprint}
              onClick={() => zoom(1 / 1.2)}
              aria-label="Zoom out"
            >
              <ZoomOut className="size-4" />
            </Button>
            <span className="w-12 text-center font-mono text-xs text-muted-foreground">
              {Math.round(view.scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!blueprint}
              onClick={() => zoom(1.2)}
              aria-label="Zoom in"
            >
              <ZoomIn className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={!imgSize}
              onClick={() => imgSize && fitView(imgSize)}
              aria-label="Fit to screen"
            >
              <Maximize className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Page tabs */}
      {pages.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-card/20 px-3 py-1.5">
          {pages.map((p) => {
            const isActive = p.id === activePageId
            const isEditing = editingPageId === p.id
            const pageSectionCount = sections.filter(
              (s) => s.pageId === p.id,
            ).length
            return (
              <div
                key={p.id}
                className={cn(
                  "group flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                  isActive
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => {
                      renamePage(p.id, editingName.trim() || p.name)
                      setEditingPageId(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renamePage(p.id, editingName.trim() || p.name)
                        setEditingPageId(null)
                      }
                      if (e.key === "Escape") setEditingPageId(null)
                    }}
                    className="w-28 rounded border border-input bg-background px-1 py-0.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setActivePage(p.id)}
                    onDoubleClick={() => {
                      setEditingPageId(p.id)
                      setEditingName(p.name)
                    }}
                    className="flex items-center gap-1.5 font-medium"
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        p.scale ? "bg-primary" : "bg-accent",
                      )}
                      aria-label={p.scale ? "Calibrated" : "Not calibrated"}
                    />
                    <span className="max-w-[10rem] truncate">{p.name}</span>
                    {pageSectionCount > 0 && (
                      <Badge
                        variant="secondary"
                        className="h-4 px-1 text-[10px] tabular-nums"
                      >
                        {pageSectionCount}
                      </Badge>
                    )}
                  </button>
                )}
                {isActive && !isEditing && (
                  <span className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPageId(p.id)
                        setEditingName(p.name)
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={`Rename ${p.name}`}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          pageSectionCount === 0 ||
                          window.confirm(
                            `Delete "${p.name}" and its ${pageSectionCount} measurement(s)?`,
                          )
                        ) {
                          deletePage(p.id)
                        }
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${p.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                )}
              </div>
            )
          })}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => fileRef.current?.click()}
          >
            <Plus className="size-3.5" />
            Add sheet
          </Button>
        </div>
      )}

      {/* Canvas surface */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:24px_24px]"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) loadFile(f)
            e.target.value = ""
          }}
        />
        <input
          ref={replaceRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) replaceFile(f)
            e.target.value = ""
          }}
        />

        <PdfPagePicker
          file={pdfFile}
          onCancel={() => setPdfFile(null)}
          onSelect={handlePdfPages}
        />

        {!blueprint ? (
          <UploadPrompt
            onPick={() => fileRef.current?.click()}
            onSample={loadSample}
            onDropFile={loadFile}
          />
        ) : (
          <svg
            ref={svgRef}
            className={cn(
              "size-full touch-none select-none",
              activeTool === "select" && "cursor-grab active:cursor-grabbing",
              (drawingTool || activeTool === "calibrate") && "cursor-crosshair",
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={handleClick}
            onDoubleClick={() => drawingTool && finishDraft()}
            onWheel={handleWheel}
          >
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
              {imgSize && (
                <image
                  href={blueprint}
                  width={imgSize.w}
                  height={imgSize.h}
                  preserveAspectRatio="none"
                />
              )}

              {/* committed sections (active page only) */}
              {pageSections.map((s) => {
                if (s.points.length === 0) return null
                const color = s.color
                const isSel = s.id === selectedSectionId
                const cen = centroid(s.points)
                const c = compute(s)
                const pointsStr = s.points.map((p) => `${p.x},${p.y}`).join(" ")
                return (
                  <g key={s.id} onClick={() => selectSection(s.id)}>
                    {s.geometry === "area" ? (
                      <polygon
                        points={pointsStr}
                        fill={color}
                        fillOpacity={isSel ? 0.32 : 0.16}
                        stroke={color}
                        strokeWidth={isSel ? 3 : 2}
                        vectorEffect="non-scaling-stroke"
                        className="cursor-pointer"
                      />
                    ) : (
                      <polyline
                        points={pointsStr}
                        fill="none"
                        stroke={color}
                        strokeWidth={isSel ? 4 : 2.5}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        className="cursor-pointer"
                      />
                    )}
                    {s.points.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={4 * inv}
                        fill="var(--background)"
                        stroke={color}
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {scale && (
                      <g transform={`translate(${cen.x} ${cen.y})`}>
                        <foreignObject
                          x={-54 * inv}
                          y={-16 * inv}
                          width={108 * inv}
                          height={32 * inv}
                        >
                          <div
                            style={{ transform: `scale(${inv})`, transformOrigin: "top left", width: 108, height: 32 }}
                          >
                            <div className="flex w-full items-center justify-center">
                              <span
                                className="rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums text-background shadow"
                                style={{ background: color }}
                              >
                                {s.geometry === "area"
                                  ? `${c.slopeArea.toFixed(0)} sf`
                                  : `${c.baseArea.toFixed(0)} lf`}
                              </span>
                            </div>
                          </div>
                        </foreignObject>
                      </g>
                    )}
                  </g>
                )
              })}

              {/* draft */}
              {draft.length > 0 && (
                <g>
                  {activeTool === "rect" ? (
                    <polygon
                      points={rectCorners(draft[0], cursor ?? draft[0])
                        .map((p) => `${p.x},${p.y}`)
                        .join(" ")}
                      fill={selected ? selected.color : "var(--accent)"}
                      fillOpacity={0.18}
                      stroke={selected ? selected.color : "var(--accent)"}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : activeTool === "area" ? (
                    <polygon
                      points={
                        [...draft, ...(cursor ? [cursor] : [])]
                          .map((p) => `${p.x},${p.y}`)
                          .join(" ")
                      }
                      fill={selected ? selected.color : "var(--accent)"}
                      fillOpacity={0.18}
                      stroke={selected ? selected.color : "var(--accent)"}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : (
                    <polyline
                      points={
                        [...draft, ...(cursor ? [cursor] : [])]
                          .map((p) => `${p.x},${p.y}`)
                          .join(" ")
                      }
                      fill="none"
                      stroke={selected ? selected.color : "var(--accent)"}
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {draft.map((p, i) => {
                    const closeTarget =
                      activeTool === "area" && i === 0 && draft.length >= 3
                    return (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={(closeTarget ? 7 : 4) * inv}
                        fill={closeTarget ? "var(--background)" : "var(--accent)"}
                        stroke={closeTarget ? "var(--accent)" : "var(--background)"}
                        strokeWidth={closeTarget ? 3 : 2}
                        vectorEffect="non-scaling-stroke"
                        className={closeTarget ? "cursor-pointer" : undefined}
                      />
                    )
                  })}
                </g>
              )}

              {/* calibration line */}
              {calib.pts.length > 0 && (
                <g>
                  <polyline
                    points={[...calib.pts, ...(cursor && calib.pts.length < 2 ? [cursor] : [])]
                      .map((p) => `${p.x},${p.y}`)
                      .join(" ")}
                    fill="none"
                    stroke="var(--tool-calibrate)"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                  {calib.pts.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={5 * inv}
                      fill="var(--tool-calibrate)"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              )}
            </g>

            {/* hidden loader image to read natural size */}
          </svg>
        )}

        {/* image preloader */}
        {blueprint && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={blueprint || "/placeholder.svg"}
            alt=""
            className="hidden"
            crossOrigin="anonymous"
            onLoad={(e) => {
              const el = e.currentTarget
              const size = { w: el.naturalWidth, h: el.naturalHeight }
              setImgSize(size)
              fitView(size)
            }}
          />
        )}

        {/* drawing helper bar */}
        {blueprint && (drawingTool || activeTool === "calibrate") && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
              <span className="text-xs text-muted-foreground">
                {activeTool === "calibrate"
                  ? `Click two points of a known length${calib.pts.length === 1 ? " — pick the second point" : ""}`
                  : !selected
                    ? "Select a section to measure into"
                    : activeTool === "rect"
                      ? `${selected.name}: click one corner, then the opposite corner`
                      : activeTool === "area"
                        ? `${selected.name}: click to add points, then Finish, double-click, or click the first point to close`
                        : `${selected.name}: click to add points, then Finish or double-click to end`}
              </span>
              {drawingTool && activeTool !== "rect" && (
                <>
                  <Badge variant="secondary" className="font-mono">
                    {draft.length} pts
                  </Badge>
                  <Button size="sm" className="h-7 gap-1" onClick={finishDraft}>
                    <Check className="size-3.5" />
                    Finish
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1"
                onClick={() => {
                  cancelDraft()
                  setActiveTool("select")
                }}
              >
                <X className="size-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Gable pitch floating tool */}
        {selected?.type === "gable" && (
          <div
            ref={pitchPanelRef}
            className={cn(
              "absolute w-60 rounded-lg border border-accent/40 bg-card/95 p-3 shadow-lg backdrop-blur",
              !pitchPos && "right-4 top-4",
            )}
            style={
              pitchPos ? { left: pitchPos.x, top: pitchPos.y } : undefined
            }
          >
            <div
              onPointerDown={startPitchDrag}
              className="flex cursor-move touch-none items-center gap-2"
            >
              <span className="flex size-6 items-center justify-center rounded bg-accent/15 text-accent">
                <Triangle className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{selected.name}</p>
                <p className="text-xs text-muted-foreground">Set Roof Pitch</p>
              </div>
              <GripVertical className="size-4 shrink-0 text-muted-foreground" />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {PITCH_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateSection(selected.id, { pitch: p })}
                  className={cn(
                    "rounded-md border px-1 py-1.5 text-xs font-medium tabular-nums transition-colors",
                    selected.pitch === p
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p === "flat" ? "Flat" : p}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-md bg-secondary px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground">Slope multiplier</span>
              <span className="font-mono font-semibold text-accent">
                ×{pitchMultiplier(selected.pitch).toFixed(3)}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full gap-1.5"
              onClick={() => replaceRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Replace sheet image
            </Button>
          </div>
        )}
      </div>

      {/* Calibration dialog */}
      <Dialog
        open={calib.open}
        onOpenChange={(open) =>
          setCalib((c) => ({ ...c, open, pts: open ? c.pts : [] }))
        }
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set drawing scale</DialogTitle>
            <DialogDescription>
              Enter the real-world length of the line you just drew. This
              calibrates every measurement on the blueprint.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="feet">Known length (feet)</Label>
            <Input
              id="feet"
              type="number"
              inputMode="decimal"
              autoFocus
              placeholder="e.g. 20"
              value={calib.feet}
              onChange={(e) => setCalib((c) => ({ ...c, feet: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && confirmCalibration()}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCalib({ pts: [], open: false, feet: "" })}
            >
              Cancel
            </Button>
            <Button onClick={confirmCalibration}>Apply scale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Separator() {
  return <span className="h-6 w-px bg-border" aria-hidden />
}

function UploadPrompt({
  onPick,
  onSample,
  onDropFile,
}: {
  onPick: () => void
  onSample: () => void
  onDropFile: (f: File) => void
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-8"
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onDropFile(f)
      }}
    >
      <div
        className={cn(
          "flex w-full max-w-md flex-col items-center gap-4 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
          over ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="size-7" />
        </span>
        <div>
          <p className="text-base font-semibold">Upload a blueprint</p>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Drag & drop an elevation drawing (PDF, PNG, or JPG), or browse to
            begin your take-off. Multi-page PDFs let you pick the sheet.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={onPick} className="gap-2">
            <Upload className="size-4" />
            Browse files
          </Button>
          <Button variant="outline" onClick={onSample}>
            Load sample elevation
          </Button>
        </div>
      </div>
    </div>
  )
}
