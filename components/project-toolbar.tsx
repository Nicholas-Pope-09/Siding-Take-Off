"use client"

import { useCallback, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Save,
  FolderOpen,
  FolderPlus,
  Trash2,
  LoaderCircle,
  FileStack,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { useTakeoff } from "@/lib/takeoff-store"
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  type ProjectSummary,
} from "@/app/actions/projects"

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function ProjectToolbar() {
  const {
    projectName,
    currentProjectId,
    dirty,
    setProjectName,
    setCurrentProjectId,
    markSaved,
    serialize,
    loadSnapshot,
    resetProject,
  } = useTakeoff()

  const [saving, startSaving] = useTransition()
  const [openDialog, setOpenDialog] = useState(false)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [confirmNew, setConfirmNew] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null)

  /* ----- Save (manual) ----- */
  const handleSave = useCallback(() => {
    const data = serialize()
    startSaving(async () => {
      try {
        if (currentProjectId == null) {
          const { id } = await createProject(projectName, data)
          setCurrentProjectId(id)
        } else {
          await updateProject(currentProjectId, projectName, data)
        }
        markSaved()
        toast.success("Take-off saved.")
      } catch (err) {
        console.log("[v0] save failed:", err)
        toast.error("Could not save. Please try again.")
      }
    })
  }, [
    currentProjectId,
    projectName,
    serialize,
    setCurrentProjectId,
    markSaved,
  ])

  /* ----- Open: load project list ----- */
  const refreshList = useCallback(async () => {
    setLoadingList(true)
    try {
      setProjects(await listProjects())
    } catch (err) {
      console.log("[v0] list failed:", err)
      toast.error("Could not load saved projects.")
    } finally {
      setLoadingList(false)
    }
  }, [])

  const handleOpenDialog = useCallback(() => {
    setOpenDialog(true)
    void refreshList()
  }, [refreshList])

  const handleOpenProject = useCallback(
    (id: number) => {
      setPendingId(id)
      void (async () => {
        try {
          const project = await getProject(id)
          if (!project) {
            toast.error("That project no longer exists.")
            await refreshList()
            return
          }
          loadSnapshot(project.data, { id: project.id, name: project.name })
          setOpenDialog(false)
          toast.success(`Opened "${project.name}".`)
        } catch (err) {
          console.log("[v0] open failed:", err)
          toast.error("Could not open that project.")
        } finally {
          setPendingId(null)
        }
      })()
    },
    [loadSnapshot, refreshList],
  )

  const handleDelete = useCallback(
    (target: ProjectSummary) => {
      void (async () => {
        try {
          await deleteProject(target.id)
          if (currentProjectId === target.id) resetProject()
          toast.success(`Deleted "${target.name}".`)
          await refreshList()
        } catch (err) {
          console.log("[v0] delete failed:", err)
          toast.error("Could not delete that project.")
        } finally {
          setDeleteTarget(null)
        }
      })()
    },
    [currentProjectId, resetProject, refreshList],
  )

  const handleNew = useCallback(() => {
    if (dirty) {
      setConfirmNew(true)
    } else {
      resetProject()
      toast.success("Started a new take-off.")
    }
  }, [dirty, resetProject])

  return (
    <div className="flex items-center gap-2">
      {/* Project name + unsaved indicator */}
      <div className="relative hidden items-center md:flex">
        <Input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          aria-label="Project name"
          className="h-8 w-48 bg-background pr-6 text-sm font-medium"
        />
        {dirty && (
          <span
            className="absolute right-2 size-2 rounded-full bg-accent"
            title="Unsaved changes"
            aria-label="Unsaved changes"
          />
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={handleNew}
      >
        <FolderPlus className="size-4" />
        <span className="hidden sm:inline">New</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={handleOpenDialog}
      >
        <FolderOpen className="size-4" />
        <span className="hidden sm:inline">Open</span>
      </Button>

      <Button
        size="sm"
        className="gap-1.5"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        Save
      </Button>

      {/* Open / projects dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Saved Take-offs</DialogTitle>
            <DialogDescription>
              Open a saved project or remove ones you no longer need.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto">
            {loadingList ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Loading projects…
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <FileStack className="size-6" />
                <p>No saved take-offs yet. Use Save to create one.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "flex items-center gap-3 rounded-md border border-transparent px-2 py-2 hover:border-border hover:bg-secondary/50",
                      currentProjectId === p.id && "border-border bg-secondary/50",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenProject(p.id)}
                      disabled={pendingId === p.id}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                        {pendingId === p.id ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <FileStack className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {p.name}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {timeAgo(p.updatedAt)}
                          <span aria-hidden>·</span>
                          {p.sectionCount}{" "}
                          {p.sectionCount === 1 ? "section" : "sections"}
                        </span>
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm: start new with unsaved changes */}
      <AlertDialog open={confirmNew} onOpenChange={setConfirmNew}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current take-off has unsaved changes. Starting a new one will
              clear them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                resetProject()
                setConfirmNew(false)
                toast.success("Started a new take-off.")
              }}
            >
              Discard & start new
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: delete a project */}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this take-off?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" will be permanently removed. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
