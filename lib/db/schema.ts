import {
  pgTable,
  serial,
  text,
  jsonb,
  timestamp,
  integer,
  real,
  index,
} from "drizzle-orm/pg-core"

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

/**
 * One row per auto take-off item the estimator confirmed, adjusted, deleted,
 * or added by hand — the history used to learn estimating rules and size
 * biases. Rows outlive the project they came from on purpose.
 */
export const takeoffCorrections = pgTable(
  "takeoff_corrections",
  {
    id: serial("id").primaryKey(),
    projectId: integer("projectId").notNull(),
    runAt: text("runAt").notNull(),
    sectionKey: text("sectionKey").notNull(),
    pageName: text("pageName").notNull(),
    elevation: text("elevation").notNull(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    outcome: text("outcome").notNull(),
    confidence: text("confidence"),
    model: text("model").notNull(),
    scale: real("scale"),
    scaleSource: text("scaleSource"),
    original: jsonb("original"),
    final: jsonb("final"),
    metrics: jsonb("metrics"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("takeoff_corrections_project_run_idx").on(t.projectId, t.runAt)],
)
