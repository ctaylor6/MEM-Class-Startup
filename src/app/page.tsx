"use client"

import React, { useMemo, useState } from "react"
import { runs } from "@/lib/fakeData"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Run = (typeof runs)[number]

function statusVariant(s: string) {
  if (s === "Pass") return "secondary"
  if (s === "Watch") return "default"
  return "destructive"
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function fmtDateLike(d: string) {
  // Keep as-is if already formatted in your data
  return d
}

function hashStr(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function makeSpark(id: string, riskScore: number, n = 22) {
  // Deterministic pseudo-series, looks like "trend" per run
  const seed = hashStr(id)
  const base = clamp01((Number(riskScore) || 0) / 100)
  const pts: number[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const noise =
      (((seed + i * 1013) % 1000) / 1000 - 0.5) * (0.18 + 0.22 * (1 - base))
    const wave = Math.sin((t * 2.8 + (seed % 10) / 10) * Math.PI) * 0.08
    const drift = (t - 0.5) * 0.12 * (base - 0.4)
    pts.push(clamp01(base + noise + wave + drift))
  }
  return pts
}

function Sparkline({ id, riskScore }: { id: string; riskScore: number }) {
  const data = useMemo(() => makeSpark(id, riskScore), [id, riskScore])
  const w = 140
  const h = 34
  const pad = 3
  const xs = data.map((_, i) => pad + (i * (w - pad * 2)) / (data.length - 1))
  const ys = data.map(v => pad + (1 - v) * (h - pad * 2))

  const d = xs
    .map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${ys[i].toFixed(2)}`)
    .join(" ")

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-90">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1 text-sm transition",
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50",
      ].join(" ")}
      type="button"
    >
      {children}
    </button>
  )
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute left-1/2 top-1/2 w-[min(720px,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <div className="text-base font-semibold">{title}</div>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-50"
              type="button"
            >
              Close
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    () => new Set(["Fail", "Watch", "Pass"])
  )
  const [program, setProgram] = useState<string>("All")
  const [sort, setSort] = useState<"risk_desc" | "risk_asc" | "date_desc" | "id">(
    "risk_desc"
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalRun, setModalRun] = useState<Run | null>(null)

  const programs = useMemo(() => {
    const s = new Set<string>()
    for (const r of runs) s.add(String((r as any).program ?? ""))
    return ["All", ...Array.from(s).filter(Boolean).sort()]
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    const base = runs.filter(r => {
      const st = String((r as any).status ?? "")
      if (!statusFilter.has(st)) return false

      const pr = String((r as any).program ?? "")
      if (program !== "All" && pr !== program) return false

      if (!q) return true

      const hay = [
        (r as any).id,
        (r as any).program,
        (r as any).part,
        (r as any).material,
        (r as any).date,
        (r as any).status,
      ]
        .map(x => String(x ?? ""))
        .join(" • ")
        .toLowerCase()

      return hay.includes(q)
    })

    const sorted = [...base].sort((a, b) => {
      const ra = Number((a as any).riskScore ?? 0)
      const rb = Number((b as any).riskScore ?? 0)
      if (sort === "risk_desc") return rb - ra
      if (sort === "risk_asc") return ra - rb
      if (sort === "date_desc") {
        // If dates are ISO strings, this works. Otherwise it still gives stable-ish sorting.
        const da = String((a as any).date ?? "")
        const db = String((b as any).date ?? "")
        return db.localeCompare(da)
      }
      const ia = String((a as any).id ?? "")
      const ib = String((b as any).id ?? "")
      return ia.localeCompare(ib)
    })

    return sorted
  }, [query, statusFilter, program, sort])

  const kpis = useMemo(() => {
    const total = filtered.length
    const pass = filtered.filter(r => (r as any).status === "Pass").length
    const watch = filtered.filter(r => (r as any).status === "Watch").length
    const fail = filtered.filter(r => (r as any).status === "Fail").length
    const avg =
      total === 0
        ? 0
        : filtered.reduce((acc, r) => acc + Number((r as any).riskScore ?? 0), 0) /
          total
    return { total, pass, watch, fail, avg: Math.round(avg) }
  }, [filtered])

  const toggleStatus = (s: string) => {
    setStatusFilter(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      // Never allow empty selection
      if (next.size === 0) return prev
      return next
    })
  }

  const clearFilters = () => {
    setQuery("")
    setProgram("All")
    setStatusFilter(new Set(["Fail", "Watch", "Pass"]))
    setSort("risk_desc")
    setExpandedId(null)
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Qualification Risk Dashboard
            </h1>
            <p className="mt-2 text-zinc-600">Demo only. All data is synthetic.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={clearFilters}>
              Reset
            </Button>
            <Button onClick={() => alert("Hook this to your export later.")}>
              Export
            </Button>
          </div>
        </div>

        {/* KPI row */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-600">Runs</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{kpis.total}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-600">Pass</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{kpis.pass}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-600">Watch</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{kpis.watch}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-600">Avg risk</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{kpis.avg}</CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
            <div className="sm:col-span-5">
              <label className="text-xs font-medium text-zinc-600">Search</label>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ID, program, part, material, date..."
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-xs font-medium text-zinc-600">Program</label>
              <select
                value={program}
                onChange={e => setProgram(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
              >
                {programs.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-4">
              <label className="text-xs font-medium text-zinc-600">Sort</label>
              <div className="mt-1 flex gap-2">
                <Pill active={sort === "risk_desc"} onClick={() => setSort("risk_desc")}>
                  Risk high
                </Pill>
                <Pill active={sort === "risk_asc"} onClick={() => setSort("risk_asc")}>
                  Risk low
                </Pill>
                <Pill active={sort === "date_desc"} onClick={() => setSort("date_desc")}>
                  Newest
                </Pill>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="text-xs font-medium text-zinc-600">Status:</div>
            <Pill active={statusFilter.has("Fail")} onClick={() => toggleStatus("Fail")}>
              Fail
            </Pill>
            <Pill
              active={statusFilter.has("Watch")}
              onClick={() => toggleStatus("Watch")}
            >
              Watch
            </Pill>
            <Pill active={statusFilter.has("Pass")} onClick={() => toggleStatus("Pass")}>
              Pass
            </Pill>
          </div>
        </div>

        {/* List */}
        <div className="mt-6 grid grid-cols-1 gap-4">
          {filtered.map(r => {
            const id = String((r as any).id)
            const status = String((r as any).status)
            const risk = Number((r as any).riskScore ?? 0)
            const isOpen = expandedId === id

            return (
              <Card
                key={id}
                className={[
                  "transition-shadow",
                  "hover:shadow-sm",
                  isOpen ? "ring-1 ring-zinc-300" : "",
                ].join(" ")}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-sm font-semibold">{id}</div>
                        <Badge variant={statusVariant(status) as any}>{status}</Badge>

                        <div className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
                          <span className="h-1 w-1 rounded-full bg-zinc-300" />
                          <span>signal trend</span>
                        </div>
                        <div className="hidden text-zinc-700 sm:block">
                          <Sparkline id={id} riskScore={risk} />
                        </div>
                      </div>

                      <div className="mt-2 truncate text-sm text-zinc-600">
                        {(r as any).program} • {(r as any).part} • {(r as any).material} •{" "}
                        {fmtDateLike(String((r as any).date ?? ""))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <div className="text-xs text-zinc-500">Risk score</div>
                        <div className="text-2xl font-semibold tabular-nums">{risk}</div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setExpandedId(isOpen ? null : id)}
                        >
                          {isOpen ? "Collapse" : "Expand"}
                        </Button>
                        <Button onClick={() => setModalRun(r)}>Details</Button>
                      </div>
                    </div>
                  </div>

                  {/* Expand section */}
                  {isOpen && (
                    <div className="mt-5 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-12">
                      <div className="sm:col-span-7">
                        <div className="text-sm font-semibold">What changed</div>
                        <div className="mt-1 text-sm text-zinc-600">
                          Risk is computed from synthetic indicators. Replace this block with
                          your actual drivers (melt pool stability, porosity proxies,
                          layer anomalies, etc).
                        </div>

                        <div className="mt-3">
                          <div className="text-xs font-medium text-zinc-600">
                            Explainability
                          </div>
                          <div className="mt-2 space-y-2">
                            {[
                              { k: "Thermal drift", v: clamp01(risk / 100) },
                              { k: "Spatter proxy", v: clamp01(0.25 + (risk / 120)) },
                              { k: "Recoater risk", v: clamp01(0.15 + (risk / 180)) },
                            ].map(x => (
                              <div key={x.k}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-zinc-600">{x.k}</span>
                                  <span className="tabular-nums text-zinc-700">
                                    {Math.round(x.v * 100)}%
                                  </span>
                                </div>
                                <div className="mt-1 h-2 w-full rounded-full bg-zinc-100">
                                  <div
                                    className="h-2 rounded-full bg-zinc-900"
                                    style={{ width: `${Math.round(x.v * 100)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-5">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <div className="text-sm font-semibold">Suggested action</div>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                            <li>Review layer window around anomaly peak.</li>
                            <li>Confirm gas flow and recoater logs.</li>
                            <li>Consider a hold for targeted NDT.</li>
                          </ul>

                          <div className="mt-4 flex gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => alert("Hook this to your workflow later.")}
                            >
                              Create ticket
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => alert("Hook this to a report generator later.")}
                            >
                              Generate report
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-600">
              No runs match your filters.
            </div>
          )}
        </div>
      </div>

      <Modal
        open={!!modalRun}
        title={modalRun ? `Run ${String((modalRun as any).id)}` : "Run"}
        onClose={() => setModalRun(null)}
      >
        {modalRun && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(String((modalRun as any).status)) as any}>
                {String((modalRun as any).status)}
              </Badge>
              <div className="text-sm text-zinc-600">
                {(modalRun as any).program} • {(modalRun as any).part} •{" "}
                {(modalRun as any).material} • {String((modalRun as any).date)}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-zinc-600">Risk score</div>
                  <div className="text-3xl font-semibold tabular-nums">
                    {Number((modalRun as any).riskScore ?? 0)}
                  </div>
                </div>
                <div className="text-zinc-700">
                  <Sparkline
                    id={String((modalRun as any).id)}
                    riskScore={Number((modalRun as any).riskScore ?? 0)}
                  />
                </div>
              </div>

              <div className="mt-3 text-sm text-zinc-600">
                Replace this modal content with your real run metadata, model outputs, and
                linked artifacts (plots, CT summary, NDT notes).
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => alert("Hook up to a shareable URL later.")}>Share</Button>
              <Button variant="secondary" onClick={() => setModalRun(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}