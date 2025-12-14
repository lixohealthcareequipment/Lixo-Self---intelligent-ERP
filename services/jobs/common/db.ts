import pRetry from "p-retry";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

export class SupabaseRest {
  constructor(private cfg: SupabaseConfig) {}

  private headers(extra?: Record<string, string>) {
    return {
      apikey: this.cfg.serviceRoleKey,
      Authorization: `Bearer ${this.cfg.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(extra || {}),
    };
  }

  async upsert(table: string, rows: any[], chunkSize = 1000): Promise<void> {
    if (!rows.length) return;

    const url = `${this.cfg.url}/rest/v1/${table}`;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      await pRetry(
        async () => {
          const res = await fetch(url, {
            method: "POST",
            headers: this.headers({ Prefer: "resolution=merge-duplicates" }),
            body: JSON.stringify(chunk),
          });

          if (!res.ok) {
            const t = await res.text();
            throw new Error(`Supabase upsert failed [${table}] ${res.status}: ${t}`);
          }
        },
        { retries: 3 }
      );
    }
  }

  async select<T = any>(tableOrView: string, query: string): Promise<T[]> {
    const url = `${this.cfg.url}/rest/v1/${tableOrView}?${query}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Supabase select failed ${res.status}: ${await res.text()}`);
    return (await res.json()) as T[];
  }
}
