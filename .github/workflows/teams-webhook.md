---
description: Custom safe-output for sending Microsoft Teams webhook notifications
safe-outputs:
  jobs:
    teams-notify:
      description: "Send notification to Microsoft Teams channel"
      runs-on: ubuntu-latest
      output: "Teams notification sent successfully!"
      permissions:
        contents: read
      inputs:
        pr_number:
          description: "Pull request number"
          required: true
          type: string
        pr_title:
          description: "Pull request title"
          required: true
          type: string
        pr_author:
          description: "Pull request author username"
          required: true
          type: string
        target_branch:
          description: "Target branch (develop/main)"
          required: true
          type: string
        pr_url:
          description: "Full URL to the pull request"
          required: true
          type: string
        files_changed:
          description: "Number of files changed"
          required: false
          type: string
        message_type:
          description: "Template type for Teams message (pr_review|security|daily_status)"
          required: false
          type: string
        plain_summary:
          description: "Plain-language 2-3 sentence summary to show in the message"
          required: false
          type: string
        critical_comments:
          description: "Critical reviewer comments or 'No critical issues found.'"
          required: false
          type: string
      steps:
        - name: Send Teams notification
          uses: actions/github-script@v7
          env:
            TEAMS_WEBHOOK_URL: "${{ secrets.TEAMS_WEBHOOK_URL }}"
          with:
            script: |
              const fs = require('fs');
              const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
              const outputFile = process.env.GH_AW_AGENT_OUTPUT;
              
              // Validate webhook URL
              if (!webhookUrl) {
                core.setFailed('TEAMS_WEBHOOK_URL secret is not configured');
                return;
              }
              
              // Check if running in staged mode
              if (process.env.GH_AW_SAFE_OUTPUTS_STAGED === 'true') {
                core.info('📋 Staged mode: Would send Teams notification');
                await core.summary.addRaw('## Preview\n\nWould send Teams notification for PR').write();
                return;
              }
              
              // Read agent output
              if (!outputFile) {
                core.info('No GH_AW_AGENT_OUTPUT found');
                return;
              }
              
              const fileContent = fs.readFileSync(outputFile, 'utf8');
              const agentOutput = JSON.parse(fileContent);
              
              // Filter for teams-notify items (job name with dashes → underscores)
              const items = agentOutput.items.filter(item => item.type === 'teams_notify');
              
              if (items.length === 0) {
                core.info('No teams_notify items found in agent output');
                return;
              }
              
              // Process each notification
              for (const item of items) {
                const prNumber = item.pr_number || 'Unknown';
                const prTitle = item.pr_title || 'No title';
                const prAuthor = item.pr_author || 'Unknown';
                const targetBranch = item.target_branch || 'Unknown';
                const prUrl = item.pr_url || '';
                const filesChanged = item.files_changed || '0';
                const messageType = (item.message_type || 'pr_review').toLowerCase();
                const plainSummary = item.plain_summary || '';
                const criticalComments = item.critical_comments || 'No critical issues found.';

                core.info(`Sending Teams notification for PR #${prNumber} (type=${messageType})`);

                // Build payload using templates per message type for scalability
                const templates = {
                  pr_review: {
                    themeColor: '0078d4',
                    summary: 'Pull Request Raised',
                    activityTitle: 'Pull Request Raised',
                    buildSections: (it) => {
                      // Use formatted critical comments (normalize bullets)
                      let formattedCritical = 'No critical issues found.';
                      if (criticalComments && criticalComments.trim()) {
                        const lines = criticalComments.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                        if (lines.length > 1) {
                          const normalized = lines.map(l => l.replace(/^[\-\*•\s]+/, '').trim()).filter(Boolean);
                          if (normalized.length > 0) formattedCritical = normalized.map(l => `- ${l}`).join('\n');
                        } else {
                          formattedCritical = '```\n' + criticalComments.trim() + '\n```';
                        }
                      }

                      const header = `**@${prAuthor}** opened PR [#${prNumber}](${prUrl}) - **${prTitle}**`;
                      const details = `**Files Changed:** ${filesChanged}\n\n**Summary:** ${plainSummary}`;
                      const criticalBlock = `**Critical Comments:**\n${formattedCritical}`;

                      return [{
                        activityTitle: templates.pr_review.activityTitle,
                        activitySubtitle: '[Auto-generated message]',
                        activityImage: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
                        text: `${header}\n\n${details}\n\n${criticalBlock}`,
                        markdown: true
                      }];
                    }
                  },
                  security: {
                    themeColor: 'd33d3d',
                    summary: 'Security Scan Results',
                    activityTitle: 'Security Report',
                    buildSections: (it) => [{
                      activityTitle: 'Security Report',
                      activitySubtitle: '[Auto-generated message]',
                      activityImage: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
                      text: `**Summary:** ${plainSummary}\n\n**Details:**\n${criticalComments || 'No critical issues found.'}`,
                      markdown: true
                    }]
                  },
                  daily_status: {
                    themeColor: '28a745',
                    summary: 'Daily Status',
                    activityTitle: 'Daily Status Update',
                    buildSections: (it) => {
                      const total = it.total_prs || '0';
                      const prsByAuthor = it.prs_by_author || item.prs_by_author || '';
                      const summaryText = plainSummary || '';
                      const text = `**Summary:** ${summaryText}\n\n**Total PRs:** ${total}\n\n${prsByAuthor}`.trim();
                      return [{
                        activityTitle: 'Daily Status Update',
                        activitySubtitle: '[Auto-generated message]',
                        activityImage: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
                        text,
                        markdown: true
                      }];
                    }
                  }
                };

                const tpl = templates[messageType] || templates.pr_review;
                const sections = tpl.buildSections(item);

                const payload = {
                  '@type': 'MessageCard',
                  '@context': 'http://schema.org/extensions',
                  themeColor: tpl.themeColor,
                  summary: tpl.summary,
                  sections,
                  potentialAction: [{
                    '@type': 'OpenUri',
                    name: 'View Pull Request',
                    targets: [{ os: 'default', uri: prUrl }]
                  }]
                };

                // Send to Teams webhook
                try {
                  const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                  });

                  if (!response.ok) {
                    const errorText = await response.text();
                    core.setFailed(`Teams webhook failed (${response.status}): ${errorText}`);
                    return;
                  }

                  core.info('✅ Teams notification sent successfully');
                  core.info(`PR #${prNumber} notification delivered`);

                } catch (error) {
                  core.setFailed(`Failed to send Teams notification: ${error.message}`);
                  return;
                }
              }
---

# Microsoft Teams Webhook Integration

This custom safe-output enables workflows to send notifications to Microsoft Teams channels via incoming webhooks.

## Setup

1. Create an incoming webhook in your Teams channel
2. Add the webhook URL as a GitHub secret named `TEAMS_WEBHOOK_URL`
3. Import this configuration in your workflow

## Usage

The agent can call the `teams_notify` tool with the following parameters:

- `pr_number`: Pull request number
- `pr_title`: Pull request title 
- `pr_author`: PR author username
- `target_branch`: Target branch (develop/main)
- `pr_url`: Full URL to the PR
- `files_changed`: Number of files changed (optional)

## Security

- The webhook URL is stored securely as a GitHub secret
- The job runs with minimal `contents: read` permission
- Supports staged mode for testing without actually sending notifications