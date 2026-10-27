import React from "react";
import { t } from "./i18n.mjs";

const labels = { ad_context: t("광고 문맥 유사"), phishing_pattern: t("피싱 화면 유사"), review: t("추가 신호 미확인"), no_features: t("일치 특징 없음") };
export default function LocalAIAnalysis({ analysis }) {
  if (!analysis) return null;
  return <section className="local-ai-analysis" aria-label={t("로컬 AI 분석")}>
    <label>{t("AI 분석")}</label>
    <dl>{[["text", t("ML 문자 문맥")], ["laya", t("Laya 문맥")], ["visual", t("피싱 화면")], ["content_visual", t("ML 이미지 분류")]].map(([kind, title]) => {
      const item = analysis[kind];
      if (!item) return null;
      return <React.Fragment key={kind}><dt>{title}</dt><dd>
        <strong data-label={item.status === "completed" ? item.label : "unavailable"}>{item.status === "completed" ? labels[item.label] || t("분석 완료") : kind === "laya" ? t("미적용") : t("분석 미완료")}</strong>
        {Number.isFinite(item.score) && <span title={item.score_kind === "calibrated_promotion_score" ? t("별도 검증 자료로 보정한 광고 문맥 점수입니다. 위법·안전 확률이 아닙니다.") : t("보정되지 않은 학습 모델의 분류 점수입니다. 확률이나 안전 점수가 아닙니다.")}>{t("모델 점수 {score}", { score: item.score.toFixed(3) })}</span>}
        {kind === "content_visual" && item.status === "completed" && <span>{[["sexual_content", t("성인물")], ["gambling", t("도박")], ["drugs", t("마약")]].filter(([topic]) => Number.isFinite(item.scores?.[topic])).map(([topic, name]) => `${name} ${item.scores[topic].toFixed(3)}`).join(" · ")}</span>}
      </dd></React.Fragment>;
    })}</dl>
    <details><summary>{t("분석 정보")}</summary>
      {Object.values(analysis).map((item, i) => <p key={i}>{item.model || item.message}{item.version ? ` · ${item.version}` : ""}{item.model && item.status !== "completed" && item.message ? ` · ${item.message}` : ""}</p>)}
      {analysis.text?.matched_features?.length > 0 && <p>{t("일치 특징:")} {analysis.text.matched_features.join(" · ")}</p>}
      <p>{t("로컬 처리 · API 사용 없음")}</p>
    </details>
  </section>;
}
