import React, { useEffect, useRef } from 'react';
import { CircleAlert, X } from 'lucide-react';
import { t } from './i18n.mjs';

export default function ScanFailureDialog({ outcome, onClose }) {
  const dialog = useRef(null);
  const report = outcome.report || {};
  const pages = (report.page_diagnostics || []).filter(page => page.error || page.status === 'error' || page.http_status >= 400);
  const errors = (report.errors || []).filter(error => !pages.some(page => page.url === error.url && page.error === error.message));
  const forbidden = pages.some(page => page.http_status === 403);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="scan-failure-dialog" aria-labelledby="scan-failure-title" onCancel={onClose}>
    <header><CircleAlert size={18} aria-hidden="true" /><h2 id="scan-failure-title">{t('실패 이유')}</h2><button type="button" onClick={onClose} aria-label={t('닫기')}><X size={18} /></button></header>
    <div className="scan-failure-body">
      <p>{forbidden ? t('사이트가 검사 요청을 거부했습니다 (HTTP 403). 사이트의 접근 권한 또는 WAF 허용 설정을 확인하세요.') : t('저장된 검사 기록에서 확인된 오류입니다.')}</p>
      {!pages.length && !errors.length && <p>{t('이 기록에는 자세한 실패 원인이 저장되어 있지 않습니다.')}</p>}
      <ul>{pages.map((page, index) => <li key={`page-${index}`}><strong>{page.error || (page.http_status ? `HTTP ${page.http_status}` : t('검사 실패'))}</strong><span>{page.url}</span>{page.title && <small>{page.title}</small>}</li>)}
        {errors.map((error, index) => <li key={`error-${index}`}><strong>{error.message || String(error)}</strong>{error.url && <span>{error.url}</span>}</li>)}
      </ul>
    </div>
  </dialog>;
}
