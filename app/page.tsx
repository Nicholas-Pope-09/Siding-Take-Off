import { TakeoffProvider } from "@/lib/takeoff-store"
import { ElevationSidebar } from "@/components/elevation-sidebar"
import { TakeoffCanvas } from "@/components/takeoff-canvas"
import { TakeoffSheet } from "@/components/takeoff-sheet"
import { ProjectToolbar } from "@/components/project-toolbar"
import { Button } from "@/components/ui/button"
import { Ruler, FileDown } from "lucide-react"

export default function Page() {
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
            <span className="rounded-md px-2 py-1 font-medium text-foreground">
              Take-Off
            </span>
            <span className="rounded-md px-2 py-1">Materials</span>
            <span className="rounded-md px-2 py-1">Reports</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ProjectToolbar />
            <Button size="sm" variant="outline" className="gap-1.5">
              <FileDown className="size-4" />
              <span className="hidden lg:inline">Export</span>
            </Button>
          </div>
        </header>

        {/* Three-column workspace */}
        <div className="flex min-h-0 flex-1">
          <ElevationSidebar />
          <TakeoffCanvas />
          <TakeoffSheet />
        </div>
      </div>
    </TakeoffProvider>
  )
}
