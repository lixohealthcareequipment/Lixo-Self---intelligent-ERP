// services/jobs/agent/chairman_daily_brief.ts
// Daily AI intelligence brief delivered to chairman
// Email via Zoho SMTP using nodemailer

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function mustEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env: ${key}`);
  return val;
}

async function sendEmail(subject: string, html: string, text: string) {
  const host = mustEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || 587);
  const user = mustEnv("SMTP_USER");
  const pass = mustEnv("SMTP_PASS");
  const from = process.env.MAIL_FROM || user;
  const to = mustEnv("BRIEF_TO_EMAIL");

  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  await transporter.verify();

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });
}

async function storeBrief(briefId: string, briefContent: string) {
  const { error } = await supabase.from("chairman_briefs").insert({
    id: briefId,
    content: briefContent,
    created_at: new Date().toISOString()
  });

  if (error) {
    console.error("[chairman_brief] Error storing brief:", error);
    throw error;
  }
}

async function generateBrief(): Promise<string> {
  const prompt = `You are the AI Intelligence Officer for Lixo Healthcare Equipment.
Generate a brief daily executive summary (5-7 bullet points) for the Chairman including:
- Key AI decisions made today
- Budget optimization recommendations
- Risk alerts if any
- Recommended actions

Format: Clear, concise, action-oriented.`;

  const message = await openai.messages.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from OpenAI");
  }

  return content.text;
}

async function main() {
  try {
    console.log("[chairman_brief] Starting...");

    const briefId = `brief-${Date.now()}`;
    const briefContent = await generateBrief();

    await storeBrief(briefId, briefContent);
    console.log(`[chairman_brief] stored brief_id=${briefId}`);

    const sendEmail_ = process.env.SEND_EMAIL === "true";
    if (sendEmail_) {
      const subject = `Daily AI Intelligence Brief - ${new Date().toLocaleDateString()}`;
      const html = `<html><body><pre>${briefContent}</pre></body></html>`;
      const text = briefContent;

      await sendEmail(subject, html, text);
      console.log(`[chairman_brief] Email sent to ${process.env.BRIEF_TO_EMAIL}`);
    }

    console.log(
      `[chairman_brief] Complete. send_email=${sendEmail_}`
    );
  } catch (error) {
    console.error("[chairman_brief] Error:", error);
    process.exit(1);
  }
}

main();
