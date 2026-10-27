import { t } from "./i18n.mjs";

const count = (value) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
export function modelStatistics(data = {}) {
  const packets = [
    ...new Map(
      (data.packets || []).filter((p) => !p.supplemental).map((p) => [p.id, p]),
    ).values(),
  ];
  function scores(kind) {
    const values = packets
      .map((p) => p.local_ai?.[kind])
      .filter((p) => p?.status === "completed")
      .map((p) => p.score)
      .filter((v) => Number.isFinite(v) && v >= 0 && v <= 1);
    return {
      samples: values.length,
      bins: Array.from(
        { length: 5 },
        (_, i) =>
          values.filter((v) => Math.min(4, Math.floor(v * 5)) === i).length,
      ),
    };
  }
  const ocr = data.ocr_summary || {},
    laya = data.local_ai?.laya || {};
  const recognized = Math.max(0, count(ocr.completed) - count(ocr.unreadable));
  return {
    ml: { analyzed: count(data.local_ai?.text_analyzed), ...scores("text") },
    laya: {
      analyzed: count(laya.analyzed),
      status:
        laya.status === "completed"
          ? t("적용")
          : laya.status === "partial" && count(laya.analyzed)
            ? t("일부 적용")
            : laya.status === "unavailable"
              ? t("미적용")
              : laya.status === "failed"
                ? t("분석 실패")
                : t("입력 없음"),
      ...scores("laya"),
    },
    ocr: {
      analyzed: count(ocr.completed),
      total: count(ocr.images) + count(ocr.skipped),
      status:
        ocr.enabled === false
          ? t("꺼짐")
          : !count(ocr.images) && !count(ocr.skipped)
            ? t("이미지 없음")
            : ocr.status === "partial"
              ? t("일부 완료")
              : t("완료"),
      values: [
        recognized,
        count(ocr.unreadable),
        count(ocr.failed),
        count(ocr.skipped),
      ],
    },
  };
}
