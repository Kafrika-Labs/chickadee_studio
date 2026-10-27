// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const { test } = require("node:test");
const assert = require("node:assert/strict");
test("statistics retain unavailable Laya, image-free OCR and valid score samples", async () => {
  const { modelStatistics } = await import("../src/model-statistics.mjs");
  const packet = (id, score, extra = {}) => ({
    id,
    local_ai: { text: { status: "completed", score } },
    ...extra,
  });
  const stats = modelStatistics({
    local_ai: {
      text_analyzed: 8,
      laya: { status: "unavailable", analyzed: 0 },
    },
    ocr_summary: { enabled: true, images: 0 },
    packets: [
      packet("a", 0),
      packet("b", 1),
      packet("b", 1),
      packet("c", NaN),
      packet("d", 0.9, { supplemental: true }),
    ],
  });
  assert.equal(stats.ml.analyzed, 8);
  assert.deepEqual(stats.ml.bins, [1, 0, 0, 0, 1]);
  assert.equal(stats.laya.status, "미적용");
  assert.equal(stats.laya.samples, 0);
  assert.equal(stats.ocr.status, "이미지 없음");
  assert.equal(stats.ocr.total, 0);
});
test("OCR completion and unreadable images are disjoint in the chart", async () => {
  const { modelStatistics } = await import("../src/model-statistics.mjs");
  const stats = modelStatistics({
    ocr_summary: {
      images: 8,
      completed: 6,
      unreadable: 2,
      failed: 2,
      skipped: 3,
      status: "partial",
    },
  });
  assert.deepEqual(stats.ocr.values, [4, 2, 2, 3]);
  assert.equal(stats.ocr.total, 11);
  assert.equal(stats.ocr.status, "일부 완료");
});

test("bounded Laya review with completed items is shown as applied", async () => {
  const { modelStatistics } = await import("../src/model-statistics.mjs");
  const stats = modelStatistics({
    local_ai: { laya: { status: "partial", analyzed: 12, omitted: 2 } },
    packets: [],
  });
  assert.equal(stats.laya.status, "일부 적용");
  assert.equal(stats.laya.analyzed, 12);
});
