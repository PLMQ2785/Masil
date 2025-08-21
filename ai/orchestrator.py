# orchestrator.py
# Producer(ai_1_producer.py) -> Consumer(ai_2_consumer.py) 순차 실행
# 예) python orchestrator.py -i sample/ai_1_input.json --p-out sample/ai_1_output.json --c-out sample/explain.json -k 3
"""
===============================
Orchestrator 실행 옵션
===============================
[공통 옵션]
-i, --input <path>          : Producer 입력 JSON (factpack/top-K)
-k, --top_k <int>           : Consumer 단계에서 처리할 Top-K 개수
--python <path>             : 사용할 파이썬 실행기 경로
--skip-producer              : Producer 단계 건너뜀 (ai_1_output.json이 이미 있을 경우)
--skip-consumer              : Consumer 단계 건너뜀
--no-keep                    : Consumer 실행 후 중간 산출물(p_out) 삭제

[Producer 옵션]
--p-script <path>           : Producer 스크립트 경로 (기본: ai_1_producer.py)
--p-out <path>              : Producer 출력 파일 경로 (기본: ai_1_output.json)
--p-top-k <int>              : Producer 단계에서 후보를 상위 K개로 축약
--p-model <str>              : Producer 전용 모델(OPENAI_MODEL 환경변수 override)
# (ai_1_producer.py에서 batch_size 등을 지원한다면 여기에 --p-batch-size 추가 가능)

[Consumer 옵션]
--c-script <path>           : Consumer 스크립트 경로 (기본: ai_2_consumer.py)
--c-out <path>              : Consumer 출력 파일 경로 (기본: explain.json)
--c-model <str>              : Consumer 전용 모델(OPENAI_MODEL 환경변수 override)

[사용 예시]
1) 기본 실행:
   python orchestrator.py

2) 입력/출력 경로 변경:
   python orchestrator.py -i sample/ai_1_input.json --p-out sample/ai_1_output.json --c-out sample/explain.json

3) Producer와 Consumer 모델 다르게 지정:
   python orchestrator.py --p-model gpt-4o-mini --c-model gpt-4o

4) Producer 건너뛰고 Consumer만 실행:
   python orchestrator.py --skip-producer -k 5 --c-out explain.json

5) 실행 후 중간 산출물 삭제:
   python orchestrator.py --no-keep
"""

import argparse, os, sys, time, shlex, subprocess
from pathlib import Path

def run(cmd, env=None):
    print(f"\n$ {shlex.join(cmd)}")
    start = time.time()
    proc = subprocess.run(cmd, env=env, text=True)
    dur = time.time() - start
    print(f"↳ exit={proc.returncode} ({dur:.2f}s)")
    if proc.returncode != 0:
        sys.exit(proc.returncode)

def main():
    ap = argparse.ArgumentParser(description=(
            "Producer(ai_1_producer.py)와 Consumer(ai_2_consumer.py)를 순차 실행하는 오케스트레이터.\n\n"
            "[공통]\n"
            "  -i, --input   : Producer 입력 JSON (factpack/top-K)\n"
            "  -k, --top_k   : Consumer 단계에서 처리할 Top-K\n"
            "  --skip-producer : Producer 단계 건너뜀\n"
            "  --skip-consumer : Consumer 단계 건너뜀\n"
            "  --no-keep       : 중간 산출물 삭제\n\n"
            "[Producer]\n"
            "  --p-script, --p-out, --p-top-k, --p-model\n"
            "[Consumer]\n"
            "  --c-script, --c-out, --c-model\n"
        ),
        formatter_class=argparse.RawTextHelpFormatter
    )
    # 공통
    ap.add_argument("-i", "--input", default="sample/ai_1_input.json", help="Producer 입력 JSON (factpack/top-K)")
    ap.add_argument("-k", "--top_k", type=int, default=5, help="Consumer에서 처리할 Top-K (Producer의 k는 --p-top-k로 별도)")
    ap.add_argument("--python", default=sys.executable, help="파이썬 실행기 경로")
    ap.add_argument("--skip-producer", action="store_true", help="Producer 단계 건너뛰기 (이미 ai_1_output.json이 있을 때)")
    ap.add_argument("--skip-consumer", action="store_true", help="Consumer 단계 건너뛰기")
    ap.add_argument("--no-keep", action="store_true", help="중간 산출물(p_out) 삭제")

    # Producer 옵션
    ap.add_argument("--p-script", default="ai_1_producer.py", help="Producer 스크립트 경로")
    ap.add_argument("--p-out", default="ai_1_output.json", help="Producer 출력(JSON)")
    ap.add_argument("--p-top-k", type=int, default=3, help="Producer가 후보를 상위 K로 축약할 때 사용")
    ap.add_argument("--p-model", default=None, help="Producer 전용 모델(OPENAI_MODEL override)")
    # 필요 시: ap.add_argument("--p-batch-size", type=int, help="Producer 배치 크기(스크립트가 지원할 때만 전달)")

    # Consumer 옵션
    ap.add_argument("--c-script", default="ai_2_consumer.py", help="Consumer 스크립트 경로")
    ap.add_argument("--c-out", default="explain.json", help="Consumer 결과(JSON)")
    ap.add_argument("--c-model", default=None, help="Consumer 전용 모델(OPENAI_MODEL override)")

    args = ap.parse_args()

    # 경로 정규화
    in_path = Path(args.input)
    p_out = Path(args.p_out)
    c_out = Path(args.c_out)

    # Producer 실행
    if not args.skip_producer:
        if not in_path.exists():
            sys.exit(f"❌ 입력 파일 없음: {in_path}")
        env_prod = os.environ.copy()
        if args.p_model:
            env_prod["OPENAI_MODEL"] = args.p_model  # ai_1_producer가 os.getenv('OPENAI_MODEL', ...)로 읽음

        cmd_prod = [
            args.python, args.p_script, str(in_path),
            "-o", str(p_out),
            "-k", str(args.p_top_k),
        ]
        # 스크립트가 지원할 때만 주석 해제해서 전달
        # if args.p_batch_size:
        #     cmd_prod += ["--batch_size", str(args.p_batch_size)]

        run(cmd_prod, env=env_prod)
    else:
        print("⏭️  Producer 단계 건너뜀 (--skip-producer)")

    if not p_out.exists():
        sys.exit(f"❌ Producer 출력이 존재하지 않습니다: {p_out}")

    # Consumer 실행
    if not args.skip_consumer:
        env_cons = os.environ.copy()
        if args.c_model:
            env_cons["OPENAI_MODEL"] = args.c_model  # ai_2_consumer가 os.getenv('OPENAI_MODEL', ...)로 읽음

        cmd_cons = [
            args.python, args.c_script,
            "-i", str(p_out),
            "-o", str(c_out),
            "-k", str(args.top_k),
        ]
        run(cmd_cons, env=env_cons)
    else:
        print("⏭️  Consumer 단계 건너뜀 (--skip-consumer)")

    # 중간 산출물 정리
    if args.no_keep and p_out.exists():
        try:
            p_out.unlink()
            print(f"🧹 중간 산출물 삭제: {p_out}")
        except Exception as e:
            print(f"⚠️ 중간 산출물 삭제 실패: {e}")

    print(f"\n✅ 파이프라인 완료 → {c_out.resolve()}")

if __name__ == "__main__":
    main()
