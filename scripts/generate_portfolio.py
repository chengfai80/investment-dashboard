import json
import os
import re
import math
import urllib.request
from datetime import datetime
from moomoo import *

# Path to the portfolio HTML file
HTML_PATH = os.path.join(os.path.dirname(__file__), '..', 'portfolio.html')

# Holdings code -> Yahoo ticker mapping for TA
TA_MAP = {
    'US.NVDA': ('NVDA', 'USD'),
    'US.CSCO': ('CSCO', 'USD'),
    'MY.6742': ('6742.KL', 'MYR'),
    'MY.5398': ('5398.KL', 'MYR'),
    'MY.5326': ('5326.KL', 'MYR'),
    'MY.6012': ('6012.KL', 'MYR'),
    'MY.1295': ('1295.KL', 'MYR'),
    'MY.1155': ('1155.KL', 'MYR'),
    'MY.0338': ('0338.KL', 'MYR'),
    'MY.0166': ('0166.KL', 'MYR'),
}


def _sma(values, period):
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def _ema(values, period):
    if not values:
        return []
    k = 2 / (period + 1)
    ema = [values[0]]
    for v in values[1:]:
        ema.append(v * k + ema[-1] * (1 - k))
    return ema


def _rsi(closes, period=14):
    if len(closes) < period + 1:
        return None
    gains = []
    losses = []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _macd(closes):
    if len(closes) < 35:
        return None, None, None, None
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    macd_line = [a - b for a, b in zip(ema12[-len(ema26):], ema26)]
    signal = _ema(macd_line, 9)
    hist = [m - s for m, s in zip(macd_line[-len(signal):], signal)]
    if not hist:
        return None, None, None, None
    return macd_line[-1], signal[-1], hist[-1], hist[-2] if len(hist) > 1 else 0


def _ta_signal(price, rsi, macd_hist, macd_hist_prev, ma25):
    score = 0
    if ma25 is not None:
        if price > ma25:
            score += 1
        else:
            score -= 1
    if rsi is not None:
        if rsi < 30:
            score += 1
        elif rsi > 70:
            score -= 1
    if macd_hist is not None:
        if macd_hist > 0:
            score += 1
        else:
            score -= 1
        if macd_hist_prev is not None and macd_hist > macd_hist_prev:
            score += 1
        elif macd_hist_prev is not None and macd_hist < macd_hist_prev:
            score -= 1

    if score >= 2:
        return 'BULLISH', 'text-green-500'
    if score <= -2:
        return 'BEARISH', 'text-red-500'
    return 'NEUTRAL', 'text-yellow-400'


def _fetch_ta(ticker):
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=3mo&interval=1d'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    resp = urllib.request.urlopen(req, timeout=15)
    data = json.loads(resp.read().decode('utf-8'))
    r = data['chart']['result'][0]
    meta = r['meta']
    quote = r['indicators']['quote'][0]
    closes = [c for c in quote['close'] if c is not None]
    highs = [h for h in quote['high'] if h is not None]
    lows = [l for l in quote['low'] if l is not None]
    if len(closes) < 30:
        return None

    price = meta.get('regularMarketPrice', closes[-1])
    rsi = _rsi(closes)
    macd_line, macd_signal, macd_hist, macd_hist_prev = _macd(closes)
    ma7 = _sma(closes, 7)
    ma25 = _sma(closes, 25)
    ma99 = _sma(closes, 99)
    signal, color = _ta_signal(price, rsi, macd_hist, macd_hist_prev, ma25)

    return {
        'price': price,
        'rsi': rsi,
        'macd_line': macd_line,
        'macd_signal': macd_signal,
        'macd_hist': macd_hist,
        'macd_hist_prev': macd_hist_prev,
        'ma7': ma7,
        'ma25': ma25,
        'ma99': ma99,
        'signal': signal,
        'color': color,
        'trend': 'Above MA25' if ma25 is not None and price > ma25 else 'Below MA25',
    }


def _fmt_price(val, currency):
    if val is None:
        return 'N/A'
    if currency == 'USD':
        return f'${val:,.2f}'
    if val >= 100:
        return f'{val:,.2f}'
    return f'{val:,.3f}'


def _build_ta_section(holdings):
    rows = []
    for h in holdings:
        code = h['code']
        mapping = TA_MAP.get(code)
        if not mapping:
            continue
        ticker, currency = mapping
        try:
            ta = _fetch_ta(ticker)
        except Exception:
            ta = None
        if not ta:
            continue
        rows.append((h, ticker, currency, ta))

    if not rows:
        return ''

    body = ''
    for h, ticker, currency, ta in rows:
        rowsig = ta['signal']
        price = _fmt_price(ta['price'], currency)
        ma7 = _fmt_price(ta['ma7'], currency)
        ma25 = _fmt_price(ta['ma25'], currency)
        ma99 = _fmt_price(ta['ma99'], currency)
        rsi = 'N/A' if ta['rsi'] is None else f'{ta["rsi"]:.1f}'
        macd = 'N/A' if ta['macd_hist'] is None else f'{ta["macd_hist"]:.4f}'
        body += f'''
                            <tr>
                                <td class="py-3">
                                    <div class="font-semibold text-white">{h['name']}</div>
                                    <div class="text-[10px] text-gray-500 font-mono">{code} · TA {ticker}</div>
                                </td>
                                <td class="py-3 font-mono text-gray-300">{price}</td>
                                <td class="py-3 font-mono text-gray-300">{ma7}</td>
                                <td class="py-3 font-mono text-gray-300">{ma25}</td>
                                <td class="py-3 font-mono text-gray-300">{ma99}</td>
                                <td class="py-3 font-mono text-gray-300">{rsi}</td>
                                <td class="py-3 font-mono text-gray-300">{macd}</td>
                                <td class="py-3 text-right"><span class="text-sm font-mono {ta['color']}">{rowsig}</span></td>
                            </tr>'''

    if not body:
        return ''

    return f'''
            <!-- Holdings TA -->
            <div class="glass-panel rounded-xl p-6 mt-8">
                <h2 class="font-display text-xl font-semibold text-yellow-400 mb-4 border-b border-gray-800 pb-2 flex justify-between items-center">
                    <span>📊 Technical Analysis for Holdings</span>
                    <span class="text-sm font-mono text-yellow-300 bg-gray-900/50 px-3 py-1 rounded-full border border-gray-800">Live TA</span>
                </h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead>
                            <tr class="text-gray-400 border-b border-gray-800">
                                <th class="pb-3 font-medium">Asset</th>
                                <th class="pb-3 font-medium">Price</th>
                                <th class="pb-3 font-medium">MA(7)</th>
                                <th class="pb-3 font-medium">MA(25)</th>
                                <th class="pb-3 font-medium">MA(99)</th>
                                <th class="pb-3 font-medium">RSI(14)</th>
                                <th class="pb-3 font-medium">MACD Hist</th>
                                <th class="pb-3 font-medium text-right">Signal</th>
                            </tr>
                        </thead>
                        <tbody id="holdingsTaTable" class="divide-y divide-gray-800/50">{body}
                        </tbody>
                    </table>
                </div>
            </div>'''


def update_portfolio_html():
    trd_ctx = OpenSecTradeContext(filter_trdmarket=TrdMarket.MY, host='127.0.0.1', port=11111, security_firm=SecurityFirm.FUTUMY)

    # 1. Fetch current holdings
    ret, data = trd_ctx.position_list_query(trd_env=TrdEnv.REAL, acc_id=286260079259287898)
    holdings_html = ""
    holdings_rows = []
    total_unrealized_pl = 0.0

    if ret == RET_OK:
        for idx, row in data.iterrows():
            code = row['code']

            # Skip AQUAWALK (user sold it)
            if code == 'MY.0380':
                continue

            qty = row['qty']
            avg_cost = row['cost_price'] if 'cost_price' in row else row.get('average_cost', 0)
            cur_price = row['nominal_price']

            # Apply user overrides
            if code == 'US.AAPL': avg_cost = 0.0
            if code == 'US.CSCO': avg_cost = 0.0

            market_val = qty * cur_price
            unrealized_pl = market_val - (qty * avg_cost)
            total_unrealized_pl += unrealized_pl

            pl_pct = (unrealized_pl / (qty * avg_cost) * 100) if (qty * avg_cost) > 0 else 0

            is_profit = unrealized_pl > 0
            is_loss = unrealized_pl < 0
            color_class = 'text-green-500' if is_profit else ('text-red-500' if is_loss else 'text-gray-400')
            sign = '+' if is_profit else ''

            avg_cost_disp = "0.00 (Free)" if avg_cost == 0 else f"{avg_cost:.4f}"

            holdings_rows.append({'code': code, 'name': row['stock_name']})
            holdings_html += f"""
                            <tr>
                                <td class="py-3">
                                    <div class="font-semibold text-white">{row['stock_name']}</div>
                                    <div class="text-[10px] text-gray-500 font-mono">{code}</div>
                                </td>
                                <td class="py-3 font-mono text-gray-300">{qty}</td>
                                <td class="py-3 font-mono text-gray-300">{avg_cost_disp}</td>
                                <td class="py-3 font-mono text-gray-300">{cur_price:.4f}</td>
                                <td class="py-3 text-right font-mono {color_class} font-medium">
                                    {sign}{unrealized_pl:.2f}<br>
                                    <span class="text-xs opacity-80">{sign}{pl_pct:.2f}%</span>
                                </td>
                            </tr>"""

    # 2. Hardcoded sold stocks
    sold = [
        {"code": "MY.5212", "name": "PAVREIT", "net_profit": 497.81, "charges": 12.19},
        {"code": "MY.0338", "name": "KOPI (Trade 1)", "net_profit": 247.80, "charges": 12.20},
        {"code": "MY.0338", "name": "KOPI (Trade 2)", "net_profit": 80.11, "charges": 14.89},
        {"code": "MY.0380", "name": "AQUAWALK", "net_profit": -104.13, "charges": 4.13},
        {"code": "MY.9008", "name": "OMESTI", "net_profit": 17.97, "charges": 12.03},
        {"code": "MY.0117", "name": "SMRT", "net_profit": -778.66, "charges": 8.66}
    ]

    sold_html = ""
    total_realized_pl = 0.0

    for item in sold:
        total_realized_pl += item['net_profit']

        is_profit = item['net_profit'] > 0
        color_class = 'text-green-500' if is_profit else 'text-red-500'
        sign = '+' if is_profit else ''

        sold_html += f"""
                            <tr>
                                <td class="py-3">
                                    <div class="font-semibold text-white">{item['name']}</div>
                                    <div class="text-[10px] text-gray-500 font-mono">{item['code']}</div>
                                </td>
                                <td class="py-3 font-mono text-gray-400">RM {item['charges']:.2f}</td>
                                <td class="py-3 text-right font-mono {color_class} font-medium">
                                    {sign}{item['net_profit']:.2f}
                                </td>
                            </tr>"""

    trd_ctx.close()

    # Read the existing HTML
    if not os.path.exists(HTML_PATH):
        print(f"Error: HTML file not found at {HTML_PATH}")
        return

    with open(HTML_PATH, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # Replace holdings body
    holdings_pattern = re.compile(r'(<tbody id="holdingsTable"[^>]*>).*?(</tbody>)', re.DOTALL)
    html_content = holdings_pattern.sub(rf'\1{holdings_html}\n                        \2', html_content)

    # Replace sold body
    sold_pattern = re.compile(r'(<tbody id="soldTable"[^>]*>).*?(</tbody>)', re.DOTALL)
    html_content = sold_pattern.sub(rf'\1{sold_html}\n                        \2', html_content)

    # Add dynamic summary headers
    unrealized_color = 'text-green-500' if total_unrealized_pl > 0 else ('text-red-500' if total_unrealized_pl < 0 else 'text-gray-400')
    unrealized_sign = '+' if total_unrealized_pl > 0 else ''

    realized_color = 'text-green-500' if total_realized_pl > 0 else ('text-red-500' if total_realized_pl < 0 else 'text-gray-400')
    realized_sign = '+' if total_realized_pl > 0 else ''

    # Update Holdings Header
    header_holdings_pattern = re.compile(r'<h2 class="font-display text-xl font-semibold text-yellow-400 mb-4 border-b border-gray-800 pb-2">💼 Current Holdings.*?</h2>', re.DOTALL)
    new_holdings_header = f"""<h2 class="font-display text-xl font-semibold text-yellow-400 mb-4 border-b border-gray-800 pb-2 flex justify-between items-center">
                    <span>💼 Current Holdings</span>
                    <span class="text-sm font-mono {unrealized_color} bg-gray-900/50 px-3 py-1 rounded-full border border-gray-800">{unrealized_sign}{total_unrealized_pl:,.2f}</span>
                </h2>"""

    if not header_holdings_pattern.search(html_content):
        html_content = re.sub(r'<h2 class="font-display text-xl font-semibold text-yellow-400 mb-4 border-b border-gray-800 pb-2">💼 Current Holdings</h2>', new_holdings_header, html_content)
    else:
        html_content = header_holdings_pattern.sub(new_holdings_header, html_content)

    # Update Sold Header
    header_sold_pattern = re.compile(r'<h2 class="font-display text-xl font-semibold text-yellow-400 mb-4 border-b border-gray-800 pb-2">💸 Realized P/L \(Sold Stocks\).*?</h2>', re.DOTALL)
    new_sold_header = f"""<h2 class="font-display text-xl font-semibold text-yellow-400 mb-4 border-b border-gray-800 pb-2 flex justify-between items-center">
                    <span>💸 Realized P/L (Sold Stocks)</span>
                    <span class="text-sm font-mono {realized_color} bg-gray-900/50 px-3 py-1 rounded-full border border-gray-800">{realized_sign}{total_realized_pl:,.2f}</span>
                </h2>"""

    if not header_sold_pattern.search(html_content):
        html_content = re.sub(r'<h2 class="font-display text-xl font-semibold text-yellow-400 mb-4 border-b border-gray-800 pb-2">💸 Realized P/L \(Sold Stocks\)</h2>', new_sold_header, html_content)
    else:
        html_content = header_sold_pattern.sub(new_sold_header, html_content)

    # Insert or update Holdings TA section
    ta_section = _build_ta_section(holdings_rows)
    ta_marker_pattern = re.compile(r'<!-- Holdings TA -->.*?</div>\s*</div>\s*<!-- Realized P/L -->', re.DOTALL)
    if ta_section:
        if ta_marker_pattern.search(html_content):
            html_content = ta_marker_pattern.sub(ta_section + '\n\n            <!-- Realized P/L -->', html_content)
        else:
            html_content = html_content.replace('\n\n            <!-- Realized P/L -->', ta_section + '\n\n            <!-- Realized P/L -->', 1)
    else:
        # If TA couldn't be built, remove any previous TA block so the page doesn't show stale data.
        html_content = re.sub(r'\n\s*<!-- Holdings TA -->.*?\n\s*<!-- Realized P/L -->', '\n\n            <!-- Realized P/L -->', html_content, flags=re.DOTALL)

    # Update the last updated time
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S MYT')
    time_pattern = re.compile(r'<span id="updateTime">.*?</span>')
    if time_pattern.search(html_content):
        html_content = time_pattern.sub(f'<span id="updateTime">{current_time}</span>', html_content)

    with open(HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"Successfully updated {HTML_PATH} with live Moomoo data, summary badges, and holdings TA!")


if __name__ == '__main__':
    update_portfolio_html()
