"use client"

import React, { useMemo, useRef, useState } from "react"
import { runs } from "@/lib/fakeData"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type Run = (typeof runs)[number]
type Status = "Pass" | "Watch" | "Fail"

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function riskToStatus(riskScore0to100: number): Status {
  if (riskScore0to100 >= 70) return "Fail"
  if (riskScore0to100 >= 40) return "Watch"
  return "Pass"
}

function statusVariant(s: Status) {
  if (s === "Pass") return "secondary"
  if (s === "Watch") return "default"
  return "destructive"
}

function asPct01(x01: number) {
  return `${Math.round(clamp01(x01) * 100)}%`
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
  let x = seed || 123456789
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return ((x >>> 0) % 1_000_000) / 1_000_000
  }
}

/**
 * Synthetic plate assignment and placement.
 * If your data already has buildplateId + x/y, swap this out.
 */
function assignBuildplateId(r: any) {
  const id = String(r?.id ?? "")
  const seed = hashStr(String(r?.program ?? "") + "|" + String(r?.material ?? "") + "|" + id)
  const plate = (seed % 3) + 1
  return `BP-${plate}`
}

function fakePartPlacement(r: any, plateSize = 300) {
  const id = String(r?.id ?? "")
  const seed = hashStr("pos|" + id)
  const rnd = prng(seed)
  const margin = 22
  const x = margin + rnd() * (plateSize - 2 * margin)
  const y = margin + rnd() * (plateSize - 2 * margin)
  return { x, y }
}

/**
 * Signals + condition drivers with explicit quality effect.
 * These are synthetic, but structured so your real model outputs can drop in.
 */
function fakeSignalsForRun(r: any) {
  const id = String(r?.id ?? "")
  const seed = hashStr("sig|" + id + "|" + String(r?.program ?? "") + "|" + String(r?.part ?? ""))
  const rnd = prng(seed)

  const risk01 = clamp01(Number(r?.riskScore ?? 0) / 100)

  // conditions, tuned to correlate with risk
  const spatter01 = clamp01(0.18 + 0.75 * risk01 + (rnd() - 0.5) * 0.12)
  const meltPoolInstab01 = clamp01(0.20 + 0.65 * risk01 + (rnd() - 0.5) * 0.14)
  const recoaterInteract01 = clamp01(0.10 + 0.55 * risk01 + (rnd() - 0.5) * 0.20)
  const plumeOpacity01 = clamp01(0.12 + 0.60 * risk01 + (rnd() - 0.5) * 0.16)
  const gasFlowDeficit01 = clamp01(0.20 + 0.60 * risk01 + (rnd() - 0.5) * 0.14) // higher is worse

  // predicted outcomes
  const predictedCTPorosity = Math.max(0, Math.round(2 + 40 * risk01 + rnd() * 7))
  const tensileMargin01 = clamp01(0.92 - 0.42 * risk01 + (rnd() - 0.5) * 0.08) // higher better
  const fatigueRisk01 = clamp01(0.10 + 0.78 * risk01 + (rnd() - 0.5) * 0.12)

  const disposition =
    risk01 >= 0.72
      ? { label: "Hold for targeted NDT", detail: "Consistent high-risk signatures. Prevent quality escape." }
      : risk01 >= 0.42
      ? { label: "Proceed with enhanced inspection", detail: "Proceed, but increase sampling and review anomaly windows." }
      : { label: "Proceed", detail: "Within expected process envelope for this program and material." }

  const conditions = [
    {
      key: "Spatter",
      value01: spatter01,
      qualityEffect:
        "Higher spatter increases surface roughness, elevates lack-of-fusion probability, and can seed near-surface defects.",
    },
    {
      key: "Melt pool instability",
      value01: meltPoolInstab01,
      qualityEffect:
        "Instability increases porosity risk and microstructure variability, raising mechanical property scatter.",
    },
    {
      key: "Recoater interaction",
      value01: recoaterInteract01,
      qualityEffect:
        "Recoater contact or streaking can cause layer defects, geometric deviation, and downstream fusion issues.",
    },
    {
      key: "Plume opacity",
      value01: plumeOpacity01,
      qualityEffect:
        "Opacity drift indicates coupling changes that can shift energy density and drive porosity signatures.",
    },
    {
      key: "Gas flow deficit",
      value01: gasFlowDeficit01,
      qualityEffect:
        "Poor flow can recirculate spatter and soot, contaminating the melt pool and elevating defect probability.",
    },
  ].sort((a, b) => b.value01 - a.value01)

  return {
    risk01,
    conditions,
    predictedCTPorosity,
    tensileMargin01,
    fatigueRisk01,
    disposition,
  }
}

function riskColorClass(risk01: number) {
  // Loud palette
  if (risk01 >= 0.7) return "bg-red-600"
  if (risk01 >= 0.4) return "bg-amber-500"
  return "bg-emerald-500"
}

function riskText(risk01: number) {
  return Math.round(clamp01(risk01) * 100)
}

function summarizePlate(plateRuns: Run[]) {
  const total = plateRuns.length
  const risks = plateRuns.map(r => Number((r as any)?.riskScore ?? 0))
  const avg = total ? risks.reduce((a, b) => a + b, 0) / total : 0
  const max = total ? Math.max(...risks) : 0
  const fail = plateRuns.filter(r => riskToStatus(Number((r as any)?.riskScore ?? 0)) === "Fail").length
  const watch = plateRuns.filter(r => riskToStatus(Number((r as any)?.riskScore ?? 0)) === "Watch").length
  const pass = plateRuns.filter(r => riskToStatus(Number((r as any)?.riskScore ?? 0)) === "Pass").length
  return { total, avg: Math.round(avg), max: Math.round(max), fail, watch, pass }
}

type ChatMsg = { role: "user" | "assistant"; content: string }

function normalize(s: string) {
  return s.trim().toLowerCase()
}

function formatRunLine(r: any) {
  const id = String(r?.id ?? "")
  const program = String(r?.program ?? "")
  const part = String(r?.part ?? "")
  const material = String(r?.material ?? "")
  const risk = Number(r?.riskScore ?? 0)
  const st = riskToStatus(risk)
  return `${id} (${st}, risk ${risk}): ${program} • ${part} • ${material}`
}

export default function Page() {
  // buildplates
  const buildplates = useMemo(() => {
    const ids = new Set<string>()
    for (const r of runs as any[]) ids.add(assignBuildplateId(r))
    return Array.from(ids).sort()
  }, [])

  const [plateId, setPlateId] = useState<string>(buildplates[0] ?? "BP-1")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"risk_desc" | "risk_asc" | "id">("risk_desc")
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  // chat
  const [chatOpen, setChatOpen] = useState(true)
  const [chat, setChat] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Ask about this buildplate. Examples: “highest risk part”, “why is BP risky”, “list fails”, “summary”.",
    },
  ])
  const [chatInput, setChatInput] = useState("")
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const plateRunsAll = useMemo(() => {
    return (runs as any[]).filter(r => assignBuildplateId(r) === plateId) as Run[]
  }, [plateId])

  const plateRuns = useMemo(() => {
    const q = normalize(query)
    const base = plateRunsAll.filter(r => {
      if (!q) return true
      const hay = [
        (r as any)?.id,
        (r as any)?.program,
        (r as any)?.part,
        (r as any)?.material,
        (r as any)?.date,
      ]
        .map(x => String(x ?? ""))
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })

    const sorted = [...base].sort((a, b) => {
      const ra = Number((a as any)?.riskScore ?? 0)
      const rb = Number((b as any)?.riskScore ?? 0)
      if (sort === "risk_desc") return rb - ra
      if (sort === "risk_asc") return ra - rb
      const ia = String((a as any)?.id ?? "")
      const ib = String((b as any)?.id ?? "")
      return ia.localeCompare(ib)
    })

    return sorted
  }, [plateRunsAll, query, sort])

  const plateSummary = useMemo(() => summarizePlate(plateRunsAll), [plateRunsAll])

  const selectedRun = useMemo(() => {
    if (!selectedRunId) return null
    return plateRunsAll.find(r => String((r as any)?.id ?? "") === selectedRunId) ?? null
  }, [plateRunsAll, selectedRunId])

  const selectedSig = useMemo(() => {
    if (!selectedRun) return null
    return fakeSignalsForRun(selectedRun as any)
  }, [selectedRun])

  // heatmap grid
  const PLATE_MM = 300
  const TILE_MM = 30
  const GRID = Math.round(PLATE_MM / TILE_MM) // 10 x 10
  const tiles = useMemo(() => {
    // start with a base field and then “inject” risk around each part
    const base: number[] = new Array(GRID * GRID).fill(0).map((_, i) => {
      const seed = hashStr(plateId + "|tile|" + i)
      const rnd = prng(seed)
      return clamp01(0.12 + rnd() * 0.18)
    })

    const addInfluence = (cx: number, cy: number, amp01: number) => {
      for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
          const x = (gx + 0.5) * TILE_MM
          const y = (gy + 0.5) * TILE_MM
          const dx = x - cx
          const dy = y - cy
          const d2 = dx * dx + dy * dy
          const sigma2 = (42 * 42) // influence radius
          const bump = amp01 * Math.exp(-d2 / (2 * sigma2))
          base[gy * GRID + gx] = clamp01(base[gy * GRID + gx] + bump)
        }
      }
    }

    for (const r of plateRunsAll as any[]) {
      const pos = fakePartPlacement(r, PLATE_MM)
      const risk01 = clamp01(Number(r?.riskScore ?? 0) / 100)
      addInfluence(pos.x, pos.y, 0.55 * risk01)
    }

    return base
  }, [plateId, plateRunsAll])

  const chartStatus = useMemo(() => {
    return [
      { name: "Fail", value: plateSummary.fail },
      { name: "Watch", value: plateSummary.watch },
      { name: "Pass", value: plateSummary.pass },
    ]
  }, [plateSummary])

  const chartTopRisks = useMemo(() => {
    const top = [...plateRunsAll]
      .sort((a, b) => Number((b as any)?.riskScore ?? 0) - Number((a as any)?.riskScore ?? 0))
      .slice(0, 6)
      .map(r => ({
        id: String((r as any)?.id ?? ""),
        risk: Number((r as any)?.riskScore ?? 0),
      }))
      .reverse()
    return top
  }, [plateRunsAll])

  const selectedRunConditionsBar = useMemo(() => {
    if (!selectedSig) return []
    return selectedSig.conditions
      .slice(0, 5)
      .map(c => ({ name: c.key, value: Math.round(c.value01 * 100) }))
      .reverse()
  }, [selectedSig])

  function scrollChatToEnd() {
    requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }))
  }

  function answerChat(prompt: string) {
    const p = normalize(prompt)
    if (!plateRunsAll.length) return "No runs on this buildplate."

    const sorted = [...plateRunsAll].sort(
      (a, b) => Number((b as any)?.riskScore ?? 0) - Number((a as any)?.riskScore ?? 0)
    )
    const fails = plateRunsAll.filter(r => riskToStatus(Number((r as any)?.riskScore ?? 0)) === "Fail")

    if (p.includes("summary") || p === "help") {
      return `Plate ${plateId}: ${plateSummary.total} runs, avg risk ${plateSummary.avg}, max risk ${plateSummary.max}. Pass ${plateSummary.pass}, Watch ${plateSummary.watch}, Fail ${plateSummary.fail}.`
    }

    if (p.includes("highest") || p.includes("top risk") || p.includes("worst")) {
      const r = sorted[0] as any
      const sig = fakeSignalsForRun(r)
      const drivers = sig.conditions.slice(0, 2).map(d => d.key).join(", ")
      return `Highest risk: ${formatRunLine(r)}. Top drivers: ${drivers}. Recommended: ${sig.disposition.label}.`
    }

    if (p.includes("list") && (p.includes("fail") || p.includes("fails"))) {
      if (!fails.length) return "No Fail runs on this buildplate."
      return fails.slice(0, 10).map(r => `- ${formatRunLine(r as any)}`).join("\n")
    }

    if (p.includes("why") && (p.includes("risky") || p.includes("risk"))) {
      const top = sorted.slice(0, Math.min(4, sorted.length)).map(r => fakeSignalsForRun(r as any))
      // average top condition strengths across top risky runs
      const acc: Record<string, { sum: number; n: number }> = {}
      for (const s of top) {
        for (const c of s.conditions) {
          acc[c.key] = acc[c.key] ?? { sum: 0, n: 0 }
          acc[c.key].sum += c.value01
          acc[c.key].n += 1
        }
      }
      const ranked = Object.entries(acc)
        .map(([k, v]) => ({ k, avg: v.sum / Math.max(1, v.n) }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3)

      const line = ranked.map(x => `${x.k} (${asPct01(x.avg)})`).join(", ")
      return `This plate trends risky due to elevated conditions in the highest-risk runs: ${line}.`
    }

    // If they mention an ID, try to respond about that run
    const maybeId = plateRunsAll.find(r => normalize(String((r as any)?.id ?? "")) === p)
    if (maybeId) {
      const r = maybeId as any
      const sig = fakeSignalsForRun(r)
      const top = sig.conditions[0]
      return `${formatRunLine(r)}. Primary driver: ${top.key} (${asPct01(top.value01)}). Effect: ${top.qualityEffect}`
    }

    return `Try: “summary”, “highest risk part”, “list fails”, “why is BP risky”, or paste a run ID exactly.`
  }

  function onSendChat() {
    const text = chatInput.trim()
    if (!text) return
    setChat(prev => [...prev, { role: "user", content: text }])
    const reply = answerChat(text)
    setChat(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: reply }])
    setChatInput("")
    scrollChatToEnd()
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">
              Qualification Risk Dashboard <span className="text-red-500">LIVE</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              Simplified view: buildplate, parts, conditions, and quality impact. Signals are synthetic.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <select
              value={plateId}
              onChange={e => {
                setPlateId(e.target.value)
                setSelectedRunId(null)
              }}
              className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none transition focus:border-zinc-500"
            >
              {buildplates.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={e => setSort(e.target.value as any)}
              className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none transition focus:border-zinc-500"
            >
              <option value="risk_desc">Risk high</option>
              <option value="risk_asc">Risk low</option>
              <option value="id">Run ID</option>
            </select>

            <Button
              variant="secondary"
              onClick={() => {
                setQuery("")
                setSelectedRunId(null)
              }}
            >
              Reset
            </Button>
            <Button onClick={() => alert("Export queued (demo).")}>Export</Button>
          </div>
        </div>

        {/* KPI row (loud) */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-6">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-300">Runs on plate</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{plateSummary.total}</CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-300">Avg risk</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-amber-400">{plateSummary.avg}</CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-300">Max risk</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-red-500">{plateSummary.max}</CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-300">Fail</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-red-500">{plateSummary.fail}</CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-300">Watch</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-amber-400">{plateSummary.watch}</CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-300">Pass</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-emerald-400">{plateSummary.pass}</CardContent>
          </Card>
        </div>

        {/* Main: plate heatmap + charts + chat */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Buildplate heatmap */}
          <Card className="border-zinc-800 bg-zinc-900 lg:col-span-7">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-200">Buildplate heatmap (quality risk)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-300">
                  Tiles show inferred risk. Dots are parts (runs). Click a dot to inspect conditions.
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-3 w-3 rounded bg-emerald-500" /> Pass
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-3 w-3 rounded bg-amber-500" /> Watch
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-3 w-3 rounded bg-red-600" /> Fail
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="relative mx-auto w-[min(520px,100%)]">
                  {/* grid */}
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))`,
                      gap: 3,
                    }}
                  >
                    {tiles.map((t, i) => {
                      const c = riskColorClass(t)
                      return (
                        <div
                          key={i}
                          className={[
                            "aspect-square rounded",
                            c,
                            "opacity-90",
                            "ring-1 ring-black/20",
                          ].join(" ")}
                          title={`tile risk ${riskText(t)}`}
                        />
                      )
                    })}
                  </div>

                  {/* part markers */}
                  <div className="pointer-events-none absolute inset-0">
                    {(plateRunsAll as any[]).map(r => {
                      const id = String(r?.id ?? "")
                      const pos = fakePartPlacement(r, PLATE_MM)
                      const risk01 = clamp01(Number(r?.riskScore ?? 0) / 100)
                      const st = riskToStatus(Number(r?.riskScore ?? 0))
                      const color =
                        st === "Fail" ? "bg-red-500" : st === "Watch" ? "bg-amber-400" : "bg-emerald-400"

                      // map mm -> % within the grid container
                      const leftPct = (pos.x / PLATE_MM) * 100
                      const topPct = (pos.y / PLATE_MM) * 100
                      const isSel = selectedRunId === id

                      return (
                        <button
                          key={id}
                          type="button"
                          className={[
                            "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2",
                            "h-4 w-4 rounded-full",
                            color,
                            "ring-2 ring-zinc-950",
                            isSel ? "outline outline-2 outline-white" : "",
                          ].join(" ")}
                          style={{ left: `${leftPct}%`, top: `${topPct}%`, opacity: 0.9 }}
                          title={`${id} risk ${Math.round(risk01 * 100)}`}
                          onClick={() => setSelectedRunId(id)}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* parts on plate */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Parts on this buildplate</div>
                  <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Filter parts by ID, program, material..."
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                    />
                    <div className="mt-3 max-h-[220px] overflow-auto space-y-2 pr-1">
                      {plateRuns.map(r => {
                        const id = String((r as any)?.id ?? "")
                        const risk = Number((r as any)?.riskScore ?? 0)
                        const st = riskToStatus(risk)
                        const isSel = selectedRunId === id
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSelectedRunId(id)}
                            className={[
                              "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                              isSel
                                ? "border-white bg-zinc-900"
                                : "border-zinc-800 bg-zinc-950 hover:border-zinc-700",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 truncate font-semibold">{id}</div>
                              <div className="flex items-center gap-2">
                                <Badge variant={statusVariant(st) as any}>{st}</Badge>
                                <span className="tabular-nums text-zinc-200">{risk}</span>
                              </div>
                            </div>
                            <div className="mt-1 truncate text-xs text-zinc-400">
                              {(r as any)?.program} • {(r as any)?.part} • {(r as any)?.material}
                            </div>
                          </button>
                        )
                      })}
                      {plateRuns.length === 0 && (
                        <div className="text-sm text-zinc-400">No matches.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* selected run conditions */}
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Selected part: conditions and quality impact</div>
                  <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    {!selectedRun || !selectedSig ? (
                      <div className="text-sm text-zinc-400">Click a dot or pick a part from the list.</div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-base font-semibold">{String((selectedRun as any)?.id ?? "")}</div>
                            <div className="mt-1 text-xs text-zinc-400">
                              {(selectedRun as any)?.program} • {(selectedRun as any)?.part} • {(selectedRun as any)?.material} •{" "}
                              {String((selectedRun as any)?.date ?? "")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-zinc-400">Risk</div>
                            <div className="text-3xl font-semibold text-red-500 tabular-nums">
                              {Number((selectedRun as any)?.riskScore ?? 0)}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                          <div className="text-xs font-semibold text-zinc-200">Disposition</div>
                          <div className="mt-1 text-sm font-semibold text-zinc-50">{selectedSig.disposition.label}</div>
                          <div className="mt-1 text-sm text-zinc-300">{selectedSig.disposition.detail}</div>
                        </div>

                        {/* condition bar chart */}
                        <div className="h-[160px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={selectedRunConditionsBar} layout="vertical" margin={{ left: 8, right: 10 }}>
                              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#d4d4d8", fontSize: 12 }} />
                              <YAxis
                                type="category"
                                dataKey="name"
                                width={120}
                                tick={{ fill: "#d4d4d8", fontSize: 12 }}
                              />
                              <Tooltip />
                              <Bar dataKey="value">
                                {selectedRunConditionsBar.map((_, i) => (
                                  <Cell
                                    key={i}
                                    fill={i % 3 === 0 ? "#ef4444" : i % 3 === 1 ? "#f59e0b" : "#22c55e"}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* explicit condition explanations */}
                        <div className="space-y-2">
                          {selectedSig.conditions.slice(0, 3).map(c => (
                            <div key={c.key} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-zinc-50">{c.key}</div>
                                <div className="text-sm font-semibold text-zinc-50 tabular-nums">
                                  {asPct01(c.value01)}
                                </div>
                              </div>
                              <div className="mt-1 text-sm text-zinc-300">{c.qualityEffect}</div>
                            </div>
                          ))}
                        </div>

                        {/* predicted outcomes */}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                            <div className="text-xs text-zinc-300">CT porosity (est.)</div>
                            <div className="mt-1 text-xl font-semibold text-red-400 tabular-nums">
                              {selectedSig.predictedCTPorosity}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                            <div className="text-xs text-zinc-300">Tensile margin (est.)</div>
                            <div className="mt-1 text-xl font-semibold text-emerald-300 tabular-nums">
                              {asPct01(selectedSig.tensileMargin01)}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                            <div className="text-xs text-zinc-300">Fatigue risk (est.)</div>
                            <div className="mt-1 text-xl font-semibold text-amber-300 tabular-nums">
                              {asPct01(selectedSig.fatigueRisk01)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right column: charts + chat */}
          <div className="space-y-4 lg:col-span-5">
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-200">Plate status mix (pie)</CardTitle>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Pie data={chartStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                      <Cell fill="#ef4444" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#22c55e" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-200">Top risk parts (bar)</CardTitle>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartTopRisks} margin={{ left: 8, right: 10 }}>
                    <XAxis dataKey="id" tick={{ fill: "#d4d4d8", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#d4d4d8", fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="risk">
                      {chartTopRisks.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.risk >= 70 ? "#ef4444" : d.risk >= 40 ? "#f59e0b" : "#22c55e"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Chatbot wrapper */}
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm text-zinc-200">Ops Copilot (chat)</CardTitle>
                  <Button variant="secondary" onClick={() => setChatOpen(v => !v)}>
                    {chatOpen ? "Hide" : "Show"}
                  </Button>
                </div>
              </CardHeader>
              {chatOpen && (
                <CardContent className="space-y-3">
                  <div className="max-h-[240px] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="space-y-3 text-sm">
                      {chat.map((m, idx) => (
                        <div key={idx} className={m.role === "user" ? "text-right" : "text-left"}>
                          <div
                            className={[
                              "inline-block max-w-[92%] rounded-2xl px-3 py-2",
                              m.role === "user"
                                ? "bg-red-600 text-white"
                                : "bg-zinc-900 text-zinc-100 border border-zinc-800",
                            ].join(" ")}
                            style={{ whiteSpace: "pre-wrap" }}
                          >
                            {m.content}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") onSendChat()
                      }}
                      placeholder='Ask: "highest risk part", "summary", "list fails"...'
                      className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                    />
                    <Button onClick={onSendChat}>Send</Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setChat(prev => [...prev, { role: "user", content: "summary" }, { role: "assistant", content: answerChat("summary") }])
                        scrollChatToEnd()
                      }}
                    >
                      Summary
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setChat(prev => [...prev, { role: "user", content: "highest risk part" }, { role: "assistant", content: answerChat("highest risk part") }])
                        scrollChatToEnd()
                      }}
                    >
                      Highest risk
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setChat(prev => [...prev, { role: "user", content: "list fails" }, { role: "assistant", content: answerChat("list fails") }])
                        scrollChatToEnd()
                      }}
                    >
                      List fails
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}