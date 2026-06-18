"use client"

import { useState } from "react"
import { TakeoffProvider } from "@/lib/takeoff-store"
import { ElevationSidebar } from "@/components/elevation-sidebar"
import { TakeoffCanvas } from "@/components/takeoff-canvas"
import { TakeoffSheet } from "@/components/takeoff-sheet"
import { ProjectToolbar } from "@/components/project-toolbar"
import { MaterialsView } from "@/components/materials-view"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Ruler, FileDown } from "lucide-react"

type View = "takeoff" | "materials" | "reports"

export default function Page() {
  const [view, setView] = useState<View>("takeoff")

  return (
    <TakeoffProvider>
      <div className="flex h-svh w-full flex-col overflow-hidden">
        {/* Top app bar */}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Ruler className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              StackLine
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Siding Take-Off Estimator
            </span>
          </div>
          <nav className="ml-4 hidden items-center gap-1 text-sm text-muted-foreground md:flex">
            <button
              type="button"
              onClick={() => setView("takeoff")}
              className={cn(
                "rounded-md px-2 py-1",
                view === "takeoff" && "font-medium text-foreground",
              )}
            >
              Take-Off
            </button>
            <button
              type="button"
              onClick={() => setView("materials")}
              className={cn(
                "rounded-md px-2 py-1",
                view === "materials" && "font-medium text-foreground",
              )}
            >
              Materials
            </button>
            <button
              type="button"
              onClick={() => setView("reports")}
              className={cn(
                "rounded-md px-2 py-1",
                view === "reports" && "font-medium text-foreground",
              )}
            >
              Reports
            </button>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ProjectToolbar />
            <Button size="sm" variant="outline" className="gap-1.5">
              <FileDown className="size-4" />
              <span className="hidden lg:inline">Export</span>
            </Button>
          </div>
        </header>

        {/* View content */}
        {view === "takeoff" && (
          <div className="flex min-h-0 flex-1">
            <ElevationSidebar />
            <TakeoffCanvas />
            <TakeoffSheet />
          </div>
        )}

        {view === "materials" && <MaterialsView />}

        {view === "reports" && (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <FileDown className="size-6" />
              </span>
              <p className="text-sm font-medium">Reports coming soon</p>
              <p className="text-xs text-muted-foreground">
                Export and reporting features will be available here.
              </p>
            </div>
          </div>
        )}
      </div>
    </TakeoffProvider>
  )
}
