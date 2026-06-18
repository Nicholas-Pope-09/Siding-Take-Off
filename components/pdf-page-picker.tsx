"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { openPdf, renderPdfPage, type PdfDoc } from "@/lib/pdf"
import { FileText, Loader2, Check } from "lucide-react"

/** Resolution (px wide) of the page rendered into the canvas once chosen. */
const FULL_WIDTH = 2200
/** Thumbnail width for the picker grid. */
const THUMB_WIDTH = 260

export interface PickedPage {
  dataUrl: string
  label: string
}

export function PdfPagePicker({
  file,
  onCancel,
  onSelect,
}: {
  file: File | null
  /** Called when the dialog is dismissed without choosing any pages. */
  onCancel: () => void
  /** Receives the rendered pages (one per selected sheet), in page order. */
  onSelect: (pages: PickedPage[]) => void
}) {
  const [pdf, setPdf] = useState<PdfDoc | null>(null)
  const [thumbs, setThumbs] = useState<(string | null)[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!file) {
      setPdf(null)
      setThumbs([])
      setSelected(new Set())
      return
    }
    let cancelled = false
    setPdf(null)
    setThumbs([])
    setSelected(new Set())
    ;(async () => {
      try {
        const opened = await openPdf(file)
        if (cancelled) return
        setPdf(opened)
        setThumbs(new Array(opened.pageCount).fill(null))
        // Render thumbnails sequentially so the worker isn't overwhelmed.
        for (let i = 1; i <= opened.pageCount; i++) {
          const url = await renderPdfPage(opened.doc, i, THUMB_WIDTH)
          if (cancelled) return
          setThumbs((prev) => {
            const next = [...prev]
            next[i - 1] = url
            return next
          })
        }
      } catch (err) {
        console.log("[v0] PDF open error:", (err as Error)?.message)
        if (!cancelled) {
          toast.error("Could not read that PDF. It may be corrupt or protected.")
          onCancel()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [file, onCancel])

  function toggle(pageNumber: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pageNumber)) next.delete(pageNumber)
      else next.add(pageNumber)
      return next
    })
  }

  async function importSelected() {
    if (!pdf || importing || selected.size === 0) return
    setImporting(true)
    try {
      const pageNumbers = [...selected].sort((a, b) => a - b)
      const pages: PickedPage[] = []
      for (const n of pageNumbers) {
        const url = await renderPdfPage(pdf.doc, n, FULL_WIDTH)
        pages.push({ dataUrl: url, label: `Sheet ${n}` })
      }
      onSelect(pages)
    } catch (err) {
      console.log("[v0] PDF render error:", (err as Error)?.message)
      toast.error("Failed to render the selected pages. Try again.")
    } finally {
      setImporting(false)
    }
  }

  const open = Boolean(file)
  const loading = !pdf
  const count = selected.size

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !importing) onCancel()
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            Choose sheets
          </DialogTitle>
          <DialogDescription>
            {loading
              ? "Reading the PDF…"
              : `This document has ${pdf.pageCount} ${
                  pdf.pageCount === 1 ? "page" : "pages"
                }. Select every sheet you want — each becomes its own page you can toggle between.`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh]">
          <div className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-3">
            {(loading ? new Array(6).fill(null) : thumbs).map((thumb, idx) => {
              const pageNumber = idx + 1
              const isSelected = selected.has(pageNumber)
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={loading || importing}
                  onClick={() => toggle(pageNumber)}
                  aria-pressed={isSelected}
                  className={cn(
                    "group relative flex flex-col gap-2 rounded-lg border bg-card p-2 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    isSelected
                      ? "border-primary ring-1 ring-primary"
                      : "border-border hover:border-primary/60",
                  )}
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded bg-white">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb || "/placeholder.svg"}
                        alt={`Preview of page ${pageNumber}`}
                        className="size-full object-contain"
                      />
                    ) : (
                      <Skeleton className="size-full" />
                    )}
                    <span
                      className={cn(
                        "absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background/80 text-transparent",
                      )}
                      aria-hidden
                    >
                      <Check className="size-3.5" />
                    </span>
                  </div>
                  <span className="text-center text-xs font-medium text-muted-foreground">
                    Page {pageNumber}
                  </span>
                </button>
              )
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {count === 0
              ? "No sheets selected"
              : `${count} ${count === 1 ? "sheet" : "sheets"} selected`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onCancel} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={importSelected} disabled={count === 0 || importing}>
              {importing && <Loader2 className="size-4 animate-spin" />}
              Import {count > 0 ? count : ""} {count === 1 ? "sheet" : "sheets"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
