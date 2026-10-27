# 위장·은닉 광고 사례 데이터

[한국어](README.ko.md) | [English](README.md)

전체 43건: 직접 관찰 광고 의심 15건, 정상 대조군 23건, 간접 문헌 5건입니다.

- `samples.jsonl`: 광고 의심 사례 및 간접 문헌. `sample_origin`으로 구분합니다.
- `negatives.jsonl`: 정상 대조군.
- [sources.md](sources.ko.md): 사례별 공개 출처와 관측 상태.
- `import-manifest.json`: JSON·JSONL 데이터의 파일 크기와 SHA-256.

`dom_verified`는 HTML의 문자·요소·명시 스타일을 확인한 상태입니다. 렌더링된 계산 CSS·좌표를 측정했다는 뜻은 아닙니다. `visible_only`는 공개 텍스트 관측, `reported_only`는 간접 문헌입니다. 각 레코드의 관측 상태·출처 그룹·제외 사유를 함께 사용합니다.

정규화 전 원문을 유지하며, 실제 관측과 간접 문헌을 같은 정답으로 합치지 않습니다. 이 데이터는 앱 출력 `result.json`과 별도의 회귀검증 형식입니다.
