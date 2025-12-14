// services/jobs/agent/ingest_google_ads.ts
// Ingestion service for Google Ads campaign data
// CRITICAL: Captures campaign_budget_resource_name (required for budget updates)

import { createClient } from "@supabase/supabase-js";
import { GoogleAdsApi, GoogleAdsClient } from "google-ads-api";
import * as dotenv from "dotenv";

dotenv.config();

interface CampaignData {
  customer_id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_budget_id: string;
  campaign_budget_resource_name: string; // CRITICAL
  budget_amount_micros: number;
  status: string;
  created_date: string;
  last_modified_date: string;
}

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

let googleAdsClient: GoogleAdsClient;

async function initializeGoogleAdsClient() {
  if (!googleAdsClient) {
    googleAdsClient = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    }).Client({
      customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID || "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
    });
  }
  return googleAdsClient;
}

async function fetchCampaignData(): Promise<CampaignData[]> {
  try {
    const client = await initializeGoogleAdsClient();

    const query = `
      SELECT
        customer.id,
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.created_time,
        campaign.last_modified_time,
        campaign_budget.id,
        campaign_budget.resource_name,
        campaign_budget.amount_micros
      FROM campaign
      WHERE campaign.status IN ('ENABLED', 'PAUSED')
    `;

    const response = await client.searchStream({ query });
    const campaigns: CampaignData[] = [];

    for await (const row of response) {
      campaigns.push({
        customer_id: row.customer.id,
        campaign_id: row.campaign.id,
        campaign_name: row.campaign.name,
        campaign_budget_id: row.campaign_budget.id,
        campaign_budget_resource_name: row.campaign_budget.resource_name,
        budget_amount_micros: row.campaign_budget.amount_micros,
        status: row.campaign.status,
        created_date: row.campaign.created_time,
        last_modified_date: row.campaign.last_modified_time,
      });
    }

    console.log(
      `[ingest_google_ads] Fetched ${campaigns.length} campaigns`
    );
    return campaigns;
  } catch (error) {
    console.error("[ingest_google_ads] Error:", error);
    throw error;
  }
}

async function ingestCampaigns(campaigns: CampaignData[]): Promise<number> {
  if (campaigns.length === 0) return 0;

  try {
    await supabase.from("google_campaigns").upsert(
      campaigns.map((c) => ({
        customer_id: c.customer_id,
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        campaign_budget_id: c.campaign_budget_id,
        campaign_budget_resource_name: c.campaign_budget_resource_name,
        budget_amount_micros: c.budget_amount_micros,
        budget_amount_usd: c.budget_amount_micros / 1_000_000,
        status: c.status,
        last_ingested_at: new Date().toISOString(),
      })),
      { onConflict: "campaign_id" }
    );

    console.log(
      `[ingest_google_ads] Ingested ${campaigns.length} campaigns`
    );
    return campaigns.length;
  } catch (error) {
    console.error("[ingest_google_ads] Ingest error:", error);
    throw error;
  }
}

async function main() {
  try {
    console.log("[ingest_google_ads] Starting...");
    const campaigns = await fetchCampaignData();
    await ingestCampaigns(campaigns);
    console.log("[ingest_google_ads] Complete");
  } catch (error) {
    console.error("[ingest_google_ads] Fatal:", error);
    process.exit(1);
  }
}

main();
