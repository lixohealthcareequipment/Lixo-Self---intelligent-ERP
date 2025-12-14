type DecisionPacket = any;

export type DecisionOutput = {
  decision: "increase_budget" | "decrease_budget" | "increase_bid" | "decrease_bid" | "pause_entity" | "no_change";
  change_pct: number;
  confidence: number;
  requires_approval: boolean;
  reasoning: string[];
  risk_flags: string[];
  notes: string;
  raw?: string;
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function safeFallback(flags: string[], reasoning?: string[]): DecisionOutput {
  return {
    decision: "no_change",
    change_pct: 0,
    confidence: 0,
    requires_approval: true,
    reasoning: reasoning?.length ? reasoning : ["Fallback safe mode"],
    risk_flags: flags,
    notes: ""
  };
}

function validateAndClamp(out: any, allowedActions: string[], maxBudgetChangePct: number): DecisionOutput {
  const base = safeFallback(["invalid_ai_output"]);
  if (!out || typeof out !== "object") return base;
  if (!allowedActions.includes(out.decision)) return base;
  const decision = String(out.decision);
  let change = Number(out.change_pct ?? 0);
  if (!Number.isFinite(change)) return base;
  if (!["increase_budget", "decrease_budget", "no_change"].includes(decision)) {
    return safeFallback(["disallowed_action_budget_only"], ["Budget-only MVP: bid/pause not permitted"]);
  }
  if (decision === "no_change") change = 0;
  change = Math.max(0, Math.min(Math.abs(change), maxBudgetChangePct));
  return {
    decision: decision as DecisionOutput["decision"],
    change_pct: change,
    confidence: Number(out.confidence ?? 0),
    requires_approval: true,
    reasoning: Array.isArray(out.reasoning) ? out.reasoning.map(String).slice(0, 10) : ["no_reasoning"],
    risk_flags: Array.isArray(out.risk_flags) ? out.risk_flags.map(String).slice(0, 10) : [],
    notes: typeof out.notes === "string" ? out.notes.slice(0, 500) : ""
  };
}

export async function callDecisionModel(packet: DecisionPacket): Promise<DecisionOutput> {
  const apiKey = mustEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_MODEL || "gpt-4-mini";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Return ONLY valid JSON with keys: decision, change_pct, confidence, requires_approval, reasoning (array), risk_flags (array), notes" },
          { role: "user", content: JSON.stringify(packet) }
        ],
        temperature: 0.2
      })
    });
    const text = await res.text();
    if (!res.ok) return { ...safeFallback(["openai_http_error"]), raw: text };
    let parsed: any;
    try { parsed = JSON.parse(text); }
    catch { return { ...safeFallback(["openai_bad_json_response"]), raw: text }; }
    const outputText = parsed?.choices?.[0]?.message?.content ?? null;
    if (!outputText) return { ...safeFallback(["openai_missing_output_text"]), raw: text };
    let obj: any;
    try { obj = JSON.parse(outputText); }
    catch { return { ...safeFallback(["openai_output_not_json"]), raw: outputText }; }
    const maxBudget = Number(packet?.constraints?.max_budget_change_pct ?? 15);
    const allowed = Array.isArray(packet?.allowed_actions) ? packet.allowed_actions : ["no_change"];
    return { ...validateAndClamp(obj, allowed, maxBudget), raw: outputText };
  } catch (e: any) {
    return safeFallback(["openai_exception"], [String(e?.message || e)]);
  }
}
