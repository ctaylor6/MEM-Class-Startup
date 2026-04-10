"use client"

import React, { useMemo, useRef, useState } from "react"
import { runs } from "@/lib/fakeData"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type Run = (typeof runs)[number]
type Status = "Pass" | "Watch" | "Fail"
type TolBand = "In tolerance" | "Watch band" | "Out of tolerance"

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

type ToleranceDef = {
  low: number
  watch: number
  high: number
  direction: "max" | "min"
  unit: string
  adjust: string
}

const METRIC_TOLERANCES: Record<string, ToleranceDef> = {
  "Thermal gradient variance": {
    low: 0,
    watch: 0.45,
    high: 0.65,
    direction: "max",
    unit: "index",
    adjust: "reduce thermal concentration, review scan path and local energy input",
  },
  "Melt pool instability": {
    low: 0,
    watch: 0.40,
    high: 0.60,
    direction: "max",
    unit: "index",
    adjust: "stabilize melt pool by tuning power, speed, and hatch overlap",
  },
  "Spatter": {
    low: 0,
    watch: 0.38,
    high: 0.58,
    direction: "max",
    unit: "index",
    adjust: "check shielding flow and reduce excessive energy density",
  },
  "Recoater interaction": {
    low: 0,
    watch: 0.30,
    high: 0.50,
    direction: "max",
    unit: "index",
    adjust: "inspect powder uniformity and recoater clearance before next pass",
  },
  "Gas flow deficit": {
    low: 0,
    watch: 0.35,
    high: 0.55,
    direction: "max",
    unit: "index",
    adjust: "inspect gas flow path, filter condition, and chamber recirculation",
  },
  "Plume opacity": {
    low: 0,
    watch: 0.40,
    high: 0.60,
    direction: "max",
    unit: "index",
    adjust: "review plume extraction and confirm optical path stability",
  },
  "Predicted CT porosity": {
    low: 0,
    watch: 12,
    high: 22,
    direction: "max",
    unit: "count",
    adjust: "route part for targeted NDT and reduce defect-driving thermal instability",
  },
  "Tensile margin": {
    low: 0.82,
    watch: 0.74,
    high: 0,
    direction: "min",
    unit: "ratio",
    adjust: "increase process stability before release and review high-risk windows",
  },
  "Fatigue risk": {
    low: 0,
    watch: 0.42,
    high: 0.62,
    direction: "max",
    unit: "index",
    adjust: "inspect hotspot regions and reduce pore-driving instability before next build",
  },
}

function toleranceBand(metricName: string, value: number): TolBand {
  const t = METRIC_TOLERANCES[metricName]
  if (!t) {
    if (value >= 0.7) return "Out of tolerance"
    if (value >= 0.4) return "Watch band"
    return "In tolerance"
  }

  if (t.direction === "max") {
    if (value >= t.high) return "Out of tolerance"
    if (value >= t.watch) return "Watch band"
    return "In tolerance"
  }

  if (value <= t.watch) return "Out of tolerance"
  if (value <= t.low) return "Watch band"
  return "In tolerance"
}

function bandColor(b: TolBand) {
  if (b === "Out of tolerance") return "#ef4444"
  if (b === "Watch band") return "#f59e0b"
  return "#22c55e"
}

function formatTolerance(metricName: string) {
  const t = METRIC_TOLERANCES[metricName]
  if (!t) return "In tolerance < 40%, Watch 40 to 69%, Out ≥ 70%"

  if (t.direction === "max") {
    return `In tolerance < ${Math.round(t.watch * 100)}%, Watch ${Math.round(t.watch * 100)} to ${Math.round(
      t.high * 100
    ) - 1}%, Out ≥ ${Math.round(t.high * 100)}%`
  }

  return `In tolerance > ${Math.round(t.low * 100)}%, Watch ${Math.round(t.watch * 100)} to ${Math.round(
    t.low * 100
  )}%, Out ≤ ${Math.round(t.watch * 100)}%`
}

function metricAdjustment(metricName: string) {
  return METRIC_TOLERANCES[metricName]?.adjust ?? "review process settings and inspect flagged regions"
}

function fakeSignalsForRun(r: any) {
  const id = String(r?.id ?? "")
  const seed = hashStr("sig|" + id + "|" + String(r?.program ?? "") + "|" + String(r?.part ?? ""))
  const rnd = prng(seed)

  const risk01 = clamp01(Number(r?.riskScore ?? 0) / 100)

  const spatter01 = clamp01(0.18 + 0.75 * risk01 + (rnd() - 0.5) * 0.12)
  const meltPoolInstab01 = clamp01(0.20 + 0.65 * risk01 + (rnd() - 0.5) * 0.14)
  const recoaterInteract01 = clamp01(0.10 + 0.55 * risk01 + (rnd() - 0.5) * 0.20)
  const plumeOpacity01 = clamp01(0.12 + 0.60 * risk01 + (rnd() - 0.5) * 0.16)
  const gasFlowDeficit01 = clamp01(0.20 + 0.60 * risk01 + (rnd() - 0.5) * 0.14)

  const predictedCTPorosity = Math.max(0, Math.round(2 + 40 * risk01 + rnd() * 7))
  const tensileMargin01 = clamp01(0.92 - 0.42 * risk01 + (rnd() - 0.5) * 0.08)
  const fatigueRisk01 = clamp01(0.10 + 0.78 * risk01 + (rnd() - 0.5) * 0.12)

  const disposition =
    risk01 >= 0.72
      ? { label: "Hold for targeted NDT", detail: "High-risk signatures. Prevent quality escape." }
      : risk01 >= 0.42
      ? { label: "Proceed with enhanced inspection", detail: "Proceed, but increase sampling and review anomaly windows." }
      : { label: "Proceed", detail: "Within expected process envelope for this program and material." }

  const conditions = [
    {
      key: "Thermal gradient variance",
      value01: clamp01(0.12 + 0.78 * risk01 + (rnd() - 0.5) * 0.10),
      qualityEffect:
        "Large gradients raise residual stress and can drive distortion and crack initiation at thin features and edges.",
    },
    {
      key: "Melt pool instability",
      value01: meltPoolInstab01,
      qualityEffect:
        "Instability increases porosity risk and microstructure variability, raising mechanical property scatter.",
    },
    {
      key: "Spatter",
      value01: spatter01,
      qualityEffect:
        "Higher spatter increases roughness and can seed lack-of-fusion near edges and overhangs.",
    },
    {
      key: "Recoater interaction",
      value01: recoaterInteract01,
      qualityEffect:
        "Recoater contact or streaking can cause layer defects, geometric deviation, and downstream fusion issues.",
    },
    {
      key: "Gas flow deficit",
      value01: gasFlowDeficit01,
      qualityEffect:
        "Poor flow can recirculate spatter and soot, changing coupling and elevating defect probability.",
    },
    {
      key: "Plume opacity",
      value01: plumeOpacity01,
      qualityEffect:
        "Opacity drift indicates coupling changes that shift energy density and drive porosity signatures.",
    },
  ]
    .map(c => ({
      ...c,
      band: toleranceBand(c.key, c.value01),
      toleranceText: formatTolerance(c.key),
      adjust: metricAdjustment(c.key),
    }))
    .sort((a, b) => b.value01 - a.value01)

  const layer = 10 + Math.floor(risk01 * 70 + rnd() * 6)
  const region = risk01 > 0.55 ? "Blade edge" : "Mid-span"
  const lot = `lot #${String(id).slice(-2) || "45"}B`

  const summaryMetrics = [
    {
      key: "Predicted CT porosity",
      display: String(predictedCTPorosity),
      rawValue: predictedCTPorosity,
      band: toleranceBand("Predicted CT porosity", predictedCTPorosity),
      toleranceText: "In tolerance < 12, Watch 12 to 21, Out ≥ 22",
      adjust: metricAdjustment("Predicted CT porosity"),
    },
    {
      key: "Tensile margin",
      display: asPct01(tensileMargin01),
      rawValue: tensileMargin01,
      band: toleranceBand("Tensile margin", tensileMargin01),
      toleranceText: "In tolerance > 82%, Watch 74 to 82%, Out ≤ 74%",
      adjust: metricAdjustment("Tensile margin"),
    },
    {
      key: "Fatigue risk",
      display: asPct01(fatigueRisk01),
      rawValue: fatigueRisk01,
      band: toleranceBand("Fatigue risk", fatigueRisk01),
      toleranceText: "In tolerance < 42%, Watch 42 to 61%, Out ≥ 62%",
      adjust: metricAdjustment("Fatigue risk"),
    },
  ]

  return {
    risk01,
    conditions,
    predictedCTPorosity,
    tensileMargin01,
    fatigueRisk01,
    disposition,
    layer,
    region,
    lot,
    summaryMetrics,
  }
}

function riskFill(risk01: number) {
  if (risk01 >= 0.7) return "#ef4444"
  if (risk01 >= 0.4) return "#f59e0b"
  return "#22c55e"
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

function makeTensileCurve(risk01: number, seedKey: string) {
  const seed = hashStr("tens|" + seedKey)
  const rnd = prng(seed)

  const mean = 15.5 - 5.0 * risk01 + (rnd() - 0.5) * 0.6
  const sigma = 2.6 + 1.2 * risk01 + (rnd() - 0.5) * 0.3
  const spec = 20.5

  const xs: number[] = []
  for (let x = 0; x <= 28; x += 0.5) xs.push(Number(x.toFixed(1)))

  const ys = xs.map(x => Math.exp(-((x - mean) * (x - mean)) / (2 * sigma * sigma)))
  const maxy = Math.max(...ys, 1e-9)

  const data = xs.map((x, i) => ({
    x,
    yPct: (ys[i] / maxy) * 100,
    spec: spec,
  }))

  return { data, spec }
}

function buildFakeEmailSummary(plateId: string, plateRunsAll: Run[]) {
  const highRisk = [...plateRunsAll]
    .filter(r => Number((r as any)?.riskScore ?? 0) >= 70)
    .sort((a, b) => Number((b as any)?.riskScore ?? 0) - Number((a as any)?.riskScore ?? 0))
    .slice(0, 8)

  if (!highRisk.length) {
    return {
      subject: `Shift Summary | ${plateId} | No high-risk runs`,
      body: `Operator,\n\nNo high-risk runs are currently flagged on ${plateId}.\n\nRecommended action: continue standard process monitoring.\n`,
    }
  }

  const lines = highRisk.map(r => {
    const sig = fakeSignalsForRun(r as any)
    const top = sig.conditions[0]
    return `• ${String((r as any)?.id ?? "")}: risk ${Number((r as any)?.riskScore ?? 0)}, ${top.key} ${asPct01(
      top.value01
    )}, action: ${top.adjust}.`
  })

  return {
    subject: `Shift Summary | ${plateId} | High-risk runs`,
    body:
      `Operator,\n\n` +
      `Below is the current list of high-risk runs before shift change for ${plateId}.\n\n` +
      `${lines.join("\n")}\n\n` +
      `Recommended action: review flagged runs first, inspect hotspot regions, and hold any run that remains out of tolerance.\n`,
  }
}

export default function Page() {
  const buildplates = useMemo(() => {
    const ids = new Set<string>()
    for (const r of runs as any[]) ids.add(assignBuildplateId(r))
    return Array.from(ids).sort()
  }, [])

  const [plateId, setPlateId] = useState<string>(buildplates[0] ?? "BP-1")
  const [sort, setSort] = useState<"risk_desc" | "risk_asc" | "id">("risk_desc")
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [emailQueued, setEmailQueued] = useState(false)

  const [chat, setChat] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "I can summarize risk, identify top drivers, explain tolerance status, and suggest immediate actions. Try: “highest risk part”, “why risky”, “out of tolerance”, “list fails”, “actions”.",
    },
  ])
  const [chatInput, setChatInput] = useState("")
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const plateRunsAll = useMemo(() => {
    return (runs as any[]).filter(r => assignBuildplateId(r) === plateId) as Run[]
  }, [plateId])

  const plateRuns = useMemo(() => {
    const base = [...plateRunsAll]
    const sorted = base.sort((a, b) => {
      const ra = Number((a as any)?.riskScore ?? 0)
      const rb = Number((b as any)?.riskScore ?? 0)
      if (sort === "risk_desc") return rb - ra
      if (sort === "risk_asc") return ra - rb
      const ia = String((a as any)?.id ?? "")
      const ib = String((b as any)?.id ?? "")
      return ia.localeCompare(ib)
    })
    return sorted
  }, [plateRunsAll, sort])

  const plateSummary = useMemo(() => summarizePlate(plateRunsAll), [plateRunsAll])

  const selectedRun = useMemo(() => {
    if (!selectedRunId) return null
    return plateRunsAll.find(r => String((r as any)?.id ?? "") === selectedRunId) ?? null
  }, [plateRunsAll, selectedRunId])

  const selectedSig = useMemo(() => {
    if (!selectedRun) return null
    return fakeSignalsForRun(selectedRun as any)
  }, [selectedRun])

  const emailSummary = useMemo(() => buildFakeEmailSummary(plateId, plateRunsAll), [plateId, plateRunsAll])

  const PLATE_MM = 300
  const TILE_MM = 30
  const GRID = Math.round(PLATE_MM / TILE_MM)

  const tiles = useMemo(() => {
    const base: number[] = new Array(GRID * GRID).fill(0).map((_, i) => {
      const seed = hashStr(plateId + "|tile|" + i)
      const rnd = prng(seed)
      return clamp01(0.10 + rnd() * 0.16)
    })

    const addInfluence = (cx: number, cy: number, amp01: number) => {
      for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
          const x = (gx + 0.5) * TILE_MM
          const y = (gy + 0.5) * TILE_MM
          const dx = x - cx
          const dy = y - cy
          const d2 = dx * dx + dy * dy
          const sigma2 = 42 * 42
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
  }, [plateId, plateRunsAll, GRID])

  const selectedRunConditionsBar = useMemo(() => {
    if (!selectedSig) return []
    return selectedSig.conditions
      .slice(0, 5)
      .map(c => ({ name: c.key, value: Math.round(c.value01 * 100) }))
      .reverse()
  }, [selectedSig])

  const tensile = useMemo(() => {
    const risk01 = selectedSig?.risk01 ?? clamp01(plateSummary.avg / 100)
    const key = selectedRunId ?? plateId
    return makeTensileCurve(risk01, key)
  }, [selectedSig, plateSummary.avg, selectedRunId, plateId])

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
      return `Plate ${plateId}: ${plateSummary.total} runs. Avg risk ${plateSummary.avg}, max risk ${plateSummary.max}. Pass ${plateSummary.pass}, Watch ${plateSummary.watch}, Fail ${plateSummary.fail}.`
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
      const topRuns = sorted.slice(0, Math.min(4, sorted.length)).map(r => fakeSignalsForRun(r as any))
      const acc: Record<string, { sum: number; n: number }> = {}
      for (const s of topRuns) {
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
      return `This plate trends risky due to elevated signals in the highest-risk runs: ${line}.`
    }

    if (p.includes("out of tolerance") || p.includes("tolerance")) {
      if (!selectedRun) {
        return "Select a part first. I will then show which metrics are in tolerance, in the watch band, or out of tolerance, along with suggested adjustments."
      }
      const out = selectedSig?.conditions.filter(c => c.band === "Out of tolerance") ?? []
      const watch = selectedSig?.conditions.filter(c => c.band === "Watch band") ?? []
      if (!out.length && !watch.length) {
        return "Selected part is currently within tolerance on the primary driver metrics. Continue standard monitoring."
      }
      const outTxt = out.slice(0, 2).map(c => `${c.key} is out of tolerance, adjust: ${c.adjust}`).join("; ")
      const watchTxt = watch.slice(0, 2).map(c => `${c.key} is in watch band`).join("; ")
      return [outTxt, watchTxt].filter(Boolean).join(" ")
    }

    if (p.includes("action") || p.includes("immediate") || p.includes("what should")) {
      const r = sorted[0] as any
      const sig = fakeSignalsForRun(r)
      const top = sig.conditions[0]
      return `Immediate actions: place lot on Hold, inspect ${sig.region} around layer ${sig.layer}, confirm sensor calibration, and adjust ${top.key.toLowerCase()} driver by: ${top.adjust}.`
    }

    if (p.includes("email")) {
      return `Prepared operator summary.\nSubject: ${emailSummary.subject}\n\n${emailSummary.body}`
    }

    const exact = plateRunsAll.find(r => normalize(String((r as any)?.id ?? "")) === p)
    if (exact) {
      const r = exact as any
      const sig = fakeSignalsForRun(r)
      const top = sig.conditions[0]
      return `${formatRunLine(r)}. Primary driver: ${top.key} (${asPct01(top.value01)}). ${top.band}. ${top.toleranceText}. Effect: ${top.qualityEffect} Adjust: ${top.adjust}.`
    }

    return `Try: “summary”, “highest risk part”, “list fails”, “why risky”, “out of tolerance”, “email summary”, “actions”, or paste a run ID exactly.`
  }

  function sendChat(text: string) {
    const t = text.trim()
    if (!t) return
    const reply = answerChat(t)
    setChat(prev => [...prev, { role: "user", content: t }, { role: "assistant", content: reply }])
    setChatInput("")
    scrollChatToEnd()
  }

  function onSelectRun(id: string) {
    setSelectedRunId(id)
    const r = plateRunsAll.find(x => String((x as any)?.id ?? "") === id) as any
    if (!r) return
    const sig = fakeSignalsForRun(r)
    const top = sig.conditions[0]
    const msg = `${top.key} elevated in ${sig.region}, layer ${sig.layer}. Risk ${Math.round(
      sig.risk01 * 100
    )}. ${top.band}. ${top.toleranceText}. Adjust: ${top.adjust}.`
    setChat(prev => [...prev, { role: "assistant", content: msg }])
    scrollChatToEnd()
  }

  const selectedRisk = Number((selectedRun as any)?.riskScore ?? plateSummary.avg)
  const selectedRisk01 = clamp01(selectedRisk / 100)
  const selectedStatus = riskToStatus(selectedRisk)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Qualification Risk Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Interactive buildplate view + context-aware guidance (synthetic signals; swap in your model outputs).
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <select
              value={plateId}
              onChange={e => {
                setPlateId(e.target.value)
                setSelectedRunId(null)
                setEmailQueued(false)
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
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
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
            >
              <option value="risk_desc">Risk high</option>
              <option value="risk_asc">Risk low</option>
              <option value="id">Run ID</option>
            </select>

            <Button
              variant="secondary"
              onClick={() => {
                setSelectedRunId(null)
              }}
            >
              Reset selection
            </Button>
            <Button onClick={() => alert("Export queued (demo).")}>Export</Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <Card className="border-slate-200 bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Qualification Risk Dashboard</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                  <div className="sm:col-span-7">
                    <div className="text-sm font-semibold text-slate-800">Buildplate view</div>
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="relative mx-auto w-[min(520px,100%)]">
                        <div
                          className="grid"
                          style={{
                            gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))`,
                            gap: 3,
                          }}
                        >
                          {tiles.map((t, i) => (
                            <div
                              key={i}
                              className="aspect-square rounded ring-1 ring-black/5"
                              style={{ backgroundColor: riskFill(t), opacity: 0.22 + 0.55 * t }}
                              title={`tile risk ${Math.round(t * 100)}`}
                            />
                          ))}
                        </div>

                        <div className="pointer-events-none absolute inset-0">
                          {(plateRunsAll as any[]).map(r => {
                            const id = String(r?.id ?? "")
                            const pos = fakePartPlacement(r, PLATE_MM)
                            const risk = Number(r?.riskScore ?? 0)
                            const st = riskToStatus(risk)
                            const fill =
                              st === "Fail" ? "#ef4444" : st === "Watch" ? "#f59e0b" : "#22c55e"

                            const leftPct = (pos.x / PLATE_MM) * 100
                            const topPct = (pos.y / PLATE_MM) * 100
                            const isSel = selectedRunId === id

                            return (
                              <button
                                key={id}
                                type="button"
                                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                                style={{
                                  left: `${leftPct}%`,
                                  top: `${topPct}%`,
                                  width: 14,
                                  height: 14,
                                  background: fill,
                                  opacity: 0.95,
                                  boxShadow: "0 0 0 2px rgba(255,255,255,0.95), 0 0 0 3px rgba(15,23,42,0.10)",
                                  outline: isSel ? "3px solid rgba(59,130,246,0.65)" : "none",
                                  outlineOffset: 2,
                                }}
                                title={`${id} • ${st} • risk ${risk}`}
                                onClick={() => onSelectRun(id)}
                              />
                            )
                          })}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                        <div>Click a dot to inspect part-level drivers.</div>
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-3 w-3 rounded" style={{ background: "#22c55e" }} /> Pass
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-3 w-3 rounded" style={{ background: "#f59e0b" }} /> Watch
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-3 w-3 rounded" style={{ background: "#ef4444" }} /> Fail
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-5">
                    <div className="text-sm font-semibold text-slate-800">Risk score</div>
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500">Selected</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {selectedRun ? String((selectedRun as any)?.id ?? "") : "No part selected"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {selectedRun
                              ? `${String((selectedRun as any)?.program ?? "")} • ${String(
                                  (selectedRun as any)?.material ?? ""
                                )}`
                              : `Plate ${plateId} overview`}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-slate-500">Status</div>
                          <div className="mt-1">
                            <Badge variant={statusVariant(selectedStatus) as any}>{selectedStatus}</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-baseline justify-between">
                          <div className="text-sm text-slate-700">Risk Score</div>
                          <div className="text-lg font-semibold tabular-nums text-slate-900">
                            {Math.round(selectedRisk01 * 100)}/100
                          </div>
                        </div>

                        <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${Math.round(selectedRisk01 * 100)}%`,
                              background: riskFill(selectedRisk01),
                            }}
                          />
                        </div>
                        <div className="mt-2 text-xs text-slate-600">
                          Risk thresholds: Pass &lt; 40, Watch 40 to 69, Fail ≥ 70
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
                        {!selectedSig ? (
                          <div className="text-slate-600">
                            Select a part to populate anomaly details and recommended actions.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-slate-700">Details</div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                              <div className="rounded-xl bg-slate-50 p-2">
                                <div className="text-slate-500">Lot</div>
                                <div className="font-semibold text-slate-800">{selectedSig.lot}</div>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-2">
                                <div className="text-slate-500">Region</div>
                                <div className="font-semibold text-slate-800">{selectedSig.region}</div>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-2">
                                <div className="text-slate-500">Layer</div>
                                <div className="font-semibold text-slate-800">{selectedSig.layer}</div>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-2">
                                <div className="text-slate-500">Top anomaly</div>
                                <div className="font-semibold text-slate-800">{selectedSig.conditions[0]?.key}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              {selectedSig.summaryMetrics.map(m => (
                                <div key={m.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs font-semibold text-slate-700">{m.key}</div>
                                    <div className="text-sm font-semibold text-slate-900">{m.display}</div>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-xs">
                                    <span
                                      className="inline-block h-2.5 w-2.5 rounded-full"
                                      style={{ background: bandColor(m.band) }}
                                    />
                                    <span className="font-semibold text-slate-800">{m.band}</span>
                                  </div>
                                  <div className="mt-1 text-xs text-slate-600">{m.toleranceText}</div>
                                  <div className="mt-1 text-xs text-slate-600">Adjust: {m.adjust}</div>
                                </div>
                              ))}
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs font-semibold text-slate-700">Disposition</div>
                              <div className="mt-1 text-sm font-semibold text-slate-900">
                                {selectedSig.disposition.label}
                              </div>
                              <div className="mt-1 text-sm text-slate-600">
                                {selectedSig.disposition.detail}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => sendChat("actions")}
                          className="rounded-xl"
                        >
                          What immediate actions?
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => sendChat("out of tolerance")}
                          className="rounded-xl"
                        >
                          Out of tolerance?
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => sendChat("highest risk part")}
                          className="rounded-xl"
                        >
                          Highest risk
                        </Button>
                        <Button
                          onClick={() => alert("Execute AI recommendations (demo).")}
                          className="rounded-xl"
                        >
                          Execute AI Actions
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-800">Tensile Strength Probability</div>
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="h-[210px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={tensile.data} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                          <XAxis dataKey="x" tick={{ fill: "#475569", fontSize: 12 }} />
                          <YAxis tick={{ fill: "#475569", fontSize: 12 }} domain={[0, 105]} />
                          <Tooltip />
                          <Area type="monotone" dataKey="yPct" stroke="#2563eb" fill="#60a5fa" fillOpacity={0.25} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="relative -mt-2 h-0">
                      <div
                        className="absolute top-[-208px] h-[190px] border-l-2 border-dashed border-slate-300"
                        style={{
                          left: `${(tensile.spec / 28) * 100}%`,
                        }}
                        title="Spec threshold"
                      />
                    </div>

                    <div className="mt-2 text-xs text-slate-600">
                      Dashed line shows a nominal spec threshold (demo).
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Primary drivers</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <div className="sm:col-span-7">
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={selectedRunConditionsBar} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#475569", fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={160} tick={{ fill: "#475569", fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value">
                          {selectedRunConditionsBar.map((d, i) => (
                            <Cell
                              key={i}
                              fill={
                                d.value >= 70 ? "#ef4444" : d.value >= 40 ? "#f59e0b" : "#22c55e"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="sm:col-span-5">
                  {!selectedSig ? (
                    <div className="text-sm text-slate-600">Select a part to see driver explanations.</div>
                  ) : (
                    <div className="space-y-2">
                      {selectedSig.conditions.slice(0, 2).map(c => (
                        <div key={c.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">{c.key}</div>
                            <div className="text-sm font-semibold tabular-nums text-slate-900">{asPct01(c.value01)}</div>
                          </div>
                          <div className="mt-1 text-xs font-semibold" style={{ color: bandColor(c.band) }}>
                            {c.band}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">{c.toleranceText}</div>
                          <div className="mt-1 text-sm text-slate-600">{c.qualityEffect}</div>
                          <div className="mt-1 text-sm text-slate-700">Adjust: {c.adjust}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">AI Context-Aware Guidance</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  {selectedSig ? (
                    <>
                      <div className="font-semibold text-slate-900">Anomaly Detected</div>
                      <div className="mt-1">
                        {selectedSig.conditions[0]?.key} in {selectedSig.region}, layer {selectedSig.layer}. Risk{" "}
                        {Math.round(selectedSig.risk01 * 100)} indicates{" "}
                        {selectedSig.risk01 >= 0.7 ? "critical issue" : selectedSig.risk01 >= 0.4 ? "elevated risk" : "low risk"}.
                      </div>
                      <div className="mt-2 text-xs text-slate-600">
                        {selectedSig.conditions[0]?.band}. {selectedSig.conditions[0]?.toleranceText}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Adjust: {selectedSig.conditions[0]?.adjust}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold text-slate-900">Select a part to start</div>
                      <div className="mt-1">Click a buildplate dot to populate anomaly context and recommendations.</div>
                    </>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white">
                  <div className="max-h-[340px] overflow-auto p-3">
                    <div className="space-y-3 text-sm">
                      {chat.map((m, idx) => (
                        <div key={idx} className={m.role === "user" ? "text-right" : "text-left"}>
                          <div
                            className={[
                              "inline-block max-w-[92%] rounded-2xl px-3 py-2",
                              m.role === "user"
                                ? "bg-blue-600 text-white"
                                : "bg-slate-50 text-slate-800 border border-slate-200",
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

                  <div className="border-t border-slate-200 p-3">
                    <div className="flex gap-2">
                      <input
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") sendChat(chatInput)
                        }}
                        placeholder='Ask: "actions", "summary", "email summary"...'
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      />
                      <Button onClick={() => sendChat(chatInput)} className="rounded-xl">
                        Send
                      </Button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => sendChat("summary")} className="rounded-xl">
                        Summary
                      </Button>
                      <Button variant="secondary" onClick={() => sendChat("highest risk part")} className="rounded-xl">
                        Highest risk
                      </Button>
                      <Button variant="secondary" onClick={() => sendChat("list fails")} className="rounded-xl">
                        List fails
                      </Button>
                      <Button variant="secondary" onClick={() => sendChat("out of tolerance")} className="rounded-xl">
                        Out of tolerance
                      </Button>
                      <Button variant="secondary" onClick={() => sendChat("email summary")} className="rounded-xl">
                        Email summary
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Operator email summary</div>
                      <div className="mt-1 text-xs text-slate-600">
                        Fake shift-change email listing current high-risk runs and suggested actions.
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() => setEmailQueued(true)}
                    >
                      Send email summary
                    </Button>
                  </div>
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">Subject</div>
                    <div className="mt-1">{emailSummary.subject}</div>
                    <div className="mt-3 font-semibold text-slate-900">Body</div>
                    <div className="mt-1 whitespace-pre-wrap">{emailSummary.body}</div>
                  </div>
                  {emailQueued && (
                    <div className="mt-2 text-xs font-semibold text-emerald-700">
                      Email queued to operator inbox (demo).
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Avg risk</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{plateSummary.avg}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Max risk</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{plateSummary.max}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Fails</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{plateSummary.fail}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold text-slate-800">Parts (sorted)</div>
                  <div className="mt-2 max-h-[220px] overflow-auto space-y-2 pr-1">
                    {plateRuns.slice(0, 12).map(r => {
                      const id = String((r as any)?.id ?? "")
                      const risk = Number((r as any)?.riskScore ?? 0)
                      const st = riskToStatus(risk)
                      const isSel = selectedRunId === id
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onSelectRun(id)}
                          className={[
                            "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                            isSel ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 truncate font-semibold text-slate-900">{id}</div>
                            <div className="flex items-center gap-2">
                              <Badge variant={statusVariant(st) as any}>{st}</Badge>
                              <span className="tabular-nums text-slate-700">{risk}</span>
                            </div>
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-500">
                            {(r as any)?.program} • {(r as any)?.part} • {(r as any)?.material}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}