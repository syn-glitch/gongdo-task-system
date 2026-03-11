import os
import sys

# ---------------------------------------------------------
# Claude API Token Estimator (for GitHub Actions)
# ---------------------------------------------------------
# 목적: 이슈의 텍스트 길이를 바탕으로 단계별 예상 소모 토큰과 비용(USD)을 산출함.
# 기준 모델: Claude-3.5-Sonnet ($3/1M in, $15/1M out)
# 가중치: 입력토큰(길이/3.5), 출력토큰(버퍼 1.5배), 단계별 적용(Auto-Fix x5.0 등)
# ---------------------------------------------------------

# 상수 및 단가
PRICE_INPUT_PER_M = 3.0
PRICE_OUTPUT_PER_M = 15.0
OUTPUT_BUFFER_MULTIPLIER = 1.5
KOREAN_CHAR_TO_TOKEN_RATIO = 3.5

# 파이프라인 단계별 토큰 가중치 & 평균 턴수 (BNK-PLAN 반영)
STAGES = {
    "issue-analysis": {"turns": 1, "avg_output_per_turn": 500},
    "issue-response": {"turns": 15, "avg_output_per_turn": 400},
    "pr-review": {"turns": 1, "avg_output_per_turn": 800},
    "auto-fix": {"turns": 40, "avg_output_per_turn": 600}
}
STAGE_WEIGHTS = {
    "issue-analysis": 1.0,
    "issue-response": 2.5,
    "pr-review": 1.0,
    "auto-fix": 5.0
}

def main():
    # 1. 입력 데이터 수집
    issue_title = os.environ.get("ISSUE_TITLE", "")
    issue_body = os.environ.get("ISSUE_BODY", "")
    target_stages = os.environ.get("TARGET_STAGES", "issue-analysis,issue-response,auto-fix").split(',')
    
    # 2. 크기 기반 기본 입력 토큰 계산
    total_chars = len(issue_title) + len(issue_body)
    base_input_tokens = int(total_chars / KOREAN_CHAR_TO_TOKEN_RATIO)
    
    # 시스템 프롬프트 및 컨텍스트 기본 토큰 여유분
    base_input_tokens += 1000 
    
    # 3. 비용 계산 로직
    total_est_input_tokens = 0
    total_est_output_tokens = 0
    
    for stage in target_stages:
        stage = stage.strip()
        if stage not in STAGES:
            continue
            
        stage_info = STAGES[stage]
        weight = STAGE_WEIGHTS[stage]
        turns = stage_info["turns"]
        
        # 입력 토큰 합계: 턴이 늘어날수록 컨텍스트 누적으로 평균 입력 토큰이 증가함
        stage_input_avg = base_input_tokens * ((1 + turns) / 2)
        total_est_input_tokens += int(stage_input_avg * turns)
        
        # 출력 토큰 합계: 예상 평균 출력 * 턴수 * 버퍼 * 가중치
        stage_output = stage_info["avg_output_per_turn"] * turns * OUTPUT_BUFFER_MULTIPLIER * weight
        total_est_output_tokens += int(stage_output)

    # 4. USD 비용 환산
    cost_usd = (total_est_input_tokens / 1_000_000 * PRICE_INPUT_PER_M) + \
               (total_est_output_tokens / 1_000_000 * PRICE_OUTPUT_PER_M)
               
    # 5. 효율성(ROI) 판정 (Conditioning)
    threshold = 0.1000
    if cost_usd < 0.05:
        efficiency = "High"
        action = "AUTO_PASS"
    elif cost_usd < threshold:
        efficiency = "Normal"
        action = "INFO_PASS"
    else:
        efficiency = "Needs Review"
        action = "WAIT_APPROVAL"
        
    # 6. 결과 출력 (GitHub Actions ENV)
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a") as f:
            f.write(f"est_cost_usd={cost_usd:.4f}\n")
            f.write(f"est_input_tokens={total_est_input_tokens}\n")
            f.write(f"est_output_tokens={total_est_output_tokens}\n")
            f.write(f"action={action}\n")
            f.write(f"efficiency={efficiency}\n")
            
    print(f"--- Token Estimation ---")
    print(f"Est. Input: {total_est_input_tokens:,}")
    print(f"Est. Output: {total_est_output_tokens:,}")
    print(f"Est. Cost: ${cost_usd:.4f}")
    print(f"Action: {action}")

if __name__ == "__main__":
    main()
