import json
import os
from moomoo import *

# Path to the portfolio HTML file
HTML_PATH = os.path.join(os.path.dirname(__file__), '..', 'portfolio.html')

def update_portfolio_html():
    trd_ctx = OpenSecTradeContext(filter_trdmarket=TrdMarket.MY, host='127.0.0.1', port=11111, security_firm=SecurityFirm.FUTUMY)
    
    # 1. Fetch current holdings
    ret, data = trd_ctx.position_list_query(trd_env=TrdEnv.REAL, acc_id=286260079259287898)
    holdings_html = ""
    if ret == RET_OK:
        for idx, row in data.iterrows():
            code = row['code']
            qty = row['qty']
            avg_cost = row['cost_price'] if 'cost_price' in row else row.get('average_cost', 0)
            cur_price = row['nominal_price']
            
            # Apply user overrides
            if code == 'US.AAPL': avg_cost = 0.0
            if code == 'US.CSCO': avg_cost = 0.0
            if code == 'MY.0380': avg_cost = 0.31
            
            market_val = qty * cur_price
            unrealized_pl = market_val - (qty * avg_cost)
            pl_pct = (unrealized_pl / (qty * avg_cost) * 100) if (qty * avg_cost) > 0 else 0
            
            is_profit = unrealized_pl > 0
            is_loss = unrealized_pl < 0
            color_class = 'text-green-500' if is_profit else ('text-red-500' if is_loss else 'text-gray-400')
            sign = '+' if is_profit else ''
            
            avg_cost_disp = "0.00 (Free)" if avg_cost == 0 else f"{avg_cost:.4f}"
            
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
        {"code": "MY.9008", "name": "OMESTI", "net_profit": 17.97, "charges": 12.03},
        {"code": "MY.0117", "name": "SMRT", "net_profit": -778.66, "charges": 8.66}
    ]
    
    sold_html = ""
    for item in sold:
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

    # We need to replace the content inside the <tbody> elements
    import re
    
    # Replace holdings body
    holdings_pattern = re.compile(r'(<tbody id="holdingsTable"[^>]*>).*?(</tbody>)', re.DOTALL)
    html_content = holdings_pattern.sub(rf'\1{holdings_html}\n                        \2', html_content)
    
    # Replace sold body
    sold_pattern = re.compile(r'(<tbody id="soldTable"[^>]*>).*?(</tbody>)', re.DOTALL)
    html_content = sold_pattern.sub(rf'\1{sold_html}\n                        \2', html_content)

    with open(HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(html_content)
        
    print(f"Successfully updated {HTML_PATH} with live Moomoo data!")

if __name__ == '__main__':
    update_portfolio_html()
