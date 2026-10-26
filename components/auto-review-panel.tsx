"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  ELEVATIONS,
  useTakeoff,
  type Confidence,
  type Page,
  type ScaleSource,
  type Section,
} from "@/lib/takeoff-store"
import { boxFeet, feetInches } from "@/lib/auto-takeoff/client"
import {
  CheckCircle2,
  Circle,
  Crosshair,
  Download,
  ListChecks,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react"

const SOURCE_LABEL: Record<ScaleSource, string> = {
  manual: "Set by hand",
  "auto-notation": "Printed scale",
  "auto-dimension": "Printed dimensions",
  "auto-standard": "Standard sizes (estimate)",
}

function ConfidenceBadge({ value }: { value?: Confidence | null }) {
  if (!value) return null
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-4 px-1 text-[10px] font-normal",
        value === "high" && "border-primary/40 text-primary",
        value === "medium" && "border-accent/50 text-accent",
        value === "low" && "border-destructive/50 text-destructive",
      )}
    >
      {value}
    </Badge>
  )
}

function csvCell(v: string | number) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function AutoReviewPanel() {
  const {
    pages,
    sections,
    activePageId,
    selectedSectionId,
    setActivePage,
    selectSection,
    setActiveTool,
    updateSection,
    deleteSection,
    compute,
    projectName,
  } = useTakeoff()

  const reviewPages = useMemo(
    () =>
      pages.filter(
        (p) =>
          p.autoTakeoff ||
          sections.some((s) => s.pageId === p.id && s.source === "auto"),
      ),
    [pages, sections],
  )
  const autoSections = sections.filter((s) => s.source === "auto")
  const verifiedCount = autoSections.filter((s) => s.verified).length

  function focus(s: Section) {
    if (s.pageId !== activePageId) setActivePage(s.pageId)
    selectSection(s.id)
  }

  function exportCsv() {
    const header = [
      "Sheet",
      "Elevation",
      "Label",
      "Type",
      "Opening",
      "Width (ft)",
      "Height (ft)",
      "Area / length",
      "Unit",
      "Source",
      "Verified",
      "Confidence",
      "Notes",
    ]
    const rows = sections.map((s) => {
      const page = pages.find((p) => p.id === s.pageId)
      const c = compute(s)
      const d = page?.scale && s.points.length ? boxFeet(s.points, page.scale) : null
      return [
        page?.name ?? "",
        ELEVATIONS.find((e) => e.id === s.elevation)?.label ?? s.elevation,
        s.name,
        s.type,
        s.opening ?? "",
        d ? d.w.toFixed(2) : "",
        d ? d.h.toFixed(2) : "",
        (s.geometry === "area" ? c.signed : c.baseArea).toFixed(1),
        s.geometry === "area" ? "sf" : "lf",
        s.source ?? "manual",
        s.source === "auto" ? (s.verified ? "yes" : "no") : "",
        s.confidence ?? "",
        s.note ?? "",
      ]
    })
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${projectName || "take-off"} measurements.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (reviewPages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Sparkles className="size-6" />
        </span>
        <p className="text-sm font-medium">No auto measurements yet</p>
        <p className="text-xs text-muted-foreground text-pretty">
          Open a sheet and click Auto Take-Off. Everything it measures shows up
          here, labeled to match the plan, for you to check.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <ListChecks className="size-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          <span className="font-mono font-semibold text-foreground">
            {verifiedCount}/{autoSections.length}
          </span>{" "}
          verified
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 gap-1.5"
          onClick={exportCsv}
        >
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {reviewPages.map((page) => (
          <PageReview
            key={page.id}
            page={page}
            sections={autoSections.filter((s) => s.pageId === page.id)}
            selectedSectionId={selectedSectionId}
            onFocus={focus}
            onRecalibrate={() => {
              setActivePage(page.id)
              setActiveTool("calibrate")
            }}
            onVerify={(s, verified) => updateSection(s.id, { verified })}
            onVerifyAll={(list) =>
              list.forEach((s) => updateSection(s.id, { verified: true }))
            }
            onDelete={(s) => deleteSection(s.id)}
            area={(s) => compute(s).slopeArea}
          />
        ))}
      </div>
    </div>
  )
}

function PageReview({
  page,
  sections,
  selectedSectionId,
  onFocus,
  onRecalibrate,
  onVerify,
  onVerifyAll,
  onDelete,
  area,
}: {
  page: Page
  sections: Section[]
  selectedSectionId: string | null
  onFocus: (s: Section) => void
  onRecalibrate: () => void
  onVerify: (s: Section, verified: boolean) => void
  onVerifyAll: (list: Section[]) => void
  onDelete: (s: Section) => void
  area: (s: Section) => number
}) {
  const record = page.autoTakeoff
  const unverified = sections.filter((s) => !s.verified)
  const scaleWarn = !page.scale || page.scaleConfidence === "low"

  return (
    <div className="border-b border-border p-4">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{page.name}</p>
        {unverified.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={() => onVerifyAll(unverified)}
          >
            <CheckCircle2 className="size-3.5" />
            Verify all
          </Button>
        )}
      </div>
      {record && (
        <p className="text-[11px] text-muted-foreground">
          Read {new Date(record.runAt).toLocaleString()} · {record.model}
        </p>
      )}

      {/* Calibration */}
      <div
        className={cn(
          "mt-3 rounded-lg border p-3 text-xs",
          scaleWarn ? "border-accent/50 bg-accent/5" : "border-border bg-card",
        )}
      >
        <div className="flex items-center gap-2">
          <Crosshair className="size-3.5 text-muted-foreground" />
          <span className="font-semibold">Scale</span>
          <span className="font-mono">
            {page.scale ? `${page.scale.toFixed(1)} px/ft` : "not calibrated"}
          </span>
          {page.scaleSource && (
            <span className="text-muted-foreground">
              · {SOURCE_LABEL[page.scaleSource]}
            </span>
          )}
          <ConfidenceBadge value={page.scaleConfidence} />
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-6 px-2 text-[11px]"
            onClick={onRecalibrate}
          >
            Calibrate by hand
          </Button>
        </div>
        {page.scaleNote && (
          <p className="mt-1.5 text-muted-foreground text-pretty">{page.scaleNote}</p>
        )}
        {record?.result.scaleNotation && (
          <p className="mt-1 text-muted-foreground">
            Printed scale: <span className="font-mono">{record.result.scaleNotation}</span>
          </p>
        )}
      </div>

      {record && record.result.notes.length > 0 && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3 text-xs">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <TriangleAlert className="size-3.5 text-accent" />
            Things to double-check
          </p>
          <ul className="flex list-disc flex-col gap-0.5 pl-4 text-muted-foreground">
            {record.result.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Items by elevation */}
      {ELEVATIONS.map((el) => {
        const list = sections.filter((s) => s.elevation === el.id)
        if (list.length === 0) return null
        return (
          <div key={el.id} className="mt-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {el.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {list.map((s) => {
                const d = page.scale && s.points.length ? boxFeet(s.points, page.scale) : null
                const isSel = s.id === selectedSectionId
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onFocus(s)}
                    onKeyDown={(e) => e.key === "Enter" && onFocus(s)}
                    className={cn(
                      "group flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-xs",
                      isSel ? "border-primary/40 bg-primary/10" : "hover:bg-secondary",
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onVerify(s, !s.verified)
                      }}
                      className="mt-0.5 shrink-0"
                      aria-label={s.verified ? `Mark ${s.name} unverified` : `Verify ${s.name}`}
                    >
                      {s.verified ? (
                        <CheckCircle2 className="size-4 text-primary" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                    </button>
                    <span
                      className="mt-1 size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{s.name}</span>
                        <ConfidenceBadge value={s.confidence} />
                        <span className="ml-auto font-mono tabular-nums">
                          {page.scale ? (
                            <>
                              {s.type === "deduction" ? "−" : ""}
                              {area(s).toFixed(1)} sf
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {d && (
                          <span className="font-mono tabular-nums">
                            {s.opening
                              ? `${feetInches(d.w)} × ${feetInches(d.h)}`
                              : `${d.w.toFixed(1)}′ × ${d.h.toFixed(1)}′`}
                          </span>
                        )}
                        {s.note && <span className="truncate">· {s.note}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(s)
                      }}
                      className="mt-0.5 shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
