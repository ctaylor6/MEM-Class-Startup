"use client"

import React, { useMemo, useState } from "react"
import { runs } from "@/lib/fakeData"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Run = (typeof runs)[number]
type Status = "Pass" | "Watch" | "Fail"

function statusVariant(s: string) {
  if (s === "Pass") return "secondary"
  if (s === "Watch") return "default"
  return "destructive"
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function hashStr(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function prng(seed: number) {
  // deterministic [0,1)
  let x = seed || 123456789
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return ((x >>> 0) % 1_000_000) / 1_000_000
  }
}

function asPct(x: number) {
  return `${Math.round(x * 100)}%`
}

function fmtDateLike(d: string) {
  return d
}

function riskToStatus(risk: number): Status {
  if (risk >= 70) return "Fail"
  if (risk >= 40) return "Watch"
  return "Pass"
}

function makeSpark(id: string, riskScore: number, n = 28) {
  const seed = hashStr(id)
  const rnd = prng(seed)
  const base = clamp01((Number(riskScore) || 0) / 100)

  const pts: number[] = []
  let v = base
  for (let i = 0; i < n; i++) {
    const drift = (rnd() - 0.5) * (0.10 + 0.18 * (1 - base))
    const pull = (base - v) * (0.06 + 0.08 * rnd())
    v = clamp01(v + drift + pull)
    pts.push(v)
  }
  return pts
}

function pathFromSeries(series: number[], w: number, h: number, pad: number) {
  const xs = series.map((_, i) => pad + (i * (w - pad * 2)) / (series.length - 1))
  const ys = series.map(v => pad + (1 - v) * (h - pad * 2))
  return xs
    .map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${ys[i].toFixed(2)}`)
    .join(" ")
}

function Sparkline({
  id,
  riskScore,
  label,
}: {
  id: string
  riskScore: number
  label?: string
}) {
  const data = useMemo(() => makeSpark(id, riskScore), [id, riskScore])
  const w = 150
  const h = 38
  const pad = 4
  const d = pathFromSeries(data, w, h, pad)

  return (
    <div className="flex items-center gap-3">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-zinc-900">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      {label ? <div className="text-xs text-zinc-500">{label}</div> : null}
    </div>
  )
}

function BarMini({
  value01,
  label,
}: {
  value01: number
  label: string
}) {
  const v = clamp01(value01)
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-600">{label}</span>
        <span className="tabular-nums text-zinc-800">{asPct(v)}</span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-zinc-100">
        <div
          className="h-2 rounded-full bg-zinc-900"
          style={{ width: `${Math.round(v * 100)}%` }}
        />
      </div>
    </div>
  )
}

function Histogram({
  values,
  bins = 12,
}: {
  values: number[]
  bins?: number
}) {
  const counts = useMemo(() => {
    const c = new Array(bins).fill(0)
    for (const v0 of values) {
      const v = clamp01(v0 / 100)
      const i = Math.min(bins - 1, Math.max(0, Math.floor(v * bins)))
      c[i]++
    }
    return c
  }, [values, bins])

  const max = Math.max(1, ...counts)
  const w = 360
  const h = 72
  const pad = 6
  const bw = (w - pad * 2) / bins

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-zinc-900">
      {counts.map((c, i) => {
        const bh = ((h - pad * 2) * c) / max
        const x = pad + i * bw
        const y = h - pad - bh
        return (
          <rect
            key={i}
            x={x + 1}
            y={y}
            width={Math.max(1, bw - 2)}
            height={bh}
            rx={3}
            fill="currentColor"
            opacity={0.14}
          />
        )
      })}
      <rect x={pad} y={h - pad - 1} width={w - pad * 2} height={1} fill="currentColor" opacity={0.25} />
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
  subtitle,
  children,
  onClose,
}: {
  open: boolean
  title: string
  subtitle?: string
  children: React.ReactNode
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 w-[min(880px,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
            <div className="min-w-0">
              <div className="text-base font-semibold">{title}</div>
              {subtitle ? <div className="mt-1 text-sm text-zinc-600">{subtitle}</div> : null}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-50"
              type="button"
            >
              Close
            </button>
          </div>
          <div className="px-5 py-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

function scoreTag(score01: number) {
  const s = clamp01(score01)
  if (s >= 0.75) return "High"
  if (s >= 0.45) return "Medium"
  return "Low"
}

function fakeSignalsForRun(r: any) {
  const id = String(r.id ?? "")
  const seed = hashStr(id + "|" + String(r.program ?? "") + "|" + String(r.part ?? ""))
  const rnd = prng(seed)

  const risk = clamp01(Number(r.riskScore ?? 0) / 100)

  // "technical" metrics, intentionally plausible but synthetic
  const spatter = clamp01(0.18 + 0.75 * risk + (rnd() - 0.5) * 0.12)
  const meltPool = clamp01(0.20 + 0.65 * risk + (rnd() - 0.5) * 0.14)
  const recoater = clamp01(0.10 + 0.55 * risk + (rnd() - 0.5) * 0.20)
  const plume = clamp01(0.12 + 0.60 * risk + (rnd() - 0.5) * 0.16)
  const gasFlow = clamp01(0.80 - 0.55 * risk + (rnd() - 0.5) * 0.18)

  const seriesA = makeSpark(id + "A", Number(r.riskScore ?? 0) + 6, 34) // spatter-like
  const seriesB = makeSpark(id + "B", Number(r.riskScore ?? 0) - 8, 34) // melt pool
  const seriesC = makeSpark(id + "C", Number(r.riskScore ?? 0) + 2, 34) // plume

  const anomalies = Math.max(0, Math.round((risk * 6 + rnd() * 2.2) - 0.6))

  const topDrivers = [
    { name: "Spatter intensity", score: spatter, note: "Elevated ejecta correlates with surface roughness and lack-of-fusion risk." },
    { name: "Melt pool stability", score: meltPool, note: "Instability increases microstructure variability and mechanical scatter." },
    { name: "Recoater interaction", score: recoater, note: "Intermittent contact signatures correlate with streaking and layer defects." },
    { name: "Plume opacity", score: plume, note: "Higher plume opacity correlates with energy coupling drift and porosity proxies." },
    { name: "Gas flow margin", score: 1 - gasFlow, note: "Reduced flow margin correlates with soot accumulation and spatter recirculation." },
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const predictedCTPorosity = Math.max(0, Math.round(2 + 38 * risk + rnd() * 6))
  const tensileMargin = clamp01(0.92 - 0.42 * risk + (rnd() - 0.5) * 0.08) // higher is better
  const fatigueRisk = clamp01(0.10 + 0.78 * risk + (rnd() - 0.5) * 0.12)

  const disposition =
    risk >= 0.72
      ? { label: "Hold for targeted NDT", detail: "Automatic hold triggered due to consistent high-risk signatures." }
      : risk >= 0.42
      ? { label: "Proceed with enhanced inspection", detail: "Proceed, but increase sampling intensity and review anomaly windows." }
      : { label: "Proceed", detail: "Within expected process envelope for this program and material." }

  return {
    risk,
    spatter,
    meltPool,
    recoater,
    plume,
    gasFlow,
    anomalies,
    seriesA,
    seriesB,
    seriesC,
    topDrivers,
    predictedCTPorosity,
    tensileMargin,
    fatigueRisk,
    disposition,
  }
}

export default function Page() {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(
    () => new Set<Status>(["Fail", "Watch", "Pass"])
  )
  const [program, setProgram] = useState<string>("All")
  const [facility, setFacility] = useState<string>("Aerospace Production Facility — North Line")
  const [sort, setSort] = useState<"risk_desc" | "risk_asc" | "date_desc" | "id">("risk_desc")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalRun, setModalRun] = useState<Run | null>(null)

  const programs = useMemo(() => {
    const s = new Set<string>()
    for (const r of runs) s.add(String((r as any).program ?? ""))
    return ["All", ...Array.from(s).filter(Boolean).sort()]
  }, [])

  const facilities = useMemo(
    () => [
      "Aerospace Production Facility — North Line",
      "Aerospace Production Facility — South Line",
      "Aerospace Production Facility — Prototype Cell",
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    const base = runs.filter(r => {
      const risk = Number((r as any).riskScore ?? 0)
      const st = riskToStatus(risk)
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
        st,
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
    const risks = filtered.map(r => Number((r as any).riskScore ?? 0))
    const pass = filtered.filter(r => riskToStatus(Number((r as any).riskScore ?? 0)) === "Pass").length
    const watch = filtered.filter(r => riskToStatus(Number((r as any).riskScore ?? 0)) === "Watch").length
    const fail = filtered.filter(r => riskToStatus(Number((r as any).riskScore ?? 0)) === "Fail").length
    const avg = total === 0 ? 0 : risks.reduce((a, b) => a + b, 0) / total
    const p90 =
      total === 0
        ? 0
        : [...risks].sort((a, b) => a - b)[Math.min(total - 1, Math.floor(0.9 * (total - 1)))]

    return {
      total,
      pass,
      watch,
      fail,
      avg: Math.round(avg),
      p90: Math.round(p90),
      risks,
    }
  }, [filtered])

  const toggleStatus = (s: Status) => {
    setStatusFilter(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      if (next.size === 0) return prev
      return next
    })
  }

  const clearFilters = () => {
    setQuery("")
    setProgram("All")
    setStatusFilter(new Set<Status>(["Fail", "Watch", "Pass"]))
    setSort("risk_desc")
    setExpandedId(null)
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">Qualification Risk Dashboard</h1>
            <p className="mt-2 text-zinc-600">
              Live operations view for the {facility}. All signals and outcomes shown here are synthetic.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <select
              value={facility}
              onChange={e => setFacility(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
            >
              {facilities.map(f => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={clearFilters}>
              Reset
            </Button>
            <Button onClick={() => alert("Export queued (demo).")}>Export</Button>
          </div>
        </div>

        {/* KPI row */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-5">
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-600">P90 risk</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{kpis.p90}</CardContent>
          </Card>
        </div>

        {/* Distribution panel */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-12">
          <Card className="sm:col-span-7">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-600">Risk distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <Histogram values={kpis.risks} />
              <div className="min-w-[170px] space-y-3">
                <div>
                  <div className="text-xs font-medium text-zinc-600">Operational note</div>
                  <div className="mt-1 text-sm text-zinc-700">
                    Shift manager view prioritizes high-risk builds and clusters by program and material.
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs font-medium text-zinc-600">Auto-routing</div>
                  <div className="mt-1 text-sm text-zinc-800">
                    Fail → hold & NDT<br />
                    Watch → enhanced inspection<br />
                    Pass → proceed
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="sm:col-span-5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-600">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-600">Search</label>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="ID, program, part, material, date..."
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
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

                <div>
                  <label className="text-xs font-medium text-zinc-600">Sort</label>
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                  >
                    <option value="risk_desc">Risk high</option>
                    <option value="risk_asc">Risk low</option>
                    <option value="date_desc">Newest</option>
                    <option value="id">Run ID</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-medium text-zinc-600">Status:</div>
                <Pill active={statusFilter.has("Fail")} onClick={() => toggleStatus("Fail")}>
                  Fail
                </Pill>
                <Pill active={statusFilter.has("Watch")} onClick={() => toggleStatus("Watch")}>
                  Watch
                </Pill>
                <Pill active={statusFilter.has("Pass")} onClick={() => toggleStatus("Pass")}>
                  Pass
                </Pill>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        <div className="mt-6 grid grid-cols-1 gap-4">
          {filtered.map(r => {
            const id = String((r as any).id)
            const risk = Number((r as any).riskScore ?? 0)
            const status = riskToStatus(risk)
            const isOpen = expandedId === id
            const sig = fakeSignalsForRun(r as any)

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
                          <span>process signals</span>
                        </div>

                        <div className="hidden text-zinc-900 sm:block">
                          <Sparkline id={id} riskScore={risk} label="overall" />
                        </div>
                      </div>

                      <div className="mt-2 truncate text-sm text-zinc-600">
                        {(r as any).program} • {(r as any).part} • {(r as any).material} •{" "}
                        {fmtDateLike(String((r as any).date ?? ""))}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                          <div className="text-xs text-zinc-500">Spatter</div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <div className="text-sm font-semibold text-zinc-900">{scoreTag(sig.spatter)}</div>
                            <div className="text-xs text-zinc-500">{asPct(sig.spatter)}</div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                          <div className="text-xs text-zinc-500">Melt pool</div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <div className="text-sm font-semibold text-zinc-900">{scoreTag(sig.meltPool)}</div>
                            <div className="text-xs text-zinc-500">{asPct(sig.meltPool)}</div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                          <div className="text-xs text-zinc-500">Recoater</div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <div className="text-sm font-semibold text-zinc-900">{scoreTag(sig.recoater)}</div>
                            <div className="text-xs text-zinc-500">{asPct(sig.recoater)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <div className="text-xs text-zinc-500">Risk score</div>
                        <div className="text-2xl font-semibold tabular-nums">{risk}</div>
                        <div className="mt-1 text-xs text-zinc-500 tabular-nums">
                          anomalies: {sig.anomalies}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setExpandedId(isOpen ? null : id)}>
                          {isOpen ? "Collapse" : "Expand"}
                        </Button>
                        <Button onClick={() => setModalRun(r)}>Details</Button>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-5 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-12">
                      <div className="sm:col-span-7">
                        <div className="text-sm font-semibold">Drivers and signals</div>
                        <div className="mt-1 text-sm text-zinc-600">
                          Elevated spatter and melt pool instability increase the probability of part-level quality escape.
                          Recoater interaction raises the chance of layer streaking and geometric deviation.
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                            <div className="text-xs font-medium text-zinc-600">Spatter intensity (proxy)</div>
                            <div className="mt-2">
                              <svg width={320} height={74} viewBox="0 0 320 74" className="text-zinc-900">
                                <path
                                  d={pathFromSeries(sig.seriesA, 320, 74, 6)}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                            <div className="mt-2 text-sm text-zinc-700">
                              Higher spatter correlates with surface roughness and defect formation.
                            </div>
                          </div>

                          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                            <div className="text-xs font-medium text-zinc-600">Melt pool stability (proxy)</div>
                            <div className="mt-2">
                              <svg width={320} height={74} viewBox="0 0 320 74" className="text-zinc-900">
                                <path
                                  d={pathFromSeries(sig.seriesB, 320, 74, 6)}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                            <div className="mt-2 text-sm text-zinc-700">
                              Instability correlates with microstructure variability and mechanical scatter.
                            </div>
                          </div>

                          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                            <div className="text-xs font-medium text-zinc-600">Plume opacity (proxy)</div>
                            <div className="mt-2">
                              <svg width={320} height={74} viewBox="0 0 320 74" className="text-zinc-900">
                                <path
                                  d={pathFromSeries(sig.seriesC, 320, 74, 6)}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                            <div className="mt-2 text-sm text-zinc-700">
                              Opacity drift correlates with energy coupling changes and porosity proxies.
                            </div>
                          </div>

                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <div className="text-xs font-medium text-zinc-600">Contribution breakdown</div>
                            <div className="mt-3 space-y-3">
                              <BarMini value01={sig.spatter} label="Spatter → surface & defect risk" />
                              <BarMini value01={sig.meltPool} label="Melt pool → microstructure risk" />
                              <BarMini value01={sig.recoater} label="Recoater → layer integrity risk" />
                              <BarMini value01={sig.plume} label="Plume → coupling drift risk" />
                              <BarMini value01={1 - sig.gasFlow} label="Gas flow → recirculation risk" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-5">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <div className="text-sm font-semibold">Predicted outcomes</div>
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2">
                              <div className="text-sm text-zinc-700">CT porosity count (est.)</div>
                              <div className="text-sm font-semibold tabular-nums text-zinc-900">
                                {sig.predictedCTPorosity}
                              </div>
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2">
                              <div className="text-sm text-zinc-700">Tensile margin (est.)</div>
                              <div className="text-sm font-semibold tabular-nums text-zinc-900">
                                {asPct(sig.tensileMargin)}
                              </div>
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2">
                              <div className="text-sm text-zinc-700">Fatigue risk (est.)</div>
                              <div className="text-sm font-semibold tabular-nums text-zinc-900">
                                {asPct(sig.fatigueRisk)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
                            <div className="text-xs font-medium text-zinc-600">Disposition</div>
                            <div className="mt-1 text-sm font-semibold text-zinc-900">
                              {sig.disposition.label}
                            </div>
                            <div className="mt-1 text-sm text-zinc-700">{sig.disposition.detail}</div>
                          </div>

                          <div className="mt-4">
                            <div className="text-xs font-medium text-zinc-600">Top drivers</div>
                            <div className="mt-2 space-y-2">
                              {sig.topDrivers.map(d => (
                                <div key={d.name} className="rounded-xl border border-zinc-200 bg-white p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-zinc-900">{d.name}</div>
                                      <div className="mt-1 text-sm text-zinc-700">{d.note}</div>
                                    </div>
                                    <div className="text-sm font-semibold tabular-nums text-zinc-900">
                                      {asPct(d.score)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => alert("Ticket created (demo).")}>
                              Create ticket
                            </Button>
                            <Button variant="secondary" onClick={() => alert("Report generated (demo).")}>
                              Generate report
                            </Button>
                            <Button onClick={() => alert("Notification sent (demo).")}>Notify</Button>
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
        subtitle={
          modalRun
            ? `Aerospace Production Facility • ${String((modalRun as any).program)} • ${String(
                (modalRun as any).part
              )} • ${String((modalRun as any).material)} • ${String((modalRun as any).date)}`
            : undefined
        }
        onClose={() => setModalRun(null)}
      >
        {modalRun && (() => {
          const id = String((modalRun as any).id)
          const risk = Number((modalRun as any).riskScore ?? 0)
          const status = riskToStatus(risk)
          const sig = fakeSignalsForRun(modalRun as any)

          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(status) as any}>{status}</Badge>
                <div className="text-sm text-zinc-600">
                  Recommended disposition: <span className="font-semibold text-zinc-900">{sig.disposition.label}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-7 rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-zinc-600">Risk score</div>
                      <div className="text-3xl font-semibold tabular-nums text-zinc-900">{risk}</div>
                    </div>
                    <Sparkline id={id} riskScore={risk} label="overall trend" />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-medium text-zinc-600">Spatter → part quality</div>
                      <div className="mt-2 text-sm text-zinc-700">
                        Elevated spatter correlates with surface roughness and defect formation.
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-medium text-zinc-600">Melt pool → microstructure</div>
                      <div className="mt-2 text-sm text-zinc-700">
                        Instability correlates with microstructure variability and mechanical scatter.
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-medium text-zinc-600">Recoater → layer integrity</div>
                      <div className="mt-2 text-sm text-zinc-700">
                        Interaction signatures correlate with streaking and geometric deviation.
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-medium text-zinc-600">Gas flow → recirculation</div>
                      <div className="mt-2 text-sm text-zinc-700">
                        Reduced margin correlates with soot accumulation and spatter recirculation.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-sm font-semibold">Run summary</div>
                  <div className="mt-3 space-y-3">
                    <BarMini value01={sig.spatter} label="Spatter intensity" />
                    <BarMini value01={sig.meltPool} label="Melt pool instability" />
                    <BarMini value01={sig.recoater} label="Recoater interaction" />
                    <BarMini value01={sig.plume} label="Plume opacity" />
                    <BarMini value01={1 - sig.gasFlow} label="Gas flow deficit" />
                  </div>

                  <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="text-xs font-medium text-zinc-600">Predicted outcomes</div>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-700">CT porosity count (est.)</span>
                        <span className="font-semibold tabular-nums text-zinc-900">{sig.predictedCTPorosity}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-700">Tensile margin (est.)</span>
                        <span className="font-semibold tabular-nums text-zinc-900">{asPct(sig.tensileMargin)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-700">Fatigue risk (est.)</span>
                        <span className="font-semibold tabular-nums text-zinc-900">{asPct(sig.fatigueRisk)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => alert("Share link copied (demo).")}>Share</Button>
                    <Button variant="secondary" onClick={() => setModalRun(null)}>
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}