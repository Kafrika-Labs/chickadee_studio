# 테스트 안내

[한국어](validation.ko.md) | [English](validation.md)

빌드·검증 결과는 [GitHub Actions](https://github.com/Kafrika-Labs/chickadee_studio/actions)와 [릴리스](https://github.com/Kafrika-Labs/chickadee_studio/releases)에서 확인합니다. 아래 명령은 저장소 루트 기준입니다.

## Python

Windows에서는 모듈별 로그를 남기는 실행기를 사용합니다.

```powershell
./scripts/test-python.ps1
```

다른 환경에서는 다음과 같이 실행합니다.

```sh
.venv/bin/python -m unittest discover -s tests -v
```

## 화면·실행본

```sh
npm --prefix desktop test
npm --prefix desktop run build
npm --prefix desktop run smoke
```

패키지 자체를 시험하려면 `CHICKADEE_PACKAGED_EXE`에 실행 파일 경로를 지정합니다. 다음 통합 시험은 실제 앱과 로컬 테스트 사이트를 사용합니다.

```powershell
$env:CHICKADEE_PACKAGED_EXE = 'C:\배포본\Chickadee.exe'
node desktop/tests/smoke.cjs
node desktop/tests/inspection-smoke.cjs
node desktop/tests/ocr-smoke.cjs
node desktop/tests/runtime-smoke.cjs
node desktop/tests/login-smoke.cjs
```

| 영역 | 확인 항목 |
| --- | --- |
| 필수 탐지 | 문자 위장·자모·투명·화면 밖 은닉, 원문·선택자, 중첩 기법 |
| 탐색·로그인 | 게시글·iframe·동적 동작, 인증 대기·재개·건너뛰기, 오류·시간 제한 |
| OCR·로컬 AI | 한국어 이미지 문자·좌표·신뢰도, 판독 실패·생략·취소, 입력 출처 분리 |
| 결과·검토 | JSON 스키마·UTF-8·CSV 칼럼, 기록 재열기, 검토·메모·해시 |
| AI 검토 | 도구 권한, 사용량·방문 한도, 잘못된 응답·오류·취소 처리 |
| 앱 | 설정·예약·알림, 실행 모드, 키보드 조작, 재시작 |

기본 회귀 시험은 유료 AI를 호출하지 않습니다. 실제 Groq 검증은 [AI 검토 문서](inspection-agent.ko.md)의 별도 명령을 명시적으로 실행할 때만 수행합니다.
## 독립 한국어 평가

평가 명령은 앱 모델을 교체하거나 외부 AI를 호출하지 않습니다.

```powershell
.venv\Scripts\python.exe -m chickadee.independent_evaluation training-local\independent\samples.jsonl --output artifacts\independent-evaluation --images --laya
```

JSONL 항목 예시:

```json
{"id":"ko-001","split":"test","language":"ko","origin":"real","source_group":"독립-수집-캠페인","capture_group":"동일-캡처-묶음","is_ad":true,"text":"검수한 광고 원문","topics":["gambling"],"image":"images/001.png","sha256":"이미지 파일 SHA256","transcription":"이미지 속 한국어 정답 전사"}
```

- 분할: `train` 또는 `validation` 또는 `test`
- 동일 출처와 캡처 그룹의 분할 교차 차단
- 동일 문구와 동일 이미지의 분할 교차 차단
- 유사 이미지 해시가 가까우면 수동 확인 전 평가 중단
- 기존 학습과 모델 선택에 사용한 자료는 `test`로 재사용하지 않음
- 원본 이미지와 목록은 Git에서 제외한 `training-local`에 보관
- 샘플마다 `predictions.jsonl` 저장
- 결과 지표는 `metrics.json` 저장
- RF와 Laya의 광고 문맥 정밀도와 재현율 비교
- OCR 문자 오류율과 처리 실패 건수 분리
- 사진 분류는 성인물과 도박과 마약의 혼동 행렬 구분
- 양성과 음성이 각각 5개 미만이면 평가 자료 부족 표시
- 모델 미실행과 점수 없는 항목은 누락으로 표시
- 이 도구의 추가만으로 한국어 실측 성능이 개선됐다고 판단하지 않음
