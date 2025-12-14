# Lixo Self - Intelligent ERP

**AI-Driven Healthcare Equipment Sales Intelligence Platform**

A production-grade system combining AI decision-making, budget optimization, approval workflows, and automated intelligence delivery for healthcare equipment sales.

---

## 🎯 Architecture Overview

This project implements a three-phase intelligent agent system:

### Phase 1: AI Decision Engine ✅
- **Optimizer Workflow**: `agent-google-budget-run.yml`
- Analyzes Google Ads campaigns using OpenAI (GPT-4.1-mini)
- Evaluates 7-day historical data
- Generates budget change recommendations
- Stores decisions in immutable `ai_decision_logs` table

### Phase 2: Manual Approval Gate ✅
- Human-in-loop approval required before execution
- Stores in `execution_approvals` table
- Safety caps enforced (hard + soft limits)
- Zero AI involvement in fund movement

### Phase 3: Deterministic Execution ✅
- **Execute Workflow**: `agent-google-budget-execute.yml`
- Uses `CampaignBudgetService.mutateCampaignBudgets()` (correct Google Ads API)
- Applies budget changes after approval
- Immutable audit trail in `execution_logs`
- Automatic rollback on failure

### Bonus: Daily Intelligence Briefing ✅
- **Chairman Brief Workflow**: `chairman-daily-brief.yml`
- Runs daily at 8 AM IST
- AI-generated executive summary
- Delivered via Zoho SMTP email

---

## 📁 Project Structure

```
Lixo-Self---intelligent-ERP/
├── .github/
│   └── workflows/
│       ├── agent-google-budget-run.yml         # Phase 1: AI optimization
│       ├── agent-google-budget-execute.yml     # Phase 3: Budget execution
│       ├── chairman-daily-brief.yml            # Daily intelligence
│       └── verify-openai-secret.yml            # Secret verification
│
├── services/
│   └── jobs/
│       ├── agent/
│       │   ├── lib/
│       │   │   └── openai_client.ts            # OpenAI configuration
│       │   ├── ingest_google_ads.ts            # Phase 3A: Ingestion
│       │   ├── execute_google_budget.ts        # Phase 3B: Execution
│       │   ├── chairman_daily_brief.ts         # Email delivery
│       │   └── run_optimizer_google_budget.ts  # Phase 1: Main optimizer
│       │
│       ├── common/
│       │   └── db.ts                           # Supabase client
│       │
│       ├── package.json                        # Dependencies (nodemailer, etc.)
│       ├── tsconfig.json                       # TypeScript config
│       └── PHASE_3_SCHEMA_MIGRATIONS.sql       # Database schema
│
└── README.md                                   # This file
```

---

## 🔧 Quick Start

### Prerequisites
- Node.js 20+
- GitHub account with repo access
- Supabase project (PostgreSQL)
- OpenAI API key (gpt-4.1-mini)
- Google Ads API credentials
- Zoho Mail SMTP credentials (optional, for email)

### Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/lixohealthcareequipment/Lixo-Self---intelligent-ERP.git
   cd Lixo-Self---intelligent-ERP
   ```

2. **Install dependencies**
   ```bash
   cd services/jobs
   npm install
   ```

3. **Set environment variables** (`.env`)
   ```bash
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   OPENAI_API_KEY=sk-proj-...
   OPENAI_MODEL=gpt-4.1-mini
   GOOGLE_ADS_CLIENT_ID=...
   GOOGLE_ADS_CLIENT_SECRET=...
   GOOGLE_ADS_DEVELOPER_TOKEN=...
   GOOGLE_ADS_REFRESH_TOKEN=...
   GOOGLE_ADS_CUSTOMER_ID=...
   ```

4. **Run database migrations** (Supabase SQL editor)
   - Copy contents of `PHASE_3_SCHEMA_MIGRATIONS.sql`
   - Execute in Supabase SQL editor
   - Creates: `execution_approvals`, `execution_logs`, `safety_caps`, `execution_controls`

5. **Test locally**
   ```bash
   cd services/jobs
   node --loader ts-node/esm agent/run_optimizer_google_budget.ts
   ```

---

## 🚀 GitHub Actions Setup

### Add Required Secrets

**Navigate to**: GitHub Repo → Settings → Secrets and variables → Actions

**Required secrets** (Phase 1 & 3):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_CUSTOMER_ID`

**Optional secrets** (Chairman Brief):
- `SMTP_HOST` (e.g., `smtp.zoho.in` for India)
- `SMTP_PORT` (e.g., `587` for STARTTLS)
- `SMTP_USER` (e.g., `ai@lixo.in`)
- `SMTP_PASS` (Zoho app password, NOT main password)
- `BRIEF_TO_EMAIL` (e.g., `chairman@lixo.in`)
- `MAIL_FROM` (optional sender display name)

### Run Workflows Manually

1. **Phase 1 - Optimizer**
   ```
   Actions → Agent - Google Budget - Run → Run workflow
   Generates AI recommendations
   ```

2. **Manual Approval** (SQL)
   ```sql
   UPDATE prod.execution_approvals
   SET approval_status='approved',
       approved_by='ops@lixo.in',
       approved_at=now()
   WHERE id='<approval_uuid>';
   ```

3. **Phase 3 - Execute**
   ```
   Actions → Agent - Google Budget - Execute → Run workflow
   Applies approved budget changes
   ```

4. **Chairman Brief** (Scheduled or Manual)
   ```
   Actions → Chairman - Daily Brief → Run workflow
   Generates AI brief + emails chairman
   ```

---

## 🔐 Safety & Governance

### Safety Caps (Non-Negotiable)
Configured in `prod.safety_caps` table:
- **Max single budget increase**: 50%
- **Max single budget decrease**: 30%
- **Max daily total spend change**: $5,000
- **Max per-approval delta**: $10,000
- **Hard ceiling on daily spend**: $50,000

### Kill Switch
Set `pause_execution = 'true'` in `prod.execution_controls` to disable all executions instantly.

### Approval Workflow
1. AI generates recommendations (Phase 1)
2. Human reviews in `execution_approvals` (SQL)
3. Manual approval required (UPDATE SQL)
4. Execution runs only if approved (Phase 3)
5. All changes logged immutably

### Rollback Window
24-hour rollback window after execution. Revert budget to original value using:
```sql
UPDATE prod.execution_logs
SET rollback_status='success',
    rolled_back_at=now()
WHERE id='<execution_log_id>';
```

---

## 📊 Database Schema

Key tables created by migrations:

### `execution_approvals`
Immutable log of all approval decisions
- `id` (UUID primary key)
- `approval_status` (pending/approved/rejected)
- `approved_by` (email)
- `total_budget_delta` (decimal)
- `safety_check_passed` (boolean)

### `execution_logs`
Immutable record of all budget executions
- `id` (UUID primary key)
- `campaign_id` (bigint)
- `old_budget` / `new_budget` (decimal)
- `execution_status` (pending/success/failed)
- `rollback_status` (null/pending/success/failed)

### `safety_caps`
Configurable safety limits
- `cap_name` (unique)
- `cap_value` (decimal)
- `is_active` (boolean)

### `execution_controls`
System flags
- `pause_execution` (kill switch)
- `require_manual_approval` (governance)
- `execution_email` (notifications)

---

## 🧪 Testing

### Unit Tests (Recommended Addition)
```bash
npm test  # Run TypeScript test suite
```

### Integration Tests
1. **Verify secrets**
   ```
   Actions → Verify - OpenAI Secret → Run workflow
   Should see: OPENAI_API_KEY is PRESENT (length=...)
   ```

2. **Test optimizer**
   ```
   Actions → Agent - Google Budget - Run → Run workflow
   Check logs for [optimizer_google_budget] decisions=X recos=Y
   ```

3. **Test execution**
   ```
   Approve a decision, run Agent - Google Budget - Execute
   Check execution_logs table for status='success'
   ```

---

## 📝 Important Files

| File | Purpose | Tech Stack |
|------|---------|------------|
| `run_optimizer_google_budget.ts` | AI decision engine | OpenAI, Supabase, TypeScript |
| `execute_google_budget.ts` | Budget execution | Google Ads API, nodemailer |
| `chairman_daily_brief.ts` | Executive briefing | OpenAI, nodemailer, Supabase |
| `ingest_google_ads.ts` | Campaign data sync | Google Ads API, Supabase |
| `PHASE_3_SCHEMA_MIGRATIONS.sql` | Database setup | PostgreSQL (Supabase) |
| `agent-google-budget-run.yml` | CI/CD: Optimizer | GitHub Actions |
| `agent-google-budget-execute.yml` | CI/CD: Executor | GitHub Actions |
| `chairman-daily-brief.yml` | CI/CD: Intelligence | GitHub Actions (scheduled) |

---

## 🛠️ Technology Stack

- **Language**: TypeScript 100%
- **Runtime**: Node.js 20+
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI API (gpt-4.1-mini)
- **Ads API**: Google Ads API
- **Email**: nodemailer + Zoho SMTP
- **CI/CD**: GitHub Actions
- **Infrastructure**: Cloud-native (serverless)

---

## 📚 Documentation

- **Phase 1 (Optimization)**: See `agent-google-budget-run.yml`
- **Phase 3 (Execution)**: See `agent-google-budget-execute.yml` + `PHASE_3_SCHEMA_MIGRATIONS.sql`
- **Email Setup**: See `chairman-daily-brief.ts` + `chairman-daily-brief.yml`
- **API Docs**: Google Ads API, OpenAI API, Supabase Docs

---

## 📞 Support

For questions or issues:
1. Check GitHub Issues
2. Review workflow logs in Actions tab
3. Verify all GitHub secrets are set
4. Confirm Supabase migrations are applied
5. Test local environment with `npm test`

---

## 📄 License

Private repository. All rights reserved to Lixo Healthcare Equipment.

---

**Last Updated**: December 14, 2025  
**Maintained By**: AI Engineering Team  
**Status**: Production-Ready ✅
