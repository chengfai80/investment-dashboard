import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from moomoo import *

class CORSRequestHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-type")
        self.end_headers()
        
    def do_GET(self):
        if self.path == '/api/portfolio':
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            try:
                trd_ctx = OpenSecTradeContext(filter_trdmarket=TrdMarket.MY, host='127.0.0.1', port=11111, security_firm=SecurityFirm.FUTUMY)
                ret, data = trd_ctx.position_list_query(trd_env=TrdEnv.REAL, acc_id=286260079259287898)
                holdings = []
                if ret == RET_OK:
                    for idx, row in data.iterrows():
                        code = row['code']
                        qty = row['qty']
                        avg_cost = row['cost_price'] if 'cost_price' in row else row.get('average_cost', 0)
                        cur_price = row['nominal_price']
                        
                        if code == 'US.AAPL': avg_cost = 0.0
                        if code == 'US.CSCO': avg_cost = 0.0
                        if code == 'MY.0380': avg_cost = 0.31
                        
                        market_val = qty * cur_price
                        unrealized_pl = market_val - (qty * avg_cost)
                        pl_pct = (unrealized_pl / (qty * avg_cost) * 100) if (qty * avg_cost) > 0 else 0
                        
                        holdings.append({
                            "code": code,
                            "name": row['stock_name'],
                            "qty": qty,
                            "avg_cost": round(avg_cost, 4),
                            "current_price": round(cur_price, 4),
                            "market_val": round(market_val, 2),
                            "unrealized_pl": round(unrealized_pl, 2),
                            "pl_pct": round(pl_pct, 2)
                        })
                
                sold = [
                    {"code": "MY.5212", "name": "PAVREIT", "net_profit": 497.81, "charges": 12.19},
                    {"code": "MY.0338", "name": "KOPI (Trade 1)", "net_profit": 247.80, "charges": 12.20},
                    {"code": "MY.0338", "name": "KOPI (Trade 2)", "net_profit": 80.11, "charges": 14.89},
                    {"code": "MY.9008", "name": "OMESTI", "net_profit": 17.97, "charges": 12.03},
                    {"code": "MY.0117", "name": "SMRT", "net_profit": -778.66, "charges": 8.66}
                ]
                
                trd_ctx.close()
                response = json.dumps({"status": "success", "holdings": holdings, "sold": sold})
            except Exception as e:
                response = json.dumps({"status": "error", "message": str(e)})
            
            self.wfile.write(response.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('localhost', 5050), CORSRequestHandler)
    print("Starting Moomoo local bridge on http://localhost:5050...")
    server.serve_forever()
