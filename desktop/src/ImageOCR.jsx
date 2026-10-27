import React, { useState } from "react";
import { t } from "./i18n.mjs";

export default function ImageOCR({ image }) {
  const [selected, setSelected] = useState(-1);
  if (!image) return null;
  const source = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image.preview_data_url || "") && image.preview_data_url.length < 270000 ? image.preview_data_url : null;
  return <section className="image-ocr-evidence" aria-label={t("이미지 OCR 근거")}>
    <label>{t("이미지 OCR")}</label>
    {source && <div className="image-ocr-preview">
      <img src={source} alt={t("OCR로 검사한 게시글 이미지")} />
      <svg viewBox={`0 0 ${image.width} ${image.height}`} aria-hidden="true">
        {(image.lines || []).map((line, index) => <polygon key={index} points={line.box.map(([x, y]) => `${x},${y}`).join(" ")} className={selected === index ? "selected" : ""} />)}
      </svg>
    </div>}
    {image.message && <p role="status">{image.message}</p>}
    <div className="image-ocr-lines">{(image.lines || []).map((line, index) => <button type="button" key={index} aria-pressed={selected === index} onClick={() => setSelected(index)}>
      <span>{line.text}</span><small>{Math.round(line.confidence * 100)}%</small>
    </button>)}</div>
    <details><summary>{t("이미지 정보")}</summary><p>{image.source_url}</p><p>{image.model} · {image.width} × {image.height}</p><p className="mono">SHA-256 {image.image_sha256}</p>
      {image.occurrences?.length > 1 && <details><summary>{t("발견 위치 {count}곳", { count: image.occurrences.length })}</summary>{image.occurrences.map((item,index)=><p key={index}>{item.url}<br />{item.location}</p>)}</details>}
    </details>
  </section>;
}
