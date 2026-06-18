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
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  ELEVATIONS,
  SECTION_TYPE_LABEL,
  WASTE_FACTOR,
  useTakeoff,
} from "@/lib/takeoff-store"
import {
  BRANDS,
  PRODUCTS,
  getProduct,
  unitsNeeded,
  type Product,
} from "@/lib/products"
import {
  Package,
  Layers,
  Percent,
  Crosshair,
  Sigma,
  ShoppingCart,
  Box,
  Ruler,
} from "lucide-react"

const AREA_PRODUCTS = PRODUCTS.filter((p) => p.measureType === "area")
const LINEAR_PRODUCTS = PRODUCTS.filter((p) => p.measureType === "linear")

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

function ProductSelect({
  value,
  measureType,
  onChange,
}: {
  value: string | null
  measureType: "area" | "linear"
  onChange: (id: string | null) => void
}) {
  const products = measureType === "area" ? AREA_PRODUCTS : LINEAR_PRODUCTS
  const grouped = BRANDS.map((b) => ({
    brand: b,
    products: products.filter((p) => p.brand === b.id),
  })).filter((g) => g.products.length > 0)

  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : v)}
    >
      <SelectTrigger
        size="sm"
        className="h-7 w-52"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="Assign product…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">No product</span>
        </SelectItem>
        {grouped.map(({ brand, products: prods }) => (
          <SelectGroup key={brand.id}>
            <SelectLabel>{brand.name}</SelectLabel>
            {prods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

interface BomLine {
  product: Product
  totalMeasurement: number
  units: number
  sectionCount: number
}

export function MaterialsView() {
  const {
    sections,
    pages,
    updateSection,
    selectSection,
    selectedSectionId,
    compute,
  } = useTakeoff()

  const uncalibrated = pages.some((p) => !p.scale)

  const rows = useMemo(
    () =>
      sections.map((s) => {
        const page = pages.find((p) => p.id === s.pageId) ?? null
        const c = compute(s)
        return {
          section: s,
          elevationLabel:
            ELEVATIONS.find((e) => e.id === s.elevation)?.label ?? s.elevation,
          pageName: page?.name ?? "—",
          pageScale: page?.scale ?? null,
          c,
          measurement:
            s.geometry === "area" ? c.slopeArea : c.baseArea,
        }
      }),
    [sections, pages, compute],
  )

  const totals = useMemo(() => {
    const net = rows.reduce(
      (sum, r) =>
        r.section.geometry === "area" ? sum + r.c.signed : sum,
      0,
    )
    const withWaste = net * (1 + WASTE_FACTOR)
    const linearTrim = rows.reduce(
      (sum, r) =>
        r.section.geometry === "line" ? sum + r.c.baseArea : sum,
      0,
    )
    return { net, withWaste, linearTrim }
  }, [rows])

  const bom = useMemo(() => {
    const map = new Map<
      string,
      { product: Product; totalMeasurement: number; sectionCount: number }
    >()
    for (const r of rows) {
      if (!r.section.productId) continue
      const product = getProduct(r.section.productId)
      if (!product) continue
      const measurement =
        r.section.type === "deduction"
          ? 0
          : r.measurement
      const existing = map.get(product.id)
      if (existing) {
        existing.totalMeasurement += measurement
        existing.sectionCount++
      } else {
        map.set(product.id, {
          product,
          totalMeasurement: measurement,
          sectionCount: 1,
        })
      }
    }
    const lines: BomLine[] = []
    for (const entry of map.values()) {
      lines.push({
        product: entry.product,
        totalMeasurement: entry.totalMeasurement,
        units: unitsNeeded(entry.product, entry.totalMeasurement, WASTE_FACTOR),
        sectionCount: entry.sectionCount,
      })
    }
    return lines.sort((a, b) => a.product.brand.localeCompare(b.product.brand))
  }, [rows])

  const totalUnits = bom.reduce((s, l) => s + l.units, 0)
  const num = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 })

  return (
    <div className="flex min-h-0 flex-1">
      {/* Left: section → product assignment */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Package className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">
              Product Assignment
            </p>
            <p className="text-xs text-muted-foreground">
              Assign specific products to each measured section
            </p>
          </div>
          <Badge variant="secondary" className="ml-auto font-mono">
            {sections.length} sections
          </Badge>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Layers className="size-6" />
              </span>
              <p className="text-sm font-medium">No measurements yet</p>
              <p className="text-xs text-muted-foreground text-pretty">
                Switch to the Take-Off view and measure sections on a
                blueprint to assign materials here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Section</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Measured</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="pr-4 text-right">Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ section: s, elevationLabel, pageName, pageScale, c, measurement }) => {
                  const isSel = s.id === selectedSectionId
                  const isLine = s.geometry === "line"
                  const product = s.productId
                    ? getProduct(s.productId)
                    : null
                  const qty =
                    product && pageScale
                      ? unitsNeeded(
                          product,
                          s.type === "deduction" ? 0 : measurement,
                          WASTE_FACTOR,
                        )
                      : null
                  return (
                    <TableRow
                      key={s.id}
                      data-state={isSel ? "selected" : undefined}
                      className={cn(
                        "cursor-pointer",
                        isSel && "bg-primary/10 hover:bg-primary/10",
                      )}
                      onClick={() => selectSection(s.id)}
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-background/40"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="text-sm font-medium">
                            {s.name}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 truncate pl-5 text-xs text-muted-foreground">
                          {pageName}
                          <span aria-hidden>·</span>
                          {elevationLabel.replace(" Elevation", "")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-normal",
                            s.type === "wall" &&
                              "border-primary/40 text-primary",
                            s.type === "gable" &&
                              "border-accent/40 text-accent",
                            s.type === "deduction" &&
                              "border-destructive/40 text-destructive",
                          )}
                        >
                          {SECTION_TYPE_LABEL[s.type].replace("/Window", "")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {pageScale ? (
                          <>
                            {s.type === "deduction" && isLine ? "" : s.type === "deduction" ? "−" : ""}
                            {measurement.toFixed(0)}
                            <span className="ml-0.5 text-[10px] text-muted-foreground">
                              {isLine ? "lf" : "sf"}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ProductSelect
                          value={s.productId}
                          measureType={isLine ? "linear" : "area"}
                          onChange={(id) =>
                            updateSection(s.id, { productId: id })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                        {qty !== null ? (
                          <>
                            {qty}
                            <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                              {product?.unitName}s
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right text-xs text-muted-foreground">
                        {product?.coverageLabel ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Right: BOM + summary */}
      <aside className="flex h-full w-[400px] shrink-0 flex-col bg-sidebar">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <ShoppingCart className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">
              Bill of Materials
            </p>
            <p className="text-xs text-muted-foreground">
              Order quantities from take-off
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="border-b border-border p-4">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Take-Off Totals</p>
              {uncalibrated && (
                <Badge
                  variant="outline"
                  className="gap-1 border-accent/50 text-accent"
                >
                  <Crosshair className="size-3" />
                  Calibrate sheets
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard
                label="Net Area"
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
                label="Linear Trim"
                value={num(totals.linearTrim)}
                unit="lin ft"
                icon={Ruler}
              />
              <StatCard
                label="Total Units to Order"
                value={num(totalUnits)}
                unit="units"
                icon={Box}
                accent="accent"
              />
            </div>
          </div>
        </div>

        {/* BOM table */}
        <div className="min-h-0 flex-1 overflow-auto">
          {bom.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <ShoppingCart className="size-6" />
              </span>
              <p className="text-sm font-medium">No products assigned</p>
              <p className="text-xs text-muted-foreground text-pretty">
                Assign products to sections in the table to build
                your bill of materials.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-sidebar">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Product</TableHead>
                  <TableHead className="text-right">Area/Length</TableHead>
                  <TableHead className="pr-4 text-right">Order Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bom.map((line) => {
                  const brand = BRANDS.find(
                    (b) => b.id === line.product.brand,
                  )
                  const isLinear = line.product.measureType === "linear"
                  return (
                    <TableRow key={line.product.id}>
                      <TableCell className="pl-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {line.product.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {brand?.name} · {line.sectionCount} section
                            {line.sectionCount !== 1 ? "s" : ""} ·{" "}
                            {line.product.coverageLabel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {line.totalMeasurement.toFixed(0)}
                        <span className="ml-0.5 text-[10px] text-muted-foreground">
                          {isLinear ? "lf" : "sf"}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <span className="font-mono text-lg font-semibold tabular-nums text-primary">
                          {line.units}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          {line.product.unitName}
                          {line.units !== 1 ? "s" : ""}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            {bom.length} product{bom.length !== 1 ? "s" : ""} ·{" "}
            {WASTE_FACTOR * 100}% waste included
          </span>
          <span className="font-mono font-semibold text-foreground">
            {num(totalUnits)} units
          </span>
        </div>
      </aside>
    </div>
  )
}
