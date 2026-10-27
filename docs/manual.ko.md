# 실행·빌드 및 사용설명서

[한국어](manual.ko.md) | [English](manual.md)

> 이 문서는 Python CLI·Tkinter 호환판 기준입니다. 현재 Windows Electron 앱은 [빠른 실행](quickstart-windows.ko.md)과 [데스크톱 앱 안내](desktop.ko.md)를 참고하세요.

**결과 저장 위치:** 실행 파일 옆 `results` 폴더에 `result.json`, `result_extra.json`, `scan-report.json`, `result.csv`를 저장합니다. 소스 실행은 저장소의 `results`가 기본값입니다. 화면의 **저장 폴더 설정** 또는 `--output-dir`로 바꿀 수 있습니다. 파일은 실행 종료 시 교체됩니다. 일반 광고 문맥 검토 관측값은 `result_extra.json`, 보고서 `ad_candidates`, CSV에 담으며 불법 확정으로 바꾸지 않습니다. 현재 Electron 앱은 기본적으로 `문서/Chickadee/results/<실행별 폴더>`에 저장합니다. [고정 17개 칼럼](result-format.ko.md)과 [빠른 실행](quickstart-windows.ko.md)을 참고하세요.

## Windows 실행 파일 사용

1. `dist/ChickadeeBot` **폴더 전체**를 쓰기 가능한 폴더로 복사하거나 배포 압축 파일을 해제합니다. `_internal` 폴더도 필요합니다.
2. `ChickadeeBot.exe`를 실행합니다. Python 설치·API 키·GPU는 필요하지 않습니다. 브라우저 엔진은 패키지에 포함됩니다.
3. **로컬 데모 준비**를 누르고 **탐지 시작**을 누르면 가상 사이트를 점검합니다.
4. 외부 사이트는 URL을 입력하고 **점검 시작**을 누릅니다. 별도 옵션이나 VM 설치는 필요하지 않습니다.
5. 결과 행을 선택하면 원문·페이지 URL·요소 선택자를 확인할 수 있습니다. 오른쪽 유형 필터로 목록을 좁힐 수 있습니다.
6. 완료 상태와 저장 안내를 확인하고 `result.json`을 사용합니다. **일부 결과·중단·실패** 상태에서는 `scan-report.json`의 누락·오류를 확인하세요.

기본값은 화면에서 최대 100페이지(CLI는 50), 웹 수집 300초, 페이지당 15초, 렌더링 대기 500ms, 페이지 사이 1초, 재시도 1회입니다. DOM 스냅샷을 스크롤·읽기 동작 전후로 검사합니다. 설정 가능한 웹 수집 제한시간은 최대 1800초입니다. 수집한 자료의 로컬 분석은 별도의 최대 30분 안에서 이어집니다. 분석 중에도 중단할 수 있으며 수집된 결과를 저장합니다. 브라우저 정리와 디스크 쓰기에 추가 시간이 걸릴 수 있습니다. `elapsed_sec`는 브라우저 준비·탐색·로컬 분석·정리까지 측정하며 결과 파일을 쓰는 시간은 포함하지 않습니다.

## 소스에서 실행

검증 환경은 Windows 11 x64, Python 3.12입니다. 아래 명령은 저장소 폴더의 PowerShell에서 실행합니다.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
.\.venv\Scripts\python.exe -m playwright install chromium --only-shell
.\.venv\Scripts\python.exe -m chickadee --demo
```

`py`가 없으면 설치된 Python 3.12 실행 파일의 경로로 첫 명령을 바꿉니다. 가상환경 활성화 스크립트 실행은 필요하지 않습니다. 브라우저 설치는 최초 한 번 필요하며 실행 중에는 사용자의 Chrome 프로필이나 탭을 사용하지 않습니다.

화면 없이 점검할 수도 있습니다.

```powershell
# 로컬 데모: 가상 사이트 시작 -> 점검 -> 결과 저장 -> 사이트 종료
.\.venv\Scripts\python.exe -m chickadee --demo --cli --output-dir artifacts/demo

# 실제 입력 URL 점검
.\.venv\Scripts\python.exe -m chickadee --scan 'https://www.korea.kr/' --network --profile profiles/public-site.json --max-pages 3 --timeout 120 --interval 2 --output-dir artifacts/scan
```

CLI 종료 코드는 완료 `0`, 일부 결과·중단 `2`, 실패 `1`입니다. 배포 실행 파일도 같은 인자를 지원하지만 콘솔 창이 없는 빌드이므로 결과 파일·실행 보고서로 확인합니다. 입력 오류로 실행되지 않으면 새 결과 파일은 생성하지 않습니다.

## 실행 경계와 사이트별 설정

기본 실행은 외부 URL을 허용합니다. `--network`는 기존 명령과의 호환성을 위해 유지하며, `--local-only`를 지정하면 loopback 주소만 허용합니다. 검사 요청은 입력 origin과 `allowed_resource_origins`로 제한합니다. 미디어·폰트, WebSocket, GET/HEAD 이외의 요청을 차단합니다. 브라우저 프로필은 임시이고 서비스 워커·다운로드 수락을 끕니다. 이는 애플리케이션 수준의 요청 정책이며 OS/VM 네트워크 격리를 대신하지 않습니다. 브라우저 취약점·스크립트의 모든 부수 효과까지 막는 보장은 하지 않습니다.

외부 CSS·스크립트·iframe이 차단되면 콘텐츠가 누락될 수 있어 `partial`로 기록합니다. 차단 내역을 검토하고 필요한 origin만 설정에 추가하세요. 인증서 오류는 무시하지 않습니다. 데이터가 바뀌는 GET 요청이나 버튼의 부수 효과는 요청 메서드만으로 완전히 판별할 수 없으므로 읽기 동작은 확인한 선택자만 설정합니다.

`--profile profiles/public-site.json`은 기본 사이트 설정입니다. `profiles/read-controls.example.json`은 실제 선택자로 수정해야 하는 예시입니다.

- `path_prefix`: 링크 탐색 경로 범위. 쿼리 값은 보존합니다.
- `controls`: 명시적으로 확인한 댓글 더보기·다음 페이지 등의 CSS 선택자. 한 요소에만 일치해야 합니다.
- `max_actions`: 읽기 동작 상한(0~30). 폼 제출 컨트롤은 거부합니다.
- `scroll_steps`: 스크롤 점검 상한(0~20). 콘텐츠가 계속 바뀌면 한도 도달을 보고합니다.
- `allowed_resource_origins`: 필요한 외부 리소스 origin 배열. 기본값은 빈 배열입니다.
- `content_selector`: 선택한 본문 안에서만 판정합니다. 해당 요소가 없는 목록 페이지도 링크는 수집합니다. 기본값 null은 전체 본문입니다. 사용자 제공 테스트 게시판에는 `profiles/inuri-test.json`을 사용합니다.

설정한 읽기 버튼은 DOM/URL이 바뀐 뒤 다시 검사합니다. POST 기반 댓글 API는 차단되므로 별도 지원 전에는 수집할 수 없습니다. 임의의 JavaScript나 Python을 설정 파일에 넣어 실행하는 기능은 없습니다.

`--rules chickadee/rules.json`으로 탐지 사전을 교체합니다. `version`, `keywords`, `prevention`, `promotion` 배열 형식은 기본 파일을 참고하세요. 키워드 변형과 원문 위치를 함께 추적하고 원문은 정규화하지 않은 상태로 출력합니다.

키워드가 짧아도 근접한 문장에 `promotion` 권유 신호가 필요합니다. `prevention`은 예방·기사 비판·일부 정상 상품 문맥의 제외어입니다. 기본 사전은 `ㅋr지노`·`ㅂr카라`와 부분 자모를 처리하며, 같은 근접 문장의 광고 근거가 있을 때만 닮은꼴 `CΟΜ`·`сом`을 추가 근거로 기록합니다. textarea 편집 버퍼는 텍스트 수집에서 제외합니다. 데이터 출처는 [연구 자료](../research/README.ko.md)에 정리했습니다.

HTTP 429를 페이지나 비동기 응답에서 받으면 해당 origin의 재시도·새 요청과 후속 페이지 수집을 중단합니다. `--retries`를 높여도 429에는 재시도하지 않습니다. 보고서 `stopped_origins`에 원인 URL·Retry-After 원문·정책을 기록하며 일부 결과/실패로 표시합니다. 이미 출발한 요청을 취소한다는 보장은 없습니다. 다시 실행하려면 서버가 요청한 대기와 접근 정책을 먼저 확인하세요.

화면의 **결과 불러오기**는 웹에 접속하지 않고 로컬 JSON만 읽습니다. 결과는 표준 스키마·중복 검사를 거치고, 함께 가져온 보고서의 SHA-256이 다르면 거부합니다. 보고서 없는 표준 결과도 열 수 있지만 실행 완료 여부를 확인할 수 없다고 표시합니다. 파일당 20MB를 넘으면 거부합니다.

## 출력 파일 해석

게시글의 PNG·JPEG·WebP·GIF와 CSS 배경 이미지는 PaddleOCR로 한국어 글자를 읽습니다. **광고 의심**에서 항목을 선택하면 이미지와 글자 위치, 문구별 신뢰도를 확인할 수 있습니다. 문구를 누르면 해당 위치가 강조됩니다. 검사 기록에서도 같은 근거를 열 수 있습니다.

OCR은 CPU에서 실행하며 모델은 Windows 배포본에 포함됩니다. 별도 API 키나 유료 OCR 서비스가 필요하지 않습니다. 소스 실행에서는 의존성을 설치한 뒤 `python scripts/prepare_ocr_models.py`로 고정된 공식 모델을 준비하세요.

`scan-report.json`의 `ocr_images`에 원문·좌표·신뢰도·원본 해시가, `ocr_summary`에 처리 건수가 저장됩니다. 원본은 `evidence/images/`에 저장합니다. 이미지 광고는 `ad_candidates`에 `source_kind=image_ocr`, `image_id`와 함께 기록하며 CSV의 기존 칼럼을 사용합니다.

- `result.json`: 문자 위장·은닉 4종 결과만 담습니다. UTF-8(BOM 없음), 최상위 `meta`, `findings` 구조입니다. 0건도 빈 배열을 저장합니다.
- `scan-report.json`: `completed`, `partial`, `cancelled`, `failed` 상태, 점검한 페이지, 남은 페이지 수, 누락·오류, 실행 제한과 출력 경로를 담습니다.
- `evidence_details`: 항목별 일치 키워드·원문 위치, CSS 값·판정 이유, 프레임 상속 상태와 읽기 동작 기록입니다. `rules_version`, `profile`, `retry_count`, `blocked_requests`도 보고서에 기록합니다.
- `contextual_homoglyphs`: 키워드 자체의 변형과 구분한 문맥 내 닮은꼴 COM의 원문·span입니다. CSS 근거에는 viewport·문서 좌표·스크롤 위치와 은닉에 기여한 조상 스타일을 기록합니다. 작은 상자와 글자 크기를 구분하고 opacity:0.003 같은 실측 값은 그대로 유지합니다.
- 보고서의 `result_sha256`이 `result.json` 바이트의 SHA-256과 일치하면 같은 실행의 파일 쌍입니다. 쓰기 도중 장애가 나면 파일 쌍이 맞지 않을 수 있습니다.
- `is_violation: true`는 규칙에 걸린 의심 항목을 뜻합니다. 법적 판단을 대신하지 않습니다.
- iframe 선택자의 `src`는 절대주소로 기록합니다. 상대주소 iframe을 재조회할 때는 실제 `src` 속성도 절대주소로 해석하여 비교해야 합니다.

폴더 쓰기 권한이 없거나 디스크가 가득 차면 화면에 저장 실패를 표시합니다. 이전 파일을 이번 실행 결과로 사용하지 마세요. 새 실행 전 파일은 자동 삭제하지 않으며 정상 또는 일부 결과를 저장할 때 교체합니다.

## 테스트와 Windows 빌드

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1
```

결과는 `dist/ChickadeeBot/ChickadeeBot.exe`입니다. 빌드는 Windows에서 수행하며 전체 폴더를 전달해야 합니다. 최초 브라우저 설치·빌드에는 네트워크 연결이 필요합니다. PyInstaller는 설치된 Playwright의 브라우저 파일을 수집하므로 다른 브라우저까지 추가 설치한 개발 환경에서는 패키지가 커질 수 있습니다.

실행 파일 확인 예시:

```powershell
$taskRun = Start-Process -FilePath '.\dist\ChickadeeBot\ChickadeeBot.exe' -ArgumentList '--demo --cli --output-dir artifacts/frozen-demo' -WindowStyle Hidden -Wait -PassThru
$taskRun.ExitCode
Get-Content artifacts/frozen-demo/scan-report.json
```
