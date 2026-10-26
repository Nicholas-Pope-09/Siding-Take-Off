"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  ELEVATIONS,
  SECTION_TYPE_LABEL,
  useTakeoff,
  type ElevationId,
  type Section,
  type SectionType,
} from "@/lib/takeoff-store"
import {
  Plus,
  Square,
  Triangle,
  Scissors,
  Building2,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  ArrowRightLeft,
  Trash2,
} from "lucide-react"

function TypeIcon({ type, className }: { type: SectionType; className?: string }) {
  if (type === "wall") return <Square className={className} />
  if (type === "gable") return <Triangle className={className} />
  return <Scissors className={className} />
}

function SectionRow({ section }: { section: Section }) {
  const {
    selectedSectionId,
    selectSection,
    compute,
    updateSection,
    moveSection,
    deleteSection,
  } = useTakeoff()
  const active = selectedSectionId === section.id
  const c = compute(section)
  const hasGeometry = section.points.length > 0
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(section.name)

  function startRename() {
    setDraftName(section.name)
    setEditing(true)
  }

  function commitRename() {
    const name = draftName.trim()
    if (name && name !== section.name) updateSection(section.id, { name })
    setEditing(false)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => selectSection(section.id)}
      onKeyDown={(e) => {
        if (editing) return
        if (e.key === "Enter") selectSection(section.id)
        if (e.key === "F2") startRename()
      }}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded"
        style={{
          color: section.color,
          backgroundColor: `color-mix(in oklch, ${section.color} 18%, transparent)`,
          boxShadow: active
            ? `inset 0 0 0 1.5px ${section.color}`
            : undefined,
        }}
      >
        <TypeIcon type={section.type} className="size-3.5" />
      </span>
      {editing ? (
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename()
            if (e.key === "Escape") setEditing(false)
          }}
          className="min-w-0 flex-1 rounded border border-input bg-background px-1 py-0.5 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      ) : (
        <span
          className="min-w-0 flex-1 truncate font-medium"
          onDoubleClick={(e) => {
            e.stopPropagation()
            startRename()
          }}
          title="Double-click to rename"
        >
          {section.name}
        </span>
      )}
      {hasGeometry ? (
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {section.geometry === "area"
            ? `${c.slopeArea.toFixed(0)} sf`
            : `${c.baseArea.toFixed(0)} lf`}
        </span>
      ) : (
        <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => e.stopPropagation()}
          render={
            <button
              type="button"
              className={cn(
                "shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground",
                active ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              )}
              aria-label={`Options for ${section.name}`}
            >
              <MoreHorizontal className="size-4" />
            </button>
          }
        />
        {/* finalFocus off so closing the menu doesn't steal focus from the rename input */}
        <DropdownMenuContent align="end" className="w-44" finalFocus={false}>
          <DropdownMenuItem onClick={startRename}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeft />
              Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {ELEVATIONS.map((el) => (
                <DropdownMenuItem
                  key={el.id}
                  disabled={el.id === section.elevation}
                  onClick={() => moveSection(section.id, el.id)}
                >
                  {el.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => deleteSection(section.id)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function AddSectionMenu({ elevation }: { elevation: ElevationId }) {
  const { addSection, setActiveTool, activePageId } = useTakeoff()
  const types: SectionType[] = ["wall", "gable", "deduction"]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!activePageId}
        render={
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            disabled={!activePageId}
          >
            <span className="flex items-center gap-1.5">
              <Plus className="size-3.5" />
              Add Section
            </span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-(--anchor-width)">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Section type</DropdownMenuLabel>
          {types.map((t) => (
            <DropdownMenuItem
              key={t}
              onClick={() => {
                addSection(elevation, t)
                setActiveTool(t === "gable" ? "area" : "rect")
              }}
            >
              <TypeIcon type={t} />
              {SECTION_TYPE_LABEL[t]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ElevationSidebar() {
  const { sections, pages, activePageId } = useTakeoff()
  const activePage = pages.find((p) => p.id === activePageId) ?? null
  // Sections are organized per sheet — the sidebar shows the active sheet only.
  const pageSections = sections.filter((s) => s.pageId === activePageId)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            Sheet Scope
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {activePage ? activePage.name : "No sheet loaded"}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <Accordion defaultValue={["front"]} multiple className="flex flex-col">
          {ELEVATIONS.map((el) => {
            const elSections = pageSections.filter((s) => s.elevation === el.id)
            return (
              <AccordionItem
                key={el.id}
                value={el.id}
                className="border-b border-border/60"
              >
                <AccordionTrigger className="px-2 hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{el.label}</span>
                    {elSections.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {elSections.length}
                      </Badge>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-2">
                  <div className="flex flex-col gap-2">
                    <AddSectionMenu elevation={el.id} />
                    {elSections.length > 0 ? (
                      <div className="flex flex-col gap-0.5 border-l border-border/70 pl-2">
                        {elSections.map((s) => (
                          <SectionRow key={s.id} section={s} />
                        ))}
                      </div>
                    ) : (
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        No sections yet. Add a wall, gable, or deduction.
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>

      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <span className="font-mono">{pageSections.length}</span> sections on this
        sheet
        {pages.length > 1 && (
          <>
            {" · "}
            <span className="font-mono">{sections.length}</span> total
          </>
        )}
      </div>
    </aside>
  )
}
