import { z } from "zod"

/**
 * Shape of the vision model's read of one sheet. All coordinates are pixels
 * in the image that was sent (origin top-left), which the client maps back to
 * the full-resolution blueprint.
 */
const Pt = z.object({ x: z.number(), y: z.number() })

const Confidence = z.enum(["high", "medium", "low"])

const ScaleReference = z.object({
  kind: z.enum(["dimension", "standard_size"]),
  /** what was measured, e.g. `Overall width dimension 42'-6"` */
  description: z.string(),
  feet: z.number(),
  start: Pt,
  end: Pt,
})

const Surface = z.object({
  kind: z.enum(["wall", "gable"]),
  description: z.string(),
  cladding: z.enum([
    "lap_siding",
    "board_and_batten",
    "shake",
    "stucco",
    "brick",
    "stone",
    "unknown",
  ]),
  /** closed outline, corners in order, openings NOT cut out */
  outline: z.array(Pt),
  /** roof pitch read from the drawing for gables, e.g. "8/12" */
  pitch: z.string().nullable(),
  confidence: Confidence,
})

const Opening = z.object({
  kind: z.enum(["window", "door", "garage_door"]),
  /** window/door mark printed on the plan, if any */
  tag: z.string().nullable(),
  /** size callout printed on the plan, if any, e.g. "3050" or `3'-0" x 6'-8"` */
  sizeCallout: z.string().nullable(),
  box: z.object({
    left: z.number(),
    top: z.number(),
    right: z.number(),
    bottom: z.number(),
  }),
  confidence: Confidence,
})

const Elevation = z.object({
  elevation: z.enum(["front", "rear", "left", "right"]),
  titleOnSheet: z.string().nullable(),
  surfaces: z.array(Surface),
  openings: z.array(Opening),
})

export const AutoTakeoffSchema = z.object({
  /** scale note exactly as printed, e.g. `1/4" = 1'-0"` */
  scaleNotation: z.string().nullable(),
  /** the scale note as paper inches per real foot (1/4" = 1'-0" -> 0.25) */
  paperInchesPerFoot: z.number().nullable(),
  scaleReferences: z.array(ScaleReference),
  elevations: z.array(Elevation),
  notes: z.array(z.string()),
})

export type AutoTakeoffResult = z.infer<typeof AutoTakeoffSchema>
export type AutoSurface = z.infer<typeof Surface>
export type AutoOpening = z.infer<typeof Opening>
export type AutoScaleReference = z.infer<typeof ScaleReference>
