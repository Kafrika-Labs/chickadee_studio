# 탐지 회귀검증 데이터

[한국어](README.ko.md) | [English](README.md)

문자 위장·은닉 및 광고 문맥 분석을 재현하기 위한 데이터입니다. 원문 조각, 출처 URL, 정상 대조군과 사례별 관측 상태를 포함합니다.

| 자료 | 구성 |
| --- | --- |
| [문자·은닉 사례](ad-evidence/2026-10-19/) | 43건: 직접 관찰 38건·간접 문헌 5건 |
| [확장 사례](ad-evidence/2026-10-19-v4/) | 78건: 광고 의심 50건·정상 23건·간접 문헌 5건 |
| [문맥 분류 검증](ml-review/2026-10-21/) | 직접 관찰 73건의 분류 라벨·참조 예측값 |

확장 사례는 이전 자료를 포함합니다. 폴더별 건수를 합산하지 않습니다. `import-manifest.json`은 데이터 파일의 SHA-256을 기록하고, `sources.md`는 사례별 출처를 제공합니다. 실제 DOM 관측과 간접 문헌은 구분합니다. 이 자료의 분류 수치는 앱의 독립 평가 성능을 의미하지 않습니다.

```powershell
.\.venv\Scripts\python.exe scripts/validate_research.py
.\.venv\Scripts\python.exe -m unittest tests.test_research tests.test_ml_review
```
