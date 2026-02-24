export type Run = {
  id: string
  program: string
  part: string
  material: string
  process: string
  date: string
  status: "Pass" | "Watch" | "Fail"
  riskScore: number
}

export const runs: Run[] = [
  { id: "RUN-0142", program: "Aerospace Part Demo", part: "Bracket A", material: "Ti-6Al-4V", process: "LPBF", date: "2026-02-20", status: "Watch", riskScore: 71 },
  { id: "RUN-0143", program: "Aerospace Part Demo", part: "Manifold B", material: "Inconel 718", process: "LPBF", date: "2026-02-21", status: "Pass", riskScore: 28 },
  { id: "RUN-0144", program: "Aerospace Part Demo", part: "Housing C", material: "17-4 PH", process: "LPBF", date: "2026-02-22", status: "Fail", riskScore: 89 },
]