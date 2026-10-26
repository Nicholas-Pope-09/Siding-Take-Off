import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import { AutoTakeoffSchema } from "@/lib/auto-takeoff/schema"

export const runtime = "nodejs"
export const maxDuration = 300

const MODEL = "claude-opus-5-5"

const SYSTEM = `You are an experienced exterior siding estimator reading architectural elevation drawings for a material take-off. You report geometry in image pixel coordinates (origin at the top-left corner, x to the right, y down) so the estimating software can draw and measure it.`

function instructions(width: number, height: number) {
  return `This sheet image is ${width} x ${height} pixels. Read every exterior elevation drawn on it and return the take-off geometry.

SCALE
- scaleNotation: the drawing scale exactly as printed (e.g. 1/4" = 1'-0"), or null if there is none or it says NTS. paperInchesPerFoot: that scale as paper inches per real foot (1/4" = 1'-0" -> 0.25, 1/8" = 1'-0" -> 0.125), or null.
- scaleReferences: give pixel endpoints for things whose real length you know. Prefer "dimension" references: dimension lines with a printed length (put start/end on the extension lines or tick marks, and convert the printed length to decimal feet, e.g. 42'-6" -> 42.5). Give every clear dimension you can, up to 6, favouring the longest. If the sheet has no usable dimensions, add "standard_size" references instead, measured on the drawing itself: a single garage door height (7'-0"), an entry door height (6'-8") or width (3'-0"), a 16'-0" double garage door width. Name the assumption in description.

SURFACES (things that get siding)
- For each elevation, outline each separate cladded wall plane as a "wall": the exterior face below the eave/wall-top line, down to the top of the foundation or grade line. Follow the actual corners in order; use a 4-point rectangle when the wall is rectangular. Do NOT cut out windows or doors (they are measured separately). Exclude roofs, fascia, soffits, exposed foundation, porch columns and railings, and chimneys unless they are cladded.
- Outline each gable end (the triangular or trapezoidal wall area above the wall-top line, under the rake) as a separate "gable", and give its roof pitch from the pitch symbol if printed, else your best estimate from the drawn slope, as "N/12".
- Where the cladding changes (e.g. a stone or brick wainscot under lap siding, shakes in a gable), make each cladding its own surface and set cladding accordingly.

OPENINGS
- Every window, door, and garage door on every elevation, as an axis-aligned box around the outside of the unit's trim/casing. Include tag (window/door mark) and sizeCallout only if printed on the drawing.

ELEVATIONS
- Assign each drawing to front/rear/left/right using its title. If titles use compass directions, choose the front as the street/entry side and set the others relative to it, and record your mapping in notes. If the sheet shows one unlabeled elevation, call it front.

Use confidence "low" for anything you had to guess. Put anything the estimator should double-check in notes (hidden or overlapping areas, items you skipped, ambiguous scale).`
}

export async function POST(req: Request) {
  let body: { image?: string; mediaType?: string; width?: number; height?: number }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }
  const { image, mediaType, width, height } = body
  if (!image || !width || !height || (mediaType !== "image/png" && mediaType !== "image/jpeg")) {
    return Response.json({ error: "Missing sheet image." }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
      { status: 500 },
    )
  }

  const client = new Anthropic()
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "high",
        format: betaZodOutputFormat(AutoTakeoffSchema),
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: instructions(width, height) },
          ],
        },
      ],
    })
    const message = await stream.finalMessage()

    if (message.stop_reason === "refusal") {
      return Response.json({ error: "The model declined to read this sheet." }, { status: 422 })
    }
    if (message.stop_reason === "max_tokens" || !message.parsed_output) {
      return Response.json(
        { error: "The sheet read came back incomplete. Try again." },
        { status: 502 },
      )
    }
    return Response.json({ result: message.parsed_output, model: message.model })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The Anthropic API key was rejected." }, { status: 500 })
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Rate limited by the Anthropic API — try again in a minute." }, { status: 429 })
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[auto-takeoff] API error", err.status, err.message)
      return Response.json({ error: `Anthropic API error (${err.status}).` }, { status: 502 })
    }
    console.error("[auto-takeoff] failed", err)
    return Response.json({ error: "Auto take-off failed." }, { status: 500 })
  }
}
