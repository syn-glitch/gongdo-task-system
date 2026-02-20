import requests
import threading
from flask import Flask, request

app = Flask(__name__)

# [필수 설정] 구글 Apps Script 배포 URL (웹 앱 URL)을 여기에 붙여넣으세요.
GAS_WEB_APP_URL = "여기에_GAS_웹앱_URL_입력"

def forward_to_gas(data):
    """백그라운드에서 구글 Apps Script(GAS)로 데이터를 전달합니다."""
    try:
        response = requests.post(GAS_WEB_APP_URL, data=data)
        if response.status_code == 200:
            print("✅ GAS로 데이터 성공적 전달")
        else:
            print(f"⚠️ GAS 응답 에러: {response.status_code}")
    except Exception as e:
        print(f"❌ GAS 전달 실패: {e}")

@app.route('/slack/events', methods=['POST'])
def slack_events():
    """슬랙으로부터 오는 /주디 커맨드와 모달 제출(Interactivity)을 받습니다."""
    
    # 1. 모달 전송 (Payload)
    if 'payload' in request.form:
        # 백그라운드로 GAS에 전달 (시트 저장 등 오래 걸리는 작업)
        payload_data = {'payload': request.form['payload']}
        threading.Thread(target=forward_to_gas, args=(payload_data,)).start()
        
        # 슬랙에는 0.01초 만에 "알았어!" 하고 빈 문자열(200 OK)을 반환 -> 즉시 모달 닫힘
        return "", 200
        
    # 2. 슬래시 커맨드 (/주디)
    elif 'command' in request.form:
        # 모달 띄우기 창 요청도 GAS로 전달
        command_data = {
            'command': request.form['command'],
            'trigger_id': request.form.get('trigger_id')
        }
        threading.Thread(target=forward_to_gas, args=(command_data,)).start()
        
        # 커맨드 에러가 안 뜨게 빈 응답 반환
        return "", 200

    return "Unknown", 400

if __name__ == '__main__':
    print("🚀 슬랙-GAS 프록시 서버 실행 중... (포트 3000)")
    app.run(port=3000)
