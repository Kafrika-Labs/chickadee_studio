import React, { useState } from 'react';
import { t, language, LANGUAGES } from './i18n.mjs';
import RuntimeSettings from './RuntimeSettings.jsx';
const api = window.chickadee;
export default function GeneralSettings({ value, onSave, running, action, tell, Button, ActionMenu, Icon }) {
  const [maxPages,setMaxPages]=useState(value.maxPages), [timeout,setTimeoutValue]=useState(value.timeout), [profile,setProfile]=useState(value.profile), [livePreview,setLivePreview]=useState(value.livePreview), [scanInterval,setScanInterval]=useState(value.scanInterval), [outputRoot,setOutputRoot]=useState(value.outputRoot), [draftLanguage,setDraftLanguage]=useState(language()), [generalSettingsSaving,setGeneralSettingsSaving]=useState(false);
return <>
            <div className="settings-field">
              <span>{t("언어")}</span>
              <ActionMenu
                className="profile-menu language-menu"
                label={t("언어")}
                triggerText={LANGUAGES.find((entry) => entry.id === draftLanguage)?.label}
                items={LANGUAGES.map(({ id, label }) => ({
                  label, selected: draftLanguage === id,
                  action: () => setDraftLanguage(id),
                }))}
              />
            </div>
            <RuntimeSettings disabled={running} />
            <div className="settings-field">
              <span>{t("사이트 탐색 설정")}</span>
              <ActionMenu
                className="profile-menu"
                label={t("사이트 탐색 설정")}
                disabled={running}
                triggerText={{
                  default: t("기본 탐색 · 같은 사이트 전체"),
                  test: t("사용자 모의 게시판 · .post-detail 본문"),
                  public: t("공공 사이트 기본 설정"),
                }[profile]}
                items={[
                  ["default", t("기본 탐색 · 같은 사이트 전체")],
                  ["test", t("사용자 모의 게시판 · .post-detail 본문")],
                  ["public", t("공공 사이트 기본 설정")],
                ].map(([id, label]) => ({
                  label, selected: profile === id, disabled: running,
                  action: () => setProfile(id),
                }))}
              />
            </div>
            <div className="form-row">
              <label>
                {t("최대 페이지")}
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={maxPages}
                  disabled={running}
                  onChange={(event) => setMaxPages(event.target.value)}
                />
              </label>
              <label>
                {t("전체 제한시간 (초)")}
                <input
                  type="number"
                  min="1"
                  max="1800"
                  value={timeout}
                  disabled={running}
                  onChange={(event) => setTimeoutValue(event.target.value)}
                />
              </label>
            </div>
            <div className="scan-pace">
              <div className="scan-pace-heading"><strong>{t("탐색 속도")}</strong><span>{t("{seconds}초 간격", { seconds: scanInterval })}</span></div>
              <div className="scan-pace-options" role="group" aria-label={t("탐색 속도")}>{[[0, t("빠르게"), t("대기 없이 탐색")], [0.5, t("보통"), t("기본 속도")], [5, t("천천히"), t("다른 작업과 함께")]].map(([value, label, hint]) => <button key={value} type="button" disabled={running} aria-pressed={scanInterval === value} onClick={() => setScanInterval(value)}><strong>{label}</strong><small>{hint}</small></button>)}</div>
              <label>{t("페이지 사이 대기 시간")}<input aria-label={t("페이지 사이 대기 시간")} type="range" min="0" max="30" step="0.5" value={scanInterval} disabled={running} onChange={event => setScanInterval(Number(event.target.value))} /></label>
              <p>{t("다음 페이지로 이동하기 전 기다리는 시간입니다. 천천히 검사할 때는 전체 제한시간도 늘려 주세요. 검사 중인 페이지의 처리 속도는 유지됩니다.")}</p>
            </div>
            <label className="toggle-label">
              <div>
                <strong>{t("실시간 브라우저 화면")}</strong>
                <small>{t("검사 중인 페이지를 미리보기로 표시합니다.")}</small>
              </div>
              <input
                type="checkbox"
                checked={livePreview}
                disabled={running}
                onChange={(event) => setLivePreview(event.target.checked)}
              />
            </label>
            <label>
              {t("결과 저장 위치")}
              <div className="folder-input">
                <span title={outputRoot}>{outputRoot}</span>
                <button
                  type="button"
                  className="folder-change-icon"
                  aria-label={t("결과 저장 위치 변경")}
                  title={t("결과 저장 위치 변경")}
                  disabled={running}
                  onClick={() =>
                    action(async () => setOutputRoot((await api.chooseFolder({ draft: true })) || outputRoot))
                  }
                >
                  <Icon name="FolderOpen" size={18} />
                </button>
              </div>
            </label>
            <p className="settings-folder-hint">{t("각 검사는 별도 폴더에 저장됩니다.")}</p>
            <div className="general-settings-save">
              <p>{t("저장을 눌러 변경 사항을 적용하세요.")}</p>
              <Button icon="Save" disabled={running || generalSettingsSaving || !Number.isInteger(Number(maxPages)) || Number(maxPages) < 1 || Number(maxPages) > 10000 || !Number.isFinite(Number(timeout)) || Number(timeout) <= 0 || Number(timeout) > 1800}
                aria-label={t("일반 설정 저장")} onClick={() => action(async () => {
                  setGeneralSettingsSaving(true);
                  try {
                    await onSave({maxPages:Number(maxPages), timeout:Number(timeout), profile, livePreview, scanInterval, outputRoot, language:draftLanguage});
                    tell(t("일반 설정을 저장했습니다."), "success");
                  } finally { setGeneralSettingsSaving(false); }
                })}>{generalSettingsSaving ? t("저장 중…") : t("설정 저장")}</Button>
            </div>
            </>;
}
