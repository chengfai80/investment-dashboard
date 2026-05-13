import urllib.request
import json
import sys
import socket

# Force IPv4
old_getaddrinfo = socket.getaddrinfo
def new_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return old_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = new_getaddrinfo

def get_price(ticker):
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=1d&interval=1d'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return data['chart']['result'][0]['meta']['regularMarketPrice']
    except Exception as e:
        return None

def main():
    gold_usd_oz = get_price('GC=F')
    btc_usd = get_price('BTC-USD')
    usd_myr = get_price('MYR=X')
    
    if not all([gold_usd_oz, btc_usd, usd_myr]):
        print("NO_ALERTS (api error)")
        return
        
    gold_rm_g = (gold_usd_oz / 31.1034768) * usd_myr
    btc_rm = btc_usd * usd_myr
    
    alerts = []
    
    if gold_rm_g <= 580:
        alerts.append(f"🟡 **Gold Alert!** Price is at or below RM580/g. Current: RM{gold_rm_g:.2f}/g")
        
    if btc_rm <= 300000:
        alerts.append(f"🟠 **Bitcoin Alert!** Price is at or below RM300,000. Current: RM{btc_rm:,.2f}")
        
    if alerts:
        print("ALERT:")
        for a in alerts:
            print(a)
    else:
        print("NO_ALERTS")

if __name__ == "__main__":
    main()
