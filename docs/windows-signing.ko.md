# Windows 배포

[한국어](windows-signing.ko.md) | [English](windows-signing.md)

Windows x64 ZIP의 `Chickadee.exe`에는 치카비 캐릭터 아이콘을 적용합니다. Electron 공식 실행 파일에서 아이콘만 교체하며, 원본 런타임의 버전, 제작사 등 파일 속성은 유지합니다. 앱 화면의 이름, 로고, 디자인도 유지됩니다.

공식 배포 ZIP, 원본 실행 파일, 아이콘과 편집 도구의 SHA-256을 `desktop/vendor-runtime.json`에 고정합니다. 빌드마다 원본 PE와 실제 ASAR 헤더로 패키징 결과를 재구성해 검증합니다. 앱 아카이브와 최종 실행 파일의 해시는 `resources/runtime-provenance.json`에 기록하고 배포 ZIP 검증에서도 비교합니다. 패키징 도구가 넣는 ASAR 무결성 리소스는 보존합니다.

기본 패키지는 미서명입니다. 인증서 설치, Windows 보안 설정 변경이나 보호 기능 해제를 수행하지 않습니다. Windows의 실행 허용 여부는 해당 환경의 정책과 파일 평판에 따릅니다.

[빠른 실행](quickstart-windows.ko.md) ,  [최신 릴리스](https://github.com/Kafrika-Labs/chickadee_studio/releases/latest)
