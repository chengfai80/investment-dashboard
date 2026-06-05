import json
import os
import re
import urllib.request
from datetime import datetime
from moomoo import *

# Path to the portfolio HTML file
HTML_PATH = os.path.join(os.path.dirname(__file__), '..', 'portfolio.html')
ACC_ID = 286260079259287898
FX_USD_MYR = 4.50

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


def _fx_to_myr(amount, currency):
    amount = float(amount or 0)
    return amount * FX_USD_MYR if currency == 'USD' else amount


def _fmt_money(amount, currency='MYR', decimals=2):
    if amount is None:
        return 'N/A'
    prefix = 'RM ' if currency == 'MYR' else '$'
    return f'{prefix}{amount:,.{decimals}f}'


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
    gains, losses = [], []
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
        score += 1 if price > ma25 else -1
    if rsi is not None:
        if rsi < 30:
            score += 1
        elif rsi > 70:
            score -= 1
    if macd_hist is not None:
        score += 1 if macd_hist > 0 else -1
        if macd_hist_prev is not None:
            if macd_hist > macd_hist_prev:
                score += 1
            elif macd_hist < macd_hist_prev:
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
    if len(closes) < 30:
        return None

    price = meta.get('regularMarketPrice', closes[-1])
    rsi = _rsi(closes)
    _, _, macd_hist, macd_hist_prev = _macd(closes)
    ma7 = _sma(closes, 7)
    ma25 = _sma(closes, 25)
    ma99 = _sma(closes, 99)
    signal, color = _ta_signal(price, rsi, macd_hist, macd_hist_prev, ma25)

    return {
        'price': price,
        'rsi': rsi,
        'macd_hist': macd_hist,
        'macd_hist_prev': macd_hist_prev,
        'ma7': ma7,
        'ma25': ma25,
        'ma99': ma99,
        'signal': signal,
        'color': color,
    }


def _display_ta(ta, currency):
    if not ta:
        return {
            'signal': 'N/A', 'signal_color': 'text-gray-400',
            'price': 'N/A', 'ma7': 'N/A', 'ma25': 'N/A', 'ma99': 'N/A', 'rsi': 'N/A', 'macd': 'N/A',
        }
    fx = FX_USD_MYR if currency == 'USD' else 1.0
    return {
        'signal': ta['signal'],
        'signal_color': ta['color'],
        'price': _fmt_money(ta['price'] * fx, 'MYR', 4),
        'ma7': _fmt_money(ta['ma7'] * fx, 'MYR', 4) if ta['ma7'] is not None else 'N/A',
        'ma25': _fmt_money(ta['ma25'] * fx, 'MYR', 4) if ta['ma25'] is not None else 'N/A',
        'ma99': _fmt_money(ta['ma99'] * fx, 'MYR', 4) if ta['ma99'] is not None else 'N/A',
        'rsi': 'N/A' if ta['rsi'] is None else f'{ta["rsi"]:.1f}',
        'macd': 'N/A' if ta['macd_hist'] is None else f'{(ta["macd_hist"] * fx):.4f}',
    }


def _build_merged_holdings_panel(holdings):
    rows_html = ''
    total_unrealized_myr = 0.0
    for h in holdings:
        total_unrealized_myr += h['unrealized_pl_myr']
        rows_html += f'''
                            <tr>
                                <td class="py-3">
                                    <div class="font-semibold text-white">{h['name']}</div>
                                    <div class="text-[10px] text-gray-500 font-mono">{h['code']}</div>
                                </td>
                                <td class="py-3 font-mono text-gray-300">{h['qty']:.4f}</td>
                                <td class="py-3 font-mono text-gray-300">{h['avg_cost_disp']}</td>
                                <td class="py-3 font-mono text-gray-300">{h['price_disp']}</td>
                                <td class="py-3 text-right font-mono {h['pl_color']} font-medium">
                                    {h['pl_sign']}{h['unrealized_pl_myr']:.2f}<br>
                                    <span class="text-xs opacity-80">{h['pl_sign']}{h['pl_pct']:.2f}%</span>
                                </td>
                                <td class="py-3 text-right"><span class="text-sm font-mono {h['signal_color']}">{h['signal']}</span></td>
                                <td class="py-3 font-mono text-gray-300">{h['ta_price']}</td>
                                <td class="py-3 font-mono text-gray-300">{h['ta_ma7']}</td>
                                <td class="py-3 font-mono text-gray-300">{h['ta_ma25']}</td>
                                <td class="py-3 font-mono text-gray-300">{h['ta_ma99']}</td>
                                <td class="py-3 font-mono text-gray-300">{h['ta_rsi']}</td>
                                <td class="py-3 font-mono text-gray-300">{h['ta_macd']}</td>
                            </tr>'''

    unrealized_color = 'text-green-500' if total_unrealized_myr > 0 else ('text-red-500' if total_unrealized_myr < 0 else 'text-gray-400')
    unrealized_sign = '+' if total_unrealized_myr > 0 else ''

    return f'''
            <!-- Current Holdings -->
            <div class="glass-panel rounded-xl p-6 w-full">
                <h2 class="font-display text-xl font-semibold text-yellow-400 mb-4 border-b border-gray-800 pb-2 flex justify-between items-center">
                    <span>💼 Current Holdings</span>
                    <span class="text-sm font-mono {unrealized_color} bg-gray-900/50 px-3 py-1 rounded-full border border-gray-800">RM {unrealized_sign}{total_unrealized_myr:,.2f}</span>
                </h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead>
                            <tr class="text-gray-400 border-b border-gray-800">
                                <th class="pb-3 font-medium">Asset</th>
                                <th class="pb-3 font-medium">Qty</th>
                                <th class="pb-3 font-medium">Avg Cost</th>
                                <th class="pb-3 font-medium">Price</th>
                                <th class="pb-3 font-medium text-right">Unrealized P/L</th>
                                <th class="pb-3 font-medium text-right">Signal</th>
                                <th class="pb-3 font-medium">Price</th>
                                <th class="pb-3 font-medium">MA(7)</th>
                                <th class="pb-3 font-medium">MA(25)</th>
                                <th class="pb-3 font-medium">MA(99)</th>
                                <th class="pb-3 font-medium">RSI(14)</th>
                                <th class="pb-3 font-medium">MACD Hist</th>
                            </tr>
                        </thead>
                        <tbody id="holdingsTable" class="divide-y divide-gray-800/50">{rows_html}
                        </tbody>
                    </table>
                </div>
            </div>'''


def _fetch_sold_trades(trd_ctx, acc_id):
    sold_map = {}
    ret, deals = trd_ctx.history_deal_list_query(start='2000-01-01', end='2100-01-01', trd_env=TrdEnv.REAL, acc_id=acc_id)
    if ret != RET_OK or deals is None or deals.empty:
        return []

    try:
        fee_ret, fee_df = trd_ctx.order_fee_query(order_id_list=deals['order_id'].dropna().astype(str).unique().tolist(), trd_env=TrdEnv.REAL, acc_id=acc_id)
    except Exception:
        fee_ret, fee_df = -1, None

    fee_map = {}
    if fee_ret == RET_OK and fee_df is not None and not fee_df.empty and 'order_id' in fee_df.columns:
        for _, frow in fee_df.iterrows():
            fee_map[str(frow.get('order_id', ''))] = float(frow.get('fee_amount', 0) or 0)

    fifo_lots = {}
    deals = deals.sort_values(by=['create_time', 'deal_id'], ascending=True)

    def _to_float(v):
        try:
            return float(v or 0)
        except Exception:
            return 0.0

    for _, row in deals.iterrows():
        code = str(row.get('code', '') or '')
        side = str(row.get('trd_side', '')).upper()
        qty = _to_float(row.get('qty', 0))
        price = _to_float(row.get('price', 0))
        order_id = str(row.get('order_id', '') or '')
        stock_name = str(row.get('stock_name', '') or code)
        currency = 'USD' if code.startswith('US.') else 'MYR'
        fee = float(fee_map.get(order_id, 0.0) or 0.0)

        if code not in fifo_lots:
            fifo_lots[code] = []

        if side == 'BUY':
            if code == 'US.AAPL':
                cost_per_share = 0.0
            elif code == 'MY.9008':
                cost_per_share = 0.08
            elif code == 'MY.0380':
                cost_per_share = 0.31
            else:
                total_cost = (qty * price) + fee
                cost_per_share = total_cost / qty if qty else price
            fifo_lots[code].append({
                'qty': qty,
                'cost_per_share': cost_per_share,
                'stock_name': stock_name,
                'currency': currency,
            })
            continue

        if side != 'SELL' or qty <= 0:
            continue

        remaining = qty
        realized_profit_native = 0.0
        buy_cost_native = 0.0
        if code == 'US.AAPL' and not fifo_lots[code]:
            # Free lot special case: no recorded cost basis, so profit is the full proceeds minus fees.
            sell_proceeds_native = qty * price
            realized_profit_native = sell_proceeds_native - fee
        else:
            while remaining > 0 and fifo_lots[code]:
                lot = fifo_lots[code][0]
                take = min(remaining, lot['qty'])
                buy_cost_native += take * lot['cost_per_share']
                realized_profit_native += take * (price - lot['cost_per_share'])
                lot['qty'] -= take
                remaining -= take
                if lot['qty'] <= 0:
                    fifo_lots[code].pop(0)

            realized_profit_native -= fee
            sell_proceeds_native = qty * price
        net_profit_myr = _fx_to_myr(realized_profit_native, currency)
        buy_cost_myr = _fx_to_myr(buy_cost_native, currency)
        sell_proceeds_myr = _fx_to_myr(sell_proceeds_native, currency)
        charges_myr = _fx_to_myr(fee, currency)

        if code not in sold_map:
            sold_map[code] = {
                'code': code,
                'name': stock_name,
                'quantity': 0.0,
                'buy_cost_myr': 0.0,
                'sell_proceeds_myr': 0.0,
                'charges_myr': 0.0,
                'net_profit_myr': 0.0,
                'create_time': row.get('create_time', ''),
            }

        if code == 'MY.9008':
            buy_cost_myr = round(qty * 0.08, 2)
            sell_proceeds_myr = _fx_to_myr(sell_proceeds_native, currency)
            net_profit_myr = round(sell_proceeds_myr - buy_cost_myr - charges_myr, 2)
        elif code == 'MY.0380':
            buy_cost_myr = round(qty * 0.31, 2)
            sell_proceeds_myr = _fx_to_myr(sell_proceeds_native, currency)
            net_profit_myr = round(sell_proceeds_myr - buy_cost_myr - charges_myr, 2)

        sold_map[code]['quantity'] += qty
        sold_map[code]['buy_cost_myr'] += buy_cost_myr
        sold_map[code]['sell_proceeds_myr'] += sell_proceeds_myr
        sold_map[code]['charges_myr'] += charges_myr
        sold_map[code]['net_profit_myr'] += net_profit_myr
        if str(row.get('create_time', '')) > str(sold_map[code]['create_time']):
            sold_map[code]['create_time'] = row.get('create_time', '')

    sold_rows = list(sold_map.values())
    for row in sold_rows:
        qty = row['quantity'] or 0
        row['quantity'] = round(qty, 4)
        row['buy_cost_myr'] = round(row['buy_cost_myr'], 2)
        row['sell_proceeds_myr'] = round(row['sell_proceeds_myr'], 2)
        row['charges_myr'] = round(row['charges_myr'], 2)
        row['net_profit_myr'] = round(row['net_profit_myr'], 2)
        row['buy_price_myr'] = round((row['buy_cost_myr'] / qty), 4) if qty else 0.0
        row['sell_price_myr'] = round((row['sell_proceeds_myr'] / qty), 4) if qty else 0.0
        row['qty_disp'] = f'{qty:.4f}'

    sold_rows.sort(key=lambda x: str(x.get('create_time', '')), reverse=True)
    return sold_rows


def _build_sold_panel(sold_rows):
    rows_html = ''
    total_realized_myr = 0.0
    for item in sold_rows:
        total_realized_myr += item['net_profit_myr']
        is_profit = item['net_profit_myr'] > 0
        color_class = 'text-green-500' if is_profit else 'text-red-500'
        sign = '+' if is_profit else ''
        rows_html += f'''
                            <tr>
                                <td class="py-3">
                                    <div class="font-semibold text-white">{item['name']}</div>
                                    <div class="text-[10px] text-gray-500 font-mono">{item['code']}</div>
                                </td>
                                <td class="py-3 font-mono text-gray-300">{item['qty_disp']}</td>
                                <td class="py-3 font-mono text-gray-300">RM {item['buy_price_myr']:.4f}</td>
                                <td class="py-3 font-mono text-gray-300">RM {item['sell_price_myr']:.4f}</td>
                                <td class="py-3 font-mono text-gray-400">RM {item['charges_myr']:.2f}</td>
                                <td class="py-3 text-right font-mono {color_class} font-medium">RM {sign}{item['net_profit_myr']:.2f}</td>
                            </tr>'''

    realized_color = 'text-green-500' if total_realized_myr > 0 else ('text-red-500' if total_realized_myr < 0 else 'text-gray-400')
    realized_sign = '+' if total_realized_myr > 0 else ''

    return f'''
            <!-- Realized P/L -->
            <div class="glass-panel rounded-xl p-6 w-full mt-8">
                <h2 class="font-display text-xl font-semibold text-yellow-400 mb-4 border-b border-gray-800 pb-2 flex justify-between items-center">
                    <span>💸 Realized P/L (Sold Stocks)</span>
                    <span class="text-sm font-mono {realized_color} bg-gray-900/50 px-3 py-1 rounded-full border border-gray-800">RM {realized_sign}{total_realized_myr:,.2f}</span>
                </h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead>
                            <tr class="text-gray-400 border-b border-gray-800">
                                <th class="pb-3 font-medium">Asset</th>
                                <th class="pb-3 font-medium">Qty</th>
                                <th class="pb-3 font-medium">Buy Price</th>
                                <th class="pb-3 font-medium">Sell Price</th>
                                <th class="pb-3 font-medium">Moomoo Charges</th>
                                <th class="pb-3 font-medium text-right">Net Profit</th>
                            </tr>
                        </thead>
                        <tbody id="soldTable" class="divide-y divide-gray-800/50">{rows_html}
                        </tbody>
                    </table>
                </div>
            </div>'''


def update_portfolio_html():
    trd_ctx = OpenSecTradeContext(filter_trdmarket=TrdMarket.MY, host='127.0.0.1', port=11111, security_firm=SecurityFirm.FUTUMY)
    ret, data = trd_ctx.position_list_query(trd_env=TrdEnv.REAL, acc_id=ACC_ID)

    holdings = []
    if ret == RET_OK:
        for _, row in data.iterrows():
            code = str(row['code'])
            stock_name = str(row['stock_name'])
            qty = float(row['qty'])
            avg_cost_native = float(row['cost_price'] if 'cost_price' in row and row['cost_price'] is not None else row.get('average_cost', 0) or 0)
            cur_price_native = float(row['nominal_price'])
            native_currency = 'USD' if code.startswith('US.') else 'MYR'

            if code in {'US.AAPL', 'US.CSCO'}:
                avg_cost_native = 0.0

            avg_cost_myr = _fx_to_myr(avg_cost_native, native_currency)
            cur_price_myr = _fx_to_myr(cur_price_native, native_currency)
            unrealized_pl_native = (cur_price_native - avg_cost_native) * qty
            unrealized_pl_myr = _fx_to_myr(unrealized_pl_native, native_currency)
            pl_pct = (unrealized_pl_native / (qty * avg_cost_native) * 100) if (qty * avg_cost_native) > 0 else 0
            is_profit = unrealized_pl_myr > 0
            is_loss = unrealized_pl_myr < 0
            pl_color = 'text-green-500' if is_profit else ('text-red-500' if is_loss else 'text-gray-400')
            pl_sign = '+' if is_profit else ''

            ta = _fetch_ta(TA_MAP.get(code, (None, None))[0]) if code in TA_MAP else None
            ta_disp = _display_ta(ta, native_currency)

            holdings.append({
                'code': code,
                'name': stock_name,
                'qty': qty,
                'avg_cost_disp': _fmt_money(avg_cost_myr, 'MYR', 4),
                'price_disp': _fmt_money(cur_price_myr, 'MYR', 4),
                'unrealized_pl_myr': unrealized_pl_myr,
                'pl_pct': pl_pct,
                'pl_color': pl_color,
                'pl_sign': pl_sign,
                'signal': ta_disp['signal'],
                'signal_color': ta_disp['signal_color'],
                'ta_price': ta_disp['price'],
                'ta_ma7': ta_disp['ma7'],
                'ta_ma25': ta_disp['ma25'],
                'ta_ma99': ta_disp['ma99'],
                'ta_rsi': ta_disp['rsi'],
                'ta_macd': ta_disp['macd'],
            })

    holdings_panel = _build_merged_holdings_panel(holdings)
    sold_panel = _build_sold_panel(_fetch_sold_trades(trd_ctx, ACC_ID))
    trd_ctx.close()

    if not os.path.exists(HTML_PATH):
        print(f'Error: HTML file not found at {HTML_PATH}')
        return

    with open(HTML_PATH, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # Replace current holdings section only; keep the sold panel below it.
    html_content = re.sub(
        r'<!-- Current Holdings -->.*?<!-- Realized P/L -->',
        holdings_panel + '\n\n            <!-- Realized P/L -->',
        html_content,
        flags=re.DOTALL,
    )

    # Replace the sold panel (already vertical by design) and preserve the script block.
    html_content = re.sub(
        r'<!-- Realized P/L -->.*?<script>',
        sold_panel + '\n\n    <script>',
        html_content,
        flags=re.DOTALL,
    )

    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S MYT')
    html_content = re.sub(r'<span id="updateTime">.*?</span>', f'<span id="updateTime">{current_time}</span>', html_content)

    with open(HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f'Successfully updated {HTML_PATH} with live Moomoo data, MYR-converted P/L, and merged TA columns!')


if __name__ == '__main__':
    update_portfolio_html()
