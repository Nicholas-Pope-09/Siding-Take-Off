"use client"

import type { PDFDocumentProxy } from "pdfjs-dist"

/**
 * Lazy-load pdfjs only in the browser and configure its worker.
 * Keeping this dynamic avoids pulling the (large) library + worker into the
 * initial bundle and prevents any SSR evaluation.
 */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString()
      return pdfjs
    })
  }
  return pdfjsPromise
}

export type PdfDoc = {
  doc: PDFDocumentProxy
  pageCount: number
}

/** Open a PDF File into an in-memory document we can render pages from. */
export async function openPdf(file: File): Promise<PdfDoc> {
  const pdfjs = await getPdfjs()
  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  return { doc, pageCount: doc.numPages }
}

/**
 * Render a single page to a PNG data URL.
 * `targetWidth` controls output resolution — higher = sharper zoom and more
 * accurate calibration, at the cost of memory.
 */
export async function renderPdfPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  targetWidth: number,
): Promise<string> {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = targetWidth / base.width
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not get a 2D canvas context for PDF render.")

  // White matte so transparent PDFs don't render on a black background.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return canvas.toDataURL("image/png")
}
