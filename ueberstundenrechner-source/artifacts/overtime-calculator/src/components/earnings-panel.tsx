import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Euro } from "lucide-react";

interface Props { liveWorkMs: number; }

const EARNINGS_KEY = "overtime-calculator:earnings";

function loadEarnings() {
  try { return JSON.parse(localStorage.getItem(EARNINGS_KEY) ?? "{}") as { rate?: number; payday?: number }; }
  catch { return {}; }
}

function saveEarnings(data: { rate?: number; payday?: number }) {
  localStorage.setItem(EARNINGS_KEY, JSON.stringify(data));
}

export function EarningsPanel({ liveWorkMs }: Props) {
  const saved = loadEarnings();
  const [rate, setRate] = useState(saved.rate ?? 0);
  const [payday, setPayday] = useState(saved.payday ?? 25);

  const updateRate = (v: number) => { setRate(v); saveEarnings({ rate: v, payday }); };
  const updatePayday = (v: number) => { setPayday(v); saveEarnings({ rate, payday: v }); };

  const workHours = liveWorkMs / 3600000;
  const earned = rate > 0 ? workHours * rate : 0;

  const today = new Date().getDate();
  let paycheckPct = 0, paycheckLabel = "";
  if (payday > 0) {
    if (today >= payday) { paycheckPct = 100; paycheckLabel = "Zahltag erreicht!"; }
    else { paycheckPct = Math.round((today / payday) * 100); paycheckLabel = `noch ${payday - today} Tag${payday - today !== 1 ? "e" : ""}`; }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <Euro className="h-3.5 w-3.5 text-emerald-500" />
        </div>
        <p className="text-sm font-semibold text-foreground">Verdienst</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="hourly-rate" className="text-xs text-muted-foreground">Stundenlohn (€/h)</Label>
          <Input id="hourly-rate" type="number" min={0} step={0.5} value={rate || ""} placeholder="18.50"
            className="h-9 text-sm rounded-xl" onChange={e => updateRate(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payday" className="text-xs text-muted-foreground">Zahltag</Label>
          <Input id="payday" type="number" min={1} max={31} value={payday || ""} placeholder="25"
            className="h-9 text-sm rounded-xl" onChange={e => updatePayday(parseInt(e.target.value) || 0)} />
        </div>
      </div>

      {rate > 0 && (
        <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Geschätzt heute</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {earned.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{workHours.toFixed(2)} h × {rate.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €/h</p>
        </div>
      )}

      {payday > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Bis Zahltag ({payday}.)</span>
            <span className="font-medium text-foreground">{paycheckLabel}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div className={`h-full rounded-full transition-all ${paycheckPct >= 100 ? "bg-emerald-500" : "bg-primary"}`}
              style={{ width: `${paycheckPct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
