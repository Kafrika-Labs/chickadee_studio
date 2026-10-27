# Notifications and completion reports

[한국어](notifications.ko.md) | [English](notifications.md)

The settings sidebar contains General, AI connection and Notifications.

Configure desktop notifications, default sound and suppression while the app is focused, then choose **알림 설정 저장** (Save notification settings). OS notification permission is separate. The test button uses saved settings and requests a real system notification.

For Slack or Discord, enter the channel's Incoming Webhook URL, enable delivery and save. Saved URLs are not returned to the input field. Saving an empty field preserves the existing URL; selecting deletion and saving removes it and disables delivery.

- Webhooks are encrypted with Electron safeStorage in `notifications.json` in the user data directory. They are not stored as plaintext when secure storage is unavailable.
- Completed, partial, cancelled and failed runs send status, visited-page count, technique finding count and suspected-ad count. Site URLs, original text, images, local paths and result files are not sent.
- Only actual termination events trigger delivery. Reopening history or switching tabs does not resend reports.
- Requests have an 8-second timeout, reject redirects and do not retry automatically. Delivery failure does not change scan results. Reopen notification settings to inspect the last delivery status.
- Webhook delivery is independent of desktop notification/focus settings. Runs that ended before settings were saved are not sent retroactively.

Development checks use fake send functions, not real channel messages. Fully restart the app after adding Electron functionality.

[Slack webhook documentation](https://api.slack.com/messaging/webhooks) · [Discord webhook documentation](https://discord.com/developers/docs/resources/webhook)
