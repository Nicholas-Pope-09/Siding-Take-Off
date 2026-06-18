"use client"

import { useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  ELEVATIONS,
  MATERIAL_OPTIONS,
  SECTION_TYPE_LABEL,
  WASTE_FACTOR,
  useTakeoff,
} from "@/lib/takeoff-store"
import {
  Layers,
  Package,
  Percent,
  Trash2,
  Crosshair,
  Sigma,
} from "lucide-react"

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  unit?: string
  icon: React.ComponentType<{ className?: string }>
  accent?: "primary" | "accent"
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "font-mono text-xl font-semibold tabular-nums",
            accent === "primary" && "text-primary",
            accent === "accent" && "text-accent",
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </div>
    </div>
  )
}

export function TakeoffSheet() {
  const {
    sections,
    pages,
    activePageId,
    setActivePage,
    selectSection,
    selectedSectionId,
    updateSection,
    deleteSection,
    compute,
  } = useTakeoff()

  // Any page still needs calibration? Used for the summary warning.
  const uncalibrated = pages.some((p) => !p.scale)

  const rows = useMemo(
    () =>
      sections.map((s) => {
        const page = pages.find((p) => p.id === s.pageId) ?? null
        return {
          section: s,
          elevationLabel:
            ELEVATIONS.find((e) => e.id === s.elevation)?.label ?? s.elevation,
          pageName: page?.name ?? "—",
          pageScale: page?.scale ?? null,
          c: compute(s),
        }
      }),
    [sections, pages, compute],
  )

  const totals = useMemo(() => {
    // Only area geometry contributes to siding square footage
    const net = rows.reduce(
      (sum, r) =>
        r.section.geometry === "area" ? sum + r.c.signed : sum,
      0,
    )
    const withWaste = net * (1 + WASTE_FACTOR)
    const squares = withWaste / 100
    const linearTrim = rows.reduce(
      (sum, r) =>
        r.section.geometry === "line" ? sum + r.c.baseArea : sum,
      0,
    )
    return { net, withWaste, squares, linearTrim }
  }, [rows])

  const num = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 })

  return (
    <section className="flex h-full w-[440px] shrink-0 flex-col border-l border-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Sigma className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Take-Off Sheet</p>
            <p className="text-xs text-muted-foreground">
              Live exterior siding estimate
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="font-mono">
          {sections.length} items
        </Badge>
      </div>

      {/* Project Total Summary */}
      <div className="border-b border-border p-4">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Project Total Summary</p>
            {uncalibrated && (
              <Badge variant="outline" className="gap-1 border-accent/50 text-accent">
                <Crosshair className="size-3" />
                Calibrate sheets
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              label="Net Square Footage"
              value={num(totals.net)}
              unit="sq ft"
              icon={Layers}
            />
            <StatCard
              label={`With Waste (+${WASTE_FACTOR * 100}%)`}
              value={num(totals.withWaste)}
              unit="sq ft"
              icon={Percent}
              accent="primary"
            />
            <StatCard
              label="Estimated Squares"
              value={totals.squares.toFixed(1)}
              unit="squares"
              icon={Package}
              accent="accent"
            />
            <StatCard
              label="Linear Trim"
              value={num(totals.linearTrim)}
              unit="lin ft"
              icon={Crosshair}
            />
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Layers className="size-6" />
            </span>
            <p className="text-sm font-medium">No measurements yet</p>
            <p className="text-xs text-muted-foreground text-pretty">
              Add a section from an elevation, then draw on the blueprint to
              populate this sheet.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-sidebar">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Section</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Pitch ×</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Slope</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ section: s, elevationLabel, pageName, pageScale, c }) => {
                const isSel = s.id === selectedSectionId
                const isLine = s.geometry === "line"
                return (
                  <TableRow
                    key={s.id}
                    data-state={isSel ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer",
                      isSel && "bg-primary/10 hover:bg-primary/10",
                    )}
                    onClick={() => {
                      if (s.pageId !== activePageId) setActivePage(s.pageId)
                      selectSection(s.id)
                    }}
                  >
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-background/40"
                          style={{ backgroundColor: s.color }}
                          aria-hidden
                        />
                        <Input
                          value={s.name}
                          onChange={(e) =>
                            updateSection(s.id, { name: e.target.value })
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 w-28 border-transparent bg-transparent px-1.5 text-sm font-medium hover:border-input focus-visible:border-ring"
                        />
                      </div>
                      <span className="flex items-center gap-1 truncate pl-5 text-xs text-muted-foreground">
                        {pages.length > 1 && (
                          <span className="truncate font-medium text-foreground/70">
                            {pageName}
                          </span>
                        )}
                        {pages.length > 1 && <span aria-hidden>·</span>}
                        {elevationLabel.replace(" Elevation", "")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal",
                          s.type === "wall" && "border-primary/40 text-primary",
                          s.type === "gable" && "border-accent/40 text-accent",
                          s.type === "deduction" &&
                            "border-destructive/40 text-destructive",
                        )}
                      >
                        {SECTION_TYPE_LABEL[s.type].replace("/Window", "")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {s.type === "gable" ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="text-accent">
                                ×{c.multiplier.toFixed(3)}
                              </span>
                            }
                          />
                          <TooltipContent>
                            <p>{s.pitch} pitch slope factor</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {pageScale ? (
                        <>
                          {c.baseArea.toFixed(0)}
                          <span className="ml-0.5 text-[10px] text-muted-foreground">
                            {isLine ? "lf" : "sf"}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-sm font-semibold tabular-nums",
                        s.type === "deduction" && "text-destructive",
                      )}
                    >
                      {pageScale ? (
                        isLine ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <>
                            {s.type === "deduction" ? "−" : ""}
                            {c.slopeArea.toFixed(0)}
                            <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                              sf
                            </span>
                          </>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={s.material}
                        onValueChange={(v) =>
                          updateSection(s.id, { material: v as string })
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-7 w-32"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MATERIAL_OPTIONS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSection(s.id)
                        }}
                        aria-label={`Delete ${s.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <span>Net + waste ÷ 100 = squares</span>
        <span className="font-mono font-semibold text-foreground">
          {totals.squares.toFixed(1)} sq
        </span>
      </div>
    </section>
  )
}
