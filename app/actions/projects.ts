"use server"

import { db } from "@/lib/db"
import { projects, takeoffCorrections } from "@/lib/db/schema"
import { and, desc, eq, inArray } from "drizzle-orm"
import { extractCorrections } from "@/lib/auto-takeoff/corrections"
import type { TakeoffSnapshot } from "@/lib/takeoff-store"

/** Serialized take-off payload stored in the `data` column. */
export interface TakeoffData {
  pages?: unknown[]
  sections: unknown[]
  /** legacy single-page fields (older saved projects) */
  blueprint?: string | null
  scale?: number | null
}

export interface ProjectSummary {
  id: number
  name: string
  updatedAt: string
  sectionCount: number
}

/** List all saved projects (most recently updated first), without heavy data. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const rows = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.updatedAt))

  return rows.map((r) => {
    const data = r.data as TakeoffData
    return {
      id: r.id,
      name: r.name,
      updatedAt: r.updatedAt.toISOString(),
      sectionCount: Array.isArray(data?.sections) ? data.sections.length : 0,
    }
  })
}

/** Load a single project's full take-off data. */
export async function getProject(
  id: number,
): Promise<{ id: number; name: string; data: TakeoffData } | null> {
  const [row] = await db.select().from(projects).where(eq(projects.id, id))
  if (!row) return null
  return { id: row.id, name: row.name, data: row.data as TakeoffData }
}

/** Create a new project and return its id. */
export async function createProject(
  name: string,
  data: TakeoffData,
): Promise<{ id: number }> {
  const trimmed = name.trim() || "Untitled Take-off"
  const [row] = await db
    .insert(projects)
    .values({ name: trimmed, data })
    .returning({ id: projects.id })
  await recordCorrections(row.id, data)
  return { id: row.id }
}

/** Overwrite an existing project's name + data (manual save). */
export async function updateProject(
  id: number,
  name: string,
  data: TakeoffData,
): Promise<void> {
  const trimmed = name.trim() || "Untitled Take-off"
  await db
    .update(projects)
    .set({ name: trimmed, data, updatedAt: new Date() })
    .where(eq(projects.id, id))
  await recordCorrections(id, data)
}

/**
 * Refresh the correction log for the auto runs in this save. Rows from older
 * runs (since replaced by a re-run) are kept, so history accumulates. A
 * failure here never blocks saving the project itself.
 */
async function recordCorrections(projectId: number, data: TakeoffData) {
  try {
    const snapshot = data as TakeoffSnapshot
    const runs = (snapshot.pages ?? [])
      .map((p) => p.autoTakeoff?.runAt)
      .filter((r): r is string => Boolean(r))
    if (runs.length === 0) return
    const rows = extractCorrections(snapshot)
    await db.transaction(async (tx) => {
      await tx
        .delete(takeoffCorrections)
        .where(
          and(
            eq(takeoffCorrections.projectId, projectId),
            inArray(takeoffCorrections.runAt, runs),
          ),
        )
      if (rows.length) {
        await tx
          .insert(takeoffCorrections)
          .values(rows.map((r) => ({ ...r, projectId })))
      }
    })
  } catch (err) {
    console.error("[corrections] could not record corrections", err)
  }
}

/** Rename a project. */
export async function renameProject(id: number, name: string): Promise<void> {
  const trimmed = name.trim() || "Untitled Take-off"
  await db
    .update(projects)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(projects.id, id))
}

/** Delete a project. */
export async function deleteProject(id: number): Promise<void> {
  await db.delete(projects).where(eq(projects.id, id))
}
