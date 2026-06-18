import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core"

/**
 * A saved take-off project. Shared workspace (no auth), so projects are
 * visible to anyone with the link. `data` holds the full serialized take-off
 * (blueprint, scale, and all measured sections).
 */
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
})

export type ProjectRow = typeof projects.$inferSelect
