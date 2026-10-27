// English text for main-process messages, keyed by the Korean source text.
module.exports = {
  // main.cjs
  "설정 형식이 올바르지 않습니다.": "Invalid settings format.",
  "검사 설정 값이 올바르지 않습니다.": "Invalid scan settings.",
  "허용되지 않은 앱 요청입니다.": "This app request is not allowed.",
  "진행 중인 검사·AI 검토를 중단한 뒤 재실행하세요.": "Stop the running scan or AI review, then restart.",
  "잘못된 주소입니다.": "Invalid address.",
  "웹 주소만 열 수 있습니다.": "Only web addresses can be opened.",
  "운영체제 설정에서 알림을 확인하세요.": "Check notifications in your system settings.",
  "Chickadee · 로그인 필요": "Chickadee · Sign-in required",
  "검사를 일시 중지했습니다. 앱에서 로그인 창을 열어 주세요.": "Scan paused. Open the sign-in window from the app.",
  "검사 설정이 필요합니다.": "Scan settings are required.",
  "검토 항목이 필요합니다.": "Review items are required.",
  "검사 결과 불러오기": "Open scan results",
  "검사 기록을 찾을 수 없습니다.": "Scan history entry not found.",
  "검사 완료 후 리포트를 저장하세요.": "Save the report after the scan finishes.",
  "저장할 리포트가 없습니다.": "There is no report to save.",
  "HTML 리포트": "HTML report",
  "복사할 내용이 너무 큽니다.": "The content is too large to copy.",
  "워크플로 형식이 올바르지 않습니다.": "Invalid workflow format.",
  "구성 형식이 올바르지 않습니다.": "Invalid configuration format.",
  "검사 구성": "Scan configuration",
  "워크플로 JSON 불러오기": "Import workflow JSON",
  "워크플로는 100KB 이하여야 합니다.": "Workflows must be 100 KB or smaller.",
  "Groq 설정 파일": "Groq settings file",
  "지정한 파일의 GROQ_API_KEY를 확인하세요. 기본 OCR·ML 검사는 계속 사용할 수 있습니다.":
    "Check GROQ_API_KEY in the specified file. Standard OCR and ML scans remain available.",

  // backend.cjs
  "엔진 응답을 읽지 못했습니다: {error}": "Could not read the engine response: {error}",
  "검사 엔진을 시작하지 못했습니다: {error}": "Could not start the scan engine: {error}",
  "검사 엔진 종료 ({code}). {stderr}": "Scan engine exited ({code}). {stderr}",
  "검사 엔진에 연결되지 않았습니다.": "Not connected to the scan engine.",
  "엔진 응답 시간이 초과되었습니다.": "The engine response timed out.",

  // groq-env.cjs
  "Groq 설정 파일 경로가 필요합니다.": "A Groq settings file path is required.",
  "Groq 설정 파일을 읽을 수 없습니다.": "Cannot read the Groq settings file.",
  "Groq 설정 파일 크기를 확인하세요.": "Check the Groq settings file size.",
  "GROQ_API_KEY 값을 확인하세요.": "Check the GROQ_API_KEY value.",
  "GROQ_API_KEY를 한 번만 지정하세요.": "Specify GROQ_API_KEY only once.",

  // login.cjs
  "웹 로그인 주소만 열 수 있습니다.": "Only web sign-in addresses can be opened.",
  "사이트 로그인 · 완료 후 Chickadee에서 검사 재개": "Site sign-in · Resume the scan in Chickadee when done",
  "로그인 페이지를 열지 못했습니다. 로그인 창에서 연결 상태를 확인하세요.":
    "Could not open the sign-in page. Check the connection in the sign-in window.",
  "먼저 로그인 창을 열어 로그인해 주세요.": "Open the sign-in window and sign in first.",

  // native-notification.cjs
  "운영체제에서 알림을 표시하지 못했습니다. 시스템 알림 설정에서 Chickadee 허용 여부를 확인하세요.":
    "The system could not show the notification. Check that Chickadee is allowed in your system notification settings.",
  "시스템 알림 요청에 실패했습니다. 앱을 재시작하고 알림 권한을 확인하세요.":
    "The system notification request failed. Restart the app and check notification permissions.",

  // notifications.cjs
  "웹훅 URL 형식을 확인하세요.": "Check the webhook URL format.",
  "Slack 또는 Discord의 공식 HTTPS 웹훅 URL을 입력하세요.": "Enter an official Slack or Discord HTTPS webhook URL.",
  "완료": "completed",
  "일부 완료": "partially completed",
  "중단": "cancelled",
  "실패": "failed",
  "Chickadee 검사 {status}\n방문 {pages}개 · 필수 탐지 {findings}건 · 광고 의심 {ads}건\n상세 결과는 Chickadee의 검사 기록에서 확인하세요.":
    "Chickadee scan {status}\nPages visited: {pages} · Required detections: {findings} · Suspected ads: {ads}\nSee scan history in Chickadee for details.",
  "알림 설정 형식 오류": "Invalid notification settings format.",
  "운영체제 보안 저장소를 사용할 수 없어 웹훅을 저장하지 못했습니다.":
    "Could not save the webhook because the system's secure storage is unavailable.",
  "{provider} 웹훅을 먼저 등록하세요.": "Add a {provider} webhook first.",
  "이 환경은 데스크톱 알림을 지원하지 않습니다.": "Desktop notifications are not supported in this environment.",
  "Chickadee 테스트 알림": "Chickadee test notification",
  "검사 완료 알림이 이곳에 표시됩니다.": "Scan completion notifications will appear here.",
  "Chickadee 검사 결과": "Chickadee scan results",
  "전송 완료": "Sent",
  "전송 실패 (HTTP {status})": "Delivery failed (HTTP {status})",
  "전송 실패: 웹훅 설정 또는 네트워크를 확인하세요.": "Delivery failed. Check the webhook settings or network.",

  // schedules.cjs
  "반복 주기를 선택하세요.": "Select a repeat interval.",
  "예약 이름을 80자 이내로 입력하세요.": "Enter a schedule name of up to 80 characters.",
  "실행 시간을 입력하세요.": "Enter a run time.",
  "반복 요일을 선택하세요.": "Select the days to repeat.",
  "실행 날짜를 입력하세요.": "Enter a run date.",
  "실행 날짜가 올바르지 않습니다.": "Invalid run date.",
  "검사 대상 URL을 입력하세요.": "Enter a URL to scan.",
  "http 또는 https 주소를 입력하세요.": "Enter an http or https address.",
  "최대 페이지와 제한시간을 확인하세요.": "Check the maximum pages and time limit.",
  "검사 설정이 올바르지 않습니다.": "Invalid scan settings.",
  "검사 구성이 필요합니다.": "A scan configuration is required.",
  "탐색 대기 시간은 0~30초로 설정하세요.": "Set the crawl delay between 0 and 30 seconds.",
  "예약 저장 파일이 올바르지 않습니다.": "The scheduled scans file is invalid.",
  "예약을 찾을 수 없습니다.": "Scheduled scan not found.",
  "현재 시간 이후로 예약하세요.": "Schedule a time in the future.",
  "예약은 최대 50개까지 등록할 수 있습니다.": "You can add up to 50 scheduled scans.",
  "앱 종료·절전 등으로 예약 시간을 놓쳤습니다.": "Missed the scheduled time because the app was closed or the computer was asleep.",
  "실행 요청 처리 중": "Processing run request",
  "다른 검사 또는 AI 검토가 실행 중이라 건너뛰었습니다.": "Skipped because another scan or AI review was running.",
  "검사를 시작했습니다. 결과는 검사 기록에서 확인하세요.": "Scan started. See scan history for results.",
  "검사를 시작하지 못했습니다. 대상과 검사 구성을 확인하세요.":
    "Could not start the scan. Check the target and scan configuration.",

  // updates.cjs
  "업데이트 요청이 많습니다. 잠시 후 다시 확인해 주세요.": "Too many update requests. Check again later.",
  "릴리스 파일을 가져오지 못했습니다. 다시 시도해 주세요.": "Could not fetch release files. Try again.",
  "릴리스 정보를 확인할 수 없습니다.": "Cannot read release information.",
  "이 운영체제에 맞는 업데이트 파일이 없습니다.": "No update file is available for this operating system.",
  "체크섬 파일을 확인할 수 없습니다.": "Cannot verify the checksum file.",
  "다운로드 응답이 비어 있습니다.": "The download response is empty.",
  "업데이트 파일 크기가 올바르지 않습니다.": "The update file size is invalid.",
  "파일 검증에 실패했습니다. 다시 다운로드해 주세요.": "File verification failed. Download it again.",
  "먼저 업데이트를 다운로드하세요.": "Download the update first.",
};
