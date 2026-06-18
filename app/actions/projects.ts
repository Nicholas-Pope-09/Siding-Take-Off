"use server"

import { db } from "@/lib/db"
import { projects } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

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
