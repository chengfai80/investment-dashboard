import urllib.request
import json
import os
import sys
import socket

# Force IPv4
old_getaddrinfo = socket.getaddrinfo
def new_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return old_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = new_getaddrinfo

def check_stocks():
    targets_file = '/home/chengfai/.openclaw/workspace/stock_targets.json'
    if not os.path.exists(targets_file):
        print("NO_ALERTS (targets file missing)")
        return
        
    with open(targets_file, 'r') as f:
        targets = json.load(f)
        
    alerts = []
    
    for t in targets:
        stock = t['Stock']
        ticker = t['Ticker']
        tp = t['TP']
        sl = t['SL']
        
        url = f'https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?range=1d&interval=1m'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                res = data['chart']['result'][0]
                close_prices = res['indicators']['quote'][0]['close']
                closes = [p for p in close_prices if p is not None]
                
                if not closes:
                    continue
                    
                current_price = closes[-1]
                
                if current_price >= tp:
                    alerts.append(f"🟢 **{stock}** hit Target Profit! Current Price: RM{current_price:.2f} (Target: RM{tp:.2f})")
                elif current_price <= sl:
                    alerts.append(f"🔴 **{stock}** hit Stop Loss! Current Price: RM{current_price:.2f} (Stop Loss: RM{sl:.2f})")
        except Exception as e:
            pass # ignore errors for individual stocks to keep running

    if alerts:
        print("ALERT:")
        for a in alerts:
            print(a)
    else:
        print("NO_ALERTS")

if __name__ == "__main__":
    check_stocks()
