# Obfuscated and hidden advertising examples

[한국어](README.ko.md) | [English](README.md)

78 cases: 50 directly observed suspected ads, 23 benign controls and 5 secondary reports.

- `samples.jsonl`: suspected ads and secondary reports, distinguished by `sample_origin`.
- `negatives.jsonl`: benign controls.
- [Sources](sources.md): public source URLs and observation status.
- `import-manifest.json`: sizes and SHA-256 for JSON/JSONL data files.

`dom_verified` means HTML text, elements and explicit styles were checked; it does not mean rendered computed CSS or coordinates were measured. `visible_only` means public-text observation; `reported_only` means secondary reporting. Use each record's status, source group and exclusion reason together.

Preserve original text before normalization and do not merge direct observations and secondary reports into one ground truth. This regression-data format is separate from the app's `result.json`.
