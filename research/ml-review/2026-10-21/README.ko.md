# 광고 문맥 분류 회귀검증

[한국어](README.ko.md) | [English](README.md)

직접 관찰 73건(광고 의심 50건·정상 23건)의 정답 라벨과 참조 예측값을 제공합니다. 간접 문헌 5건은 분류 집계에서 제외합니다.

| 파일 | 내용 |
| --- | --- |
| `originals/metrics.json` | 참조 분류기의 지표와 입력 데이터 해시 |
| `originals/predictions.jsonl` | 사례별 라벨·참조 예측값 |
| `originals/bundled_inputs/` | 예측값과 대응하는 원문 데이터 |
| `import-manifest.json` | 원본 JSON·JSONL 파일의 SHA-256 |

동일 ID·원문·라벨이 대응하는지 검증하고 혼동행렬을 재계산합니다. 정적 원문 조각의 분류 비교이며, 렌더링된 DOM·CSS 탐지나 실사이트 성능 평가와 구분합니다.

```powershell
.\.venv\Scripts\python.exe scripts/compare_ml_review.py
.\.venv\Scripts\python.exe -m unittest tests.test_ml_review
```
