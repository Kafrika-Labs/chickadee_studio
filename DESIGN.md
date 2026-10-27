# Chickadee Studio design guidelines

[한국어](DESIGN.ko.md) | [English](DESIGN.md)

## Node canvas layout

Prioritize this layout: small icon tiles on a solid charcoal dotted grid, with names and actual processing counts beneath each tile and ports on tile edges. The default flow runs left to right, branching after collection into detection/classification. Preserve saved user layouts.

Use existing inspection-stage icons and functions, without copying third-party branding. No gradients. Distinguish pending/running/completed/error/selected states with icons, text and borders. Other screens follow the monitoring-tool rules below.

## Monitoring-tool style — current priority

These feedback-driven rules override the older Studio theme/color tokens below.

- No gradients, gloss, neon or decorative color strips. Use gray backgrounds, white work panels and thin dividers.
- Use a neutral dark-gray sidebar and light-gray canvas; avoid strongly different colors for each node type.
- Distinguish node roles with restrained icon backgrounds. Put status at the top and actual counts in a thinly divided lower area.
- Blue means primary action/selection, green completion and red error. Show state names and observed counts.
- Guide navigation is a small text menu, without repeated numbers, large color fields or heavy accent lines.
- Separate labels/values and controls/body text. Align tables/counts; prefer rows/dividers to repeated cards.
- Guides use 16px body text and buttons at least 44px high. Preserve keyboard focus, focus restoration after closing and reading order when zoomed.

## Direction

Use clear hierarchy and blue for confident interaction, with readable structure and clear state separation. This product focuses on website inspection and evidence review. Combine ComfyUI-style ports with real execution states.

## Custom principles

- Font: bundled Pretendard Variable 1.3.9; no CDN requests.
- Clarity: saturated color for primary actions/current stages; avoid pale-green text and gray-only screens.
- Corners: panels 0px; nodes, inputs and buttons at most 3px. Avoid pills/rounded cards except status dots/ports.
- Surfaces: white work areas, dark-navy navigation/canvas in the older theme; no gradients. Apply current overrides above.
- Lines: thin, clear region boundaries and natural Bézier connections.
- Trust: distinguish waiting, running, completed, partial and failed. Never invent observations, confidence or percentages.

## Tokens

These are the earlier Studio tokens, subject to the priority rules above.

| Role | Value |
| --- | --- |
| Action / blue node | `#246BFE` / `#438DFF` |
| Action hover | `#1257E5` |
| Body / heading | `#101A2B` |
| Secondary body | `#4E5968` |
| Secondary status | `#6B7684` |
| Page surface | `#E9EEF5` / `#FFFFFF` |
| Sidebar / canvas | `#0B1422` / `#121E31` |
| Node surface / border | `#1B2A42` / `#415778` |
| Active edge / collection | `#53F0BC` / `#00D99A` |
| Text/style analysis | `#A780FF` |
| Additional review / attention | `#57A5CF` |
| Failure | `#F04452` |

Large titles: 28–32px/700; body: 13–14px/450–500; canvas titles: 17px/700. Monospace is reserved for URLs, selectors and raw JSON. Align displayed values for readable numeric comparison.

## Screen structure

The original layout places target and primary action on one top row, with thin summary rows instead of repeated cards. The central node editor and right-side browser capture/current URL/timeline describe the same run. Findings use a text-focused list plus evidence panel. Visited pages include discovery origin, HTTP status, extraction counts and duration. Later layout overrides below move URL entry into target-node settings.

## References

- [Pretendard](https://github.com/orioncactus/pretendard): OFL 1.1 font, bundled license.
- [Burp dashboard](https://portswigger.net/burp/documentation/desktop/tools/dashboard) and [crawl paths](https://portswigger.net/burp/documentation/desktop/tools/target/crawl-paths): separate tasks, observations and navigation.

Do not include third-party logos, fonts or proprietary UI assets. Colors, layout, curves and behavior are Chickadee implementations.

## Terminology and interaction

Avoid persistent internal engine/connection terminology in user flows. When execution is unavailable, show the actual error and an actionable next step.

| Internal/older label | UI label | Role |
| --- | --- | --- |
| 엔진 연결됨 | 검사 준비 | Ready status; opens scan settings |
| 광고 검토 후보 | 광고 의심 | Suspected-ad filter |
| 필수 기법 | 필수 탐지 | Technique filter |
| 방문 페이지 | 방문 | Visited paths |
| 대기 URL | 대기 | Actual pending URLs |
| 실행 타임라인 | 진행 기록 | Chronological event history |
| 워크플로 저장 | 구성 저장 | Save actual nodes, connections and settings |
| CSV 내보내기 | CSV 저장 | Save dialog |

State is separate from judgment. Suspected ads need review and do not establish illegality. Use short button labels and concrete explanatory sentences. Never rely only on color; include text/icons.

[Linear filters](https://linear.app/docs/filters) and [Sentry issue details](https://docs.sentry.io/product/issues/issue-details/) inform immediate filtering, nearby evidence/actions and separation of configuration from run results. Do not copy screens, logos or code.

## 0.6.0 interaction rules

References: [Burp run controls](https://portswigger.net/burp/documentation/desktop/tools/dashboard), [Sentry item review](https://docs.sentry.io/product/issues/issue-details/) and [Linear bulk selection](https://linear.app/docs/select-issues).

- One 38px blue primary run button; demo/single-page/settings in the adjacent menu.
- Secondary actions 32–36px; folder/repeated actions without backgrounds; stop with a red border.
- Summary counts are divided text buttons, not little boxes.
- Keep original text, actual evidence and notes together; show states in text and color.
- Menus support arrows, Enter and Esc; quick commands use Ctrl K. Disabled actions do not execute; focus is visible.
- Remember settings/output location and identify the actual target or local demo in results.

## Logo assets

Use the simplified original bird with magnifier, excluding browser windows, bugs and decorations. `desktop/assets/app-mark.png` is the transparent original; `app.ico` converts it to Windows icon sizes. Do not use a third-party icon library bird as the brand.

## Earlier final Studio theme

`desktop/src/theme.css` loads last as the theme/token source. Earlier rules joined target input, progress and canvas into one work area, using navy, blue and stage colors; sidebar selection used a vertical line and screens used 01–05 numbers. Later cleanup rules below replace numbers and decorative color strips.

Nodes showed stage numbers, status and actual counts; Bézier connections retained colors of executed stages and distinguished paused states from active animation. Tables used navy headers, type badges, blue selected-row accents and evidence panels.

Keep the current result target separate from the next entered URL. Never put a lock icon on HTTP. Label saved-demo design previews and do not treat them as executable validation.

## 0.6.1 cleanup rules

Do not use orange. Advertising/attention uses restrained blue; errors use red. Remove English eyebrow labels, screen numbers, ready/version/LOCAL labels, instructional footer bars, node-top strips and selection stripes. These override older numbering/strip rules.

Place the screen title and small run/results-folder/quick-command controls on one row. Enter the URL in the right settings panel after selecting the target node. Hide empty progress before a run; show real status/visit/finding counts when available. Express workflow through nodes, edges and observations without permanent instructions. Subpage settings belong to the collection node, not the top toolbar.

Preview URLs identify the captured page; show current scan location separately during navigation. Loading history resets search/node selection and restores that run's captures and events.

## 0.6.3 shared rules

Use charcoal top/sidebar surfaces and white lists. Evidence text and URL/DOM details use white backgrounds and thin borders. Status badges distinguish text and color. No heavy decorative vertical lines or gradients.

Settings inputs are 36px; list search/filters and guide-footer controls are 32px under these historical shared rules, subject to the current guide accessibility priority above. Use in-app dropdowns and brief transitions for tabs, collapsible sections and preview panels. Honor reduced motion and keyboard focus.

Guides pair actual demo screenshots with step descriptions, stacking on small screens. Images enlarge on click. Empty-state images use 128px width and original aspect ratio. Store node positions locally and create the canvas after configuration restoration.
