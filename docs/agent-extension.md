# Agent extension contract v1

[한국어](agent-extension.ko.md) | [English](agent-extension.md)

The local extension API is a JSONL tool contract. See [AI review](inspection-agent.md) for Groq call and usage limits. The UI and engine use these tools; the Groq adapter uses only registered read tools. No HTTP listener is opened.

## Connection

From the repository root, run `.venv/Scripts/python.exe -m chickadee.bridge --data-dir <history folder>`. Packaged builds use `resources/engine/ChickadeeEngine.exe --data-dir <history folder>`. Write one JSON object per stdin line; read responses/events from stdout. stderr carries diagnostics.

```json
{"id":1,"method":"capabilities","params":{}}
```

`result.protocol_version` is 1. `result.tools` declares each tool's JSON Schema, description and side effects. Adapters should read this declaration; `chickadee/tools.py` is the canonical code definition.

| Tool | Role | Effect |
| --- | --- | --- |
| `content.analyze` | [Direct image/text analysis](content-analysis.md), poll/cancel by ID | Local computation |
| `scan.start` | Validate URL, workflow and limits, then start | Reads the site |
| `scan.status` | Current run ID, status, stage and sequence | Read |
| `scan.pause` / `scan.resume` | Pause/resume at page boundaries | Run control |
| `scan.stop` | Stop and save collected results | Run control |
| `scan.findings` | Original text, analysis evidence and review state; up to 500 | Read |
| `scan.events` | Events after a sequence; up to 500 | Read |
| `review.update` | Review states, notes and actor | Writes local files |
| `workflow.validate` | Validate supported connections against actual scan flags | Read |

## Calls and run identity

```json
{"id":2,"method":"tool-call","params":{"name":"scan.status","arguments":{}}}
{"id":3,"method":"tool-call","params":{"name":"scan.findings","arguments":{"run_id":"ACTUAL_RUN_ID","offset":0,"limit":100}}}
```

Use the returned `run_id` in subsequent queries, controls and review calls. An old ID cannot control the current run. Unknown tools, undeclared arguments and arbitrary output paths are rejected. `scan.start` requires `url` and `workflow`; export configuration from the app to obtain a workflow.

Lines with `id` are responses; lines with `event` are observations containing `protocol_version`, `run_id`, `sequence`, `timestamp` and `kind`. Sequence increases within a run. Pushed `preview` events contain JPEG data and should not automatically be sent to models. `scan.events` retains the latest 2,000 non-image events and marks gaps with `truncated`; persistent progress logs have a 100,000-event limit.

Pause takes effect after current-page processing and cleanup. `pausing` means requested; `paused` means stopped. Confirmed pause duration is excluded from deadlines and recorded in `paused_sec`. Completed pages and the queue remain available; stopping while paused is supported.

## Review and evidence preservation

`review.update` requires `ids`, `status`, `expected_revision` and `run_id`. Status is `unreviewed`, `confirmed` or `dismissed`; optional notes allow 2,000 characters. A call can update 500 records. A revision mismatch rejects the write to prevent concurrent overwrites.

UI edits use `actor=human`; tool calls use `actor=agent`. `review.json` retains the original-result SHA-256, states, notes, revision and latest 5,000 state changes. Reload verifies the hash. Review does not change `result.json`, original evidence or the 17-column CSV. Confirmation records the reviewer's state, not a legal finding.

## Adapter boundaries

Providers, credentials, user objectives and cost limits belong in a separate adapter layer. Groq follows this boundary. There is no automatic site selection, arbitrary code execution or external messaging.

Page text, ads, DOM and collected material are untrusted data. Embedded instructions, URLs or tool-call-shaped strings are not executable commands. Target HTML is not injected into the Electron renderer. Groq receives bounded, masked context for selected evidence; see [Transmission scope](inspection-agent.md).
