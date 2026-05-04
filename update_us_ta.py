import json
import statistics
from datetime import datetime, timedelta
from moomoo import *

# US Stocks to track (no HK)
tickers = ['US.NVDA', 'US.AMD', 'US.TSM', 'US.INTC', 'US.MSFT', 'US.AAPL', 'US.AMZN', 'US.GOOG', 'US.CSCO']
targets_file = '/home/chengfai/.openclaw/workspace/us_stock_targets.json'

def main():
    # Connect to OpenD (Make sure Moomoo OpenD is running and logged in)
    quote_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
    
    results = []
    
    # We need ~60 calendar days to guarantee at least 20 trading days of K-lines
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=60)).strftime('%Y-%m-%d')

    for t in tickers:
        # Fetch historical daily Candlesticks
        ret, data, page_req_key = quote_ctx.request_history_kline(
            t, 
            start=start_date, 
            end=end_date, 
            max_count=50
        )
        
        if ret == RET_OK and not data.empty:
            closes = data['close'].tolist()
            highs = data['high'].tolist()
            lows = data['low'].tolist()
            
            if len(closes) < 20: 
                continue
            
            current_price = closes[-1]
            recent_high = max(highs[-20:])
            
            # Simple 20-day MA
            ma20 = statistics.mean(closes[-20:])
            
            # ATR (Average True Range) for 14 days
            trs = []
            for i in range(1, len(closes)):
                hl = highs[i] - lows[i]
                hc = abs(highs[i] - closes[i-1])
                lc = abs(lows[i] - closes[i-1])
                trs.append(max(hl, hc, lc))
            
            atr = statistics.mean(trs[-14:]) if len(trs) >= 14 else statistics.mean(trs)
            
            # Buy Target: 20 MA support level
            # TP: Resistance (recent high) or Current + 2 ATR
            # SL: Support (MA20) or Current - 1.5 ATR
            suggested_buy = round(ma20, 2)
            suggested_tp = max(recent_high, current_price + (2 * atr))
            suggested_sl = min(ma20, current_price - (1.5 * atr))
            
            results.append({
                'Ticker': t.replace('US.', ''),
                'Price': round(current_price, 2),
                'Buy': round(suggested_buy, 2),
                'Target': round(suggested_tp, 2),
                'SL': round(suggested_sl, 2)
            })
            print(f"Processed {t}")
        else:
            print(f"Failed to fetch data for {t}. Is OpenD running and logged in? Error: {data}")

    # Close connection
    quote_ctx.close()

    # Save to JSON for the dashboard
    with open(targets_file, 'w') as f:
        json.dump(results, f, indent=2)

    print("US Technical Analysis updated successfully.")

if __name__ == "__main__":
    main()
