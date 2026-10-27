# Scheduled scans

[한국어](scheduled-inspections.ko.md) | [English](scheduled-inspections.md)

Open Settings → Scheduled scans and choose **예약 추가** (Add schedule). Enter a name and URL, select a time and recurrence (once, daily or selected weekdays), then save.

- New schedules copy the current workflow, maximum pages, deadline, navigation profile and preview settings. Later general-setting changes do not update existing schedules; create a new schedule to use a changed workflow.
- Schedules use the computer's system time. The app must be running and the computer awake. No OS startup or wake task is registered.
- Schedules are checked every 5 seconds. Occurrences more than one minute late, or already past before app restart, are skipped without catch-up execution.
- If another scan or AI review is running, the occurrence is skipped without automatic retry. The list shows the last run, skip or start failure.
- An occurrence is marked consumed before execution to prevent duplicate runs after restart. A crash in this interval can leave that occurrence unexecuted.
- Results use the output folder configured at execution time and appear in history. Existing desktop/Slack/Discord notification settings apply. Groq review is not started automatically.
- Schedules are stored in `schedules.json` in the app data directory, without API keys or webhooks.
