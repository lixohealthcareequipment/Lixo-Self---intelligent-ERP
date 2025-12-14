// services/jobs/agent/execute_google_budget.ts
// Production-safe budget execution with Google Ads API
// CRITICAL: Uses CampaignBudgetService.mutateCampaignBudgets (correct API call)

import { createClient } from "@supabase/supabase-js";
import { GoogleAdsApi } from "google-ads-api";
import * as dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface ApprovedDecision {
  approval_id: string;
  campaign_id: string;
  campaign_budget_resource_name: string;
  customer_id: string;
  old_budget: number;
  new_budget: number;
}

// Initialize Google Ads client
function getGoogleAdsClient() {
  return new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
  }).Client({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID || "",
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
  });
}

// CRITICAL: Correct Google Ads API mutation for budget updates
async function executeGoogleAdsBudgetChange(
  customerId: string,
  campaignBudgetResourceName: string,
  newBudget: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getGoogleAdsClient();

    // Correct API call: CampaignBudgetService.mutateCampaignBudgets
    // NOT SQL-style mutations
    const response = await client.services.CampaignBudgetService
      .mutateCampaignBudgets({
        customer_id: customerId,
        operations: [
          {
            update: {
              resource_name: campaignBudgetResourceName,
              amount_micros: Math.round(newBudget * 1_000_000),
            },
            update_mask: "amount_micros",
          },
        ],
      });

    console.log(
      `[execute_google_budget] Budget updated for ${campaignBudgetResourceName}`
    );
    return { success: true };
  } catch (err: any) {
    const errorMessage = err?.message || "Google Ads mutation failed";
    console.error(
      `[execute_google_budget] Google Ads error: ${errorMessage}`
    );
    return { success: false, error: errorMessage };
  }
}

// Fetch pending approved decisions
async function getApprovedDecisions(): Promise<ApprovedDecision[]> {
  try {
    const { data, error } = await supabase
      .from("execution_approvals")
      .select(
        `id,
        agent_recommendations!inner(
          campaign_id,
          campaign_budget_resource_name,
          old_budget,
          new_budget
        )
      `
      )
      .eq("approval_status", "approved")
      .eq("executed_successfully", false);

    if (error) throw error;
    return (data || []) as unknown as ApprovedDecision[];
  } catch (error) {
    console.error("[execute_google_budget] Error fetching approvals:", error);
    throw error;
  }
}

// Log execution event to Supabase
async function logExecution(
  approvalId: string,
  campaignId: string,
  oldBudget: number,
  newBudget: number,
  status: string,
  error?: string
) {
  try {
    await supabase.from("execution_logs").insert({
      approval_id: approvalId,
      campaign_id: campaignId,
      old_budget: oldBudget,
      new_budget: newBudget,
      budget_delta: newBudget - oldBudget,
      execution_status: status,
      google_ads_error: error,
      executed_at: new Date().toISOString(),
    });
  } catch (logError) {
    console.error("[execute_google_budget] Log error:", logError);
  }
}

// Rollback: revert budget to original value
async function rollbackBudgetChange(
  customerId: string,
  campaignBudgetResourceName: string,
  originalBudget: number
): Promise<boolean> {
  try {
    const result = await executeGoogleAdsBudgetChange(
      customerId,
      campaignBudgetResourceName,
      originalBudget
    );

    if (result.success) {
      console.log("[execute_google_budget] Rollback successful");
      return true;
    }
    return false;
  } catch (error) {
    console.error("[execute_google_budget] Rollback error:", error);
    return false;
  }
}

// Main execution
async function main() {
  try {
    console.log("[execute_google_budget] Starting execution...");

    // Fetch approved decisions (wait for user to populate this)
    const decisions = await getApprovedDecisions();

    if (decisions.length === 0) {
      console.log("[execute_google_budget] No approved decisions to execute");
      return;
    }

    console.log(
      `[execute_google_budget] Executing ${decisions.length} approved budgets`
    );

    let successCount = 0;
    let failureCount = 0;

    for (const decision of decisions) {
      try {
        const result = await executeGoogleAdsBudgetChange(
          decision.customer_id,
          decision.campaign_budget_resource_name,
          decision.new_budget
        );

        if (result.success) {
          await logExecution(
            decision.approval_id,
            decision.campaign_id,
            decision.old_budget,
            decision.new_budget,
            "success"
          );
          successCount++;
        } else {
          await logExecution(
            decision.approval_id,
            decision.campaign_id,
            decision.old_budget,
            decision.new_budget,
            "failed",
            result.error
          );
          // Rollback on failure
          await rollbackBudgetChange(
            decision.customer_id,
            decision.campaign_budget_resource_name,
            decision.old_budget
          );
          failureCount++;
        }
      } catch (error) {
        console.error(
          `[execute_google_budget] Error processing decision:`,
          error
        );
        failureCount++;
      }
    }

    console.log(
      `[execute_google_budget] Execution complete. Success: ${successCount}, Failed: ${failureCount}`
    );
  } catch (error) {
    console.error("[execute_google_budget] Fatal error:", error);
    process.exit(1);
  }
}

main();
