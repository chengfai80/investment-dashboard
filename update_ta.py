import urllib.request
import json
import statistics
import socket

# Force IPv4
old_getaddrinfo = socket.getaddrinfo
def new_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return old_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = new_getaddrinfo

tickers = ['0166.KL', '5398.KL', '5326.KL', '1155.KL', '1295.KL', '6742.KL', '0380.KL', '0338.KL']
names = ['INARI', 'GAMUDA', '99SMART', 'MAYBANK', 'PBBANK', 'YTLPOWR', 'AQUAWALK', 'KOPI']
targets_file = '/home/chengfai/.openclaw/workspace/stock_targets.json'

results = []
for t, n in zip(tickers, names):
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{t}?range=3mo&interval=1d'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            res = data['chart']['result'][0]
            close_prices = res['indicators']['quote'][0]['close']
            high_prices = res['indicators']['quote'][0]['high']
            low_prices = res['indicators']['quote'][0]['low']
            
            closes = [p for p in close_prices if p is not None]
            highs = [p for p in high_prices if p is not None]
            lows = [p for p in low_prices if p is not None]
            
            if not closes: continue
            
            current_price = closes[-1]
            recent_high = max(highs)
            
            # Simple 20-day MA
            ma20 = statistics.mean(closes[-20:]) if len(closes) >= 20 else statistics.mean(closes)
            
            # ATR
            trs = []
            for i in range(1, len(closes)):
                hl = highs[i] - lows[i]
                hc = abs(highs[i] - closes[i-1])
                lc = abs(lows[i] - closes[i-1])
                trs.append(max(hl, hc, lc))
            
            atr = statistics.mean(trs[-14:]) if len(trs) >= 14 else statistics.mean(trs)
            
            # TP: Resistance (recent high) or Current + 2 ATR
            # SL: Support (MA20) or Current - 1.5 ATR
            suggested_tp = max(recent_high, current_price + (2 * atr))
            suggested_sl = min(ma20, current_price - (1.5 * atr))
            
            results.append({
                'Stock': n,
                'Ticker': t,
                'Price': round(current_price, 3),
                'TP': round(suggested_tp, 3),
                'SL': round(suggested_sl, 3)
            })
    except Exception as e:
        pass

with open(targets_file, 'w') as f:
    json.dump(results, f, indent=2)

print("Technical Analysis updated successfully.")
