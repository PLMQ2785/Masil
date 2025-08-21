# Senior Job Recommendation AI Pipeline

이 프로젝트는 시니어 맞춤형 일자리 추천을 위한 두 단계 AI 파이프라인입니다.  
단계는 **Producer (AI-1)** → **Consumer (AI-2)** 순서이며, 각각 독립 실행이 가능하고 `orchestrator.py`로 한 번에 실행할 수 있습니다.

---

## 폴더 구조

```text
.
├─ ai_1_producer.py            # AI-1 Producer: 후보(factpack) 보강 및 Top-N 선정
├─ ai_2_consumer.py            # AI-2 Consumer: 보강 데이터 기반 추천 이유(explain) 생성
├─ orchestrator.py             # Producer → Consumer 순차 실행 스크립트
├─ sample/                     # 샘플 입력/출력 데이터
│  ├─ be_input.json            # BE에서 전달받는 후보 데이터 예시
│  ├─ ai_1_output.json         # (예시) Producer 출력
│  └─ explain.json             # (예시) Consumer 최종 출력
├─ senior_work_with_embeddings.csv  # 시니어 일자리 + 임베딩 데이터
├─ factpack_top10.json         # Top-10 후보 데이터 샘플
├─ factpack_enriched.json      # Producer 처리 후 보강된 데이터 샘플
└─ README.md                   # 프로젝트 개요 및 실행 방법

주요 스크립트
ai_1_producer.py (Producer)

입력: factpack JSON (Top-K 후보)

처리: 유사도/시간겹침/이동시간/임금 표준화 계산, 후보 Top-N 축약 및 보강

출력: ai_1_output.json (보강된 후보 데이터)

ai_2_consumer.py (Consumer)

입력: Producer 출력(ai_1_output.json)

처리: LLM으로 추천 이유 2문장 생성, highlights/warnings/score_breakdown 포함
수치 검증 및 폴백 처리로 환각 방지

출력: explain.json (BE 전달용)

orchestrator.py

기능: Producer → Consumer를 한 번에 실행

특징: 입력/출력 경로, 모델, Top-K 등 옵션으로 제어 가능

실행 예시
1) Producer만 실행
python ai_1_producer.py sample/be_input.json -o sample/ai_1_output.json -k 3

2) Consumer만 실행
python ai_2_consumer.py -i sample/ai_1_output.json -o sample/explain.json -k 5

3) 전체 파이프라인 실행 (오케스트레이터)
python orchestrator.py -i sample/be_input.json --p-out sample/ai_1_output.json --c-out sample/explain.json -k 5

주의사항

실행 전 .env 또는 환경변수에 OPENAI_API_KEY를 설정해야 합니다.

sample/의 데이터는 개발/테스트용 예시입니다. 실제 서비스에서는 BE 제공 입력으로 교체하세요.

산출물 저장 경로는 스크립트 옵션으로 조정할 수 있습니다.