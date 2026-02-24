import { runs } from "@/lib/fakeData"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function statusVariant(s: string) {
  if (s === "Pass") return "secondary"
  if (s === "Watch") return "default"
  return "destructive"
}

export default function Page() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          Qualification Risk Dashboard
        </h1>
        <p className="mt-2 text-zinc-600">
          Demo only. All data is synthetic.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4">
          {runs.map(r => (
            <Card key={r.id} className="transition-shadow hover:shadow-sm">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold">{r.id}</div>
                    <Badge variant={statusVariant(r.status) as any}>
                      {r.status}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-zinc-600">
                    {r.program} • {r.part} • {r.material} • {r.date}
                  </div>
                </div>
                <div className="text-2xl font-semibold">
                  {r.riskScore}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}