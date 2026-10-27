import React from 'react';
import { modelStatistics } from './model-statistics.mjs';
import { t } from './i18n.mjs';

function Bars({ values, labels }) {
  const maximum = Math.max(1, ...values);
  return <div className="model-stat-bars" role="img" aria-label={labels.map((label, i) => t("{label} {count}개", { label, count: values[i] })).join(', ')}>
    {values.map((value, i) => <div key={labels[i]} title={t("{label}: {count}개", { label: labels[i], count: value })}><span>{value}</span><i style={{ height: `${Math.max(value ? 4 : 1, value / maximum * 36)}px` }} /><small>{labels[i]}</small></div>)}
  </div>;
}
export default function ModelStatistics({ data }) {
  const stats = modelStatistics(data), bands = ['0~0.2', '0.2~0.4', '0.4~0.6', '0.6~0.8', '0.8~1'];
  return <section className="model-statistics" aria-label={t("모델 처리 통계")}>
    <header><strong>{t("이번 검사 통계")}</strong><span>{t("실제 처리 건수와 저장된 분석 점수")}</span></header>
    <div className="model-statistics-scroll"><table><thead><tr><th>{t("기능")}</th><th>{t("상태")}</th><th>{t("처리")}</th><th>{t("분포")}</th></tr></thead><tbody>
      <tr><th>ML</th><td>{stats.ml.analyzed ? t("적용") : t("입력 없음")}</td><td>{t("{count}개 영역", { count: stats.ml.analyzed.toLocaleString() })}</td><td>{stats.ml.samples ? <Bars values={stats.ml.bins} labels={bands} /> : t("점수 없음")}</td></tr>
      <tr><th>Laya</th><td>{stats.laya.status}</td><td>{t("{count}개 영역", { count: stats.laya.analyzed.toLocaleString() })}</td><td>{stats.laya.samples ? <Bars values={stats.laya.bins} labels={bands} /> : t("적용된 분석 결과 없음")}</td></tr>
      <tr><th>OCR</th><td>{stats.ocr.status}</td><td>{t("{done} / {total}개 이미지 영역", { done: stats.ocr.analyzed.toLocaleString(), total: stats.ocr.total.toLocaleString() })}</td><td>{stats.ocr.total ? <Bars values={stats.ocr.values} labels={[t("문자 인식"), t("읽기 어려움"), t("오류"), t("생략")]} /> : t("이미지 없음")}</td></tr>
    </tbody></table></div>
    <p>{t("ML과 Laya의 점수는 모델의 분류 점수입니다. 정확도나 위법 확률이 아닙니다. OCR은 이미지에서 글자를 읽은 결과입니다.")}</p>
  </section>;
}
