# Google Drive to GitHub Sync - Setup Guide

## Overview

This guide explains how to set up the automated Google Drive sync workflow that runs daily to sync files from your Google Drive folder to this GitHub repository.

## Prerequisites

Before starting, you need:
1. A Google Cloud Project with the Google Drive API enabled
2. A service account with appropriate permissions
3. Access to this GitHub repository (admin privileges to add secrets)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" at the top
3. Click "NEW PROJECT"
4. Name your project (e.g., "GitHub Drive Sync")
5. Click "CREATE"
6. Wait for the project to be created

## Step 2: Enable Google Drive API

1. In the Cloud Console, go to the Navigation menu > APIs & Services > Library
2. Search for "Google Drive API"
3. Click on it
4. Click "ENABLE"

## Step 3: Create a Service Account

1. Go to APIs & Services > Credentials
2. Click "+ CREATE CREDENTIALS" > "Service Account"
3. Fill in the details:
   - Service account name: `github-drive-sync` (or similar)
   - Service account ID: Auto-filled
   - Description: "Service account for syncing Drive to GitHub"
4. Click "CREATE AND CONTINUE"
5. Skip the optional steps and click "DONE"

## Step 4: Create and Download Service Account Key

1. In Credentials page, find your service account and click on it
2. Go to the "KEYS" tab
3. Click "ADD KEY" > "Create new key"
4. Select "JSON"
5. Click "CREATE"
6. A JSON file will be downloaded - **SAVE THIS FILE SECURELY**

## Step 5: Share Google Drive Folder with Service Account

1. Open the JSON file you downloaded
2. Find the `client_email` field (looks like `github-drive-sync@project-id.iam.gserviceaccount.com`)
3. Copy this email address
4. Go to your Google Drive folder: https://drive.google.com/drive/folders/1y6G_sYfDB_3uHRI7cbm9HaLY6SL48fMN
5. Right-click the folder > "Share"
6. Paste the service account email
7. Give it "Editor" access
8. Click "Share"

## Step 6: Encode Service Account Credentials

The GitHub Actions workflow expects the service account JSON to be base64 encoded.

### On Mac/Linux:

```bash
cat /path/to/service-account-key.json | base64
```

Copy the entire output (it will be a long string).

### On Windows (PowerShell):

```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content "/path/to/service-account-key.json" -Raw)))
```

## Step 7: Add GitHub Secrets

1. Go to this repository > Settings > Secrets and variables > Actions
2. You should see two secrets already created:
   - `GOOGLE_DRIVE_FOLDER_ID`: `1y6G_sYfDB_3uHRI7cbm9HaLY6SL48fMN` ✅ (Already configured)
   - `GOOGLE_DRIVE_CREDENTIALS`: Currently has a placeholder value

3. Click on `GOOGLE_DRIVE_CREDENTIALS`
4. Click "Update"
5. In the "Secret" field, replace the placeholder with the base64-encoded JSON from Step 6
6. Click "Update secret"

## Step 8: Test the Workflow

1. Go to Actions > "Daily Google Drive Sync" workflow
2. Click "Run workflow" > "Run workflow"
3. The workflow should complete successfully
4. Check the job logs for any errors

## Step 9: Verify the Sync

After the workflow runs successfully:

1. Go to the repository's Code tab
2. You should see files from your Google Drive folder
3. Check the "Add daily automated Google Drive sync workflow" commit message
4. Future syncs will run automatically at **6:00 AM IST (00:30 UTC)** daily

## Workflow Schedule

- **Cron Expression**: `30 0 * * *`
- **Time**: 6:00 AM IST (00:30 UTC)
- **Frequency**: Every day
- **Manual Trigger**: Yes - You can manually trigger the workflow from Actions tab

## What the Workflow Does

1. Checks out the repository
2. Sets up Python environment
3. Installs Google API client libraries
4. Downloads all files from the Google Drive folder
5. Preserves folder structure
6. Checks for changes
7. Commits changes if detected
8. Creates a pull request if changes were made
9. Sends notification on completion

## Troubleshooting

### Workflow fails with "Authentication error"
- Verify the base64-encoded credentials are correct
- Ensure the service account email has access to the Drive folder
- Check that you copied the entire base64 string without truncation

### Workflow fails with "Folder not found"
- Verify the `GOOGLE_DRIVE_FOLDER_ID` is correct: `1y6G_sYfDB_3uHRI7cbm9HaLY6SL48fMN`
- Ensure the service account has access to this folder

### No files are being synced
- Check if the Google Drive folder contains files
- Verify folder permissions for the service account
- Run a manual workflow test to see detailed logs

### Changes not being committed
- The workflow only commits when changes are detected
- If you see no commits, it means the files in Drive haven't changed
- Modify a file in Drive and run the workflow again

## Security Notes

1. **Keep service account key secure** - Never commit it to the repository
2. **Secrets are encrypted** - GitHub encrypts all secrets automatically
3. **Limited access** - Give the service account only necessary folder access
4. **Rotation** - Consider rotating the service account key periodically

## Manual Workflow Trigger

To manually run the sync without waiting for the scheduled time:

1. Go to Actions
2. Click "Daily Google Drive Sync" in the left sidebar
3. Click "Run workflow" button
4. Select "main" branch
5. Click "Run workflow"

## Next Steps

Once the sync is working:
1. Monitor the first few syncs to ensure they work correctly
2. Set up email notifications if desired (GitHub Actions settings)
3. Consider adding branch protection rules if needed
4. Document any custom folder structures in your project README

## Support

For issues or questions:
1. Check the workflow logs in Actions tab
2. Verify all prerequisites are completed
3. Ensure service account has proper permissions
4. Review the troubleshooting section above

---

**Last Updated**: Auto-generated setup guide for Google Drive sync workflow
