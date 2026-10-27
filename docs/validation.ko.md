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
