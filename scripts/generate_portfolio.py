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
            
            # Note: For total PL calculation, cross-currency usually requires fx rates,
            # but since everything is either USD or MYR we'll roughly sum the raw numbers 
            # to provide an aggregated indicator, OR we just show the numbers with the currency symbol.
            # To be accurate without an fx feed, we'll keep the numbers separate or assume the user wants the raw display.
            unrealized_pl = market_val - (qty * avg_cost)
            total_unrealized_pl += unrealized_pl
            
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

    import re
    
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
        # Fallback if pattern doesn't exactly match (first run)
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

    with open(HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(html_content)
        
    print(f"Successfully updated {HTML_PATH} with live Moomoo data and summary badges!")

if __name__ == '__main__':
    update_portfolio_html()
