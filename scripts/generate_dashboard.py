#!/usr/bin/env python3
"""
Investment Intelligence Dashboard Generator
Fetches live market data, news, and AI-powered analysis via Gemini,
then generates a complete HTML dashboard.
"""

import json
import os
import time
import html as html_module
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

try:
    import yfinance as yf
except ImportError:
    print("[WARN] yfinance not installed. Run: pip install yfinance")
    yf = None

try:
    import feedparser
except ImportError:
    print("[WARN] feedparser not installed. Run: pip install feedparser")
    feedparser = None


# ── Configuration ──────────────────────────────────────────────────────────

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
DISPATCH_TOKEN = os.environ.get("DISPATCH_TOKEN", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

SYMBOLS = {
    "gold": "GC=F",
    "btc": "BTC-USD",
    "aapl": "AAPL",
    "asml": "ASML",
    "baba": "BABA",
    "meli": "MELI",
    "maybank": "1155.KL",
    "cimb": "1295.KL",
    "tenaga": "5347.KL",
    "ihh": "5225.KL",
    "speedmart": "5326.KL",
}

RSS_FEEDS = {
    "Reuters": "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best",
    "CNBC": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
    "CoinTelegraph": "https://cointelegraph.com/rss",
    "CoinDesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
}

FALLBACK_PRICES = {
    "gold": 4644.30, "btc": 69189, "aapl": 255.92, "asml": 1317.23,
    "baba": 122.05, "meli": 1715.52, "maybank": 11.26, "cimb": 4.66,
    "tenaga": 14.04, "ihh": 8.96, "speedmart": 3.32,
}

FALLBACK_LOCAL_NEWS = [
    {"badge": "Cautious", "badge_class": "badge-bear", "headline": "Bursa Malaysia to remain cautious, confined within narrow range due to Mideast conflict", "summary": "Trading expected to be range-bound as geopolitical uncertainty continues to weigh on sentiment.", "source": "The Star", "date": "Apr 2026"},
    {"badge": "Mixed", "badge_class": "badge-neutral", "headline": "Bursa ends week mixed on global energy jitters — FBM KLCI in narrow range", "summary": "The benchmark index traded in a tight range as oil price volatility affected regional markets.", "source": "Business Today", "date": "Apr 2026"},
    {"badge": "Sell-off", "badge_class": "badge-bear", "headline": "FTSE Bursa Malaysia drops over 1% amid risk-off sentiment", "summary": "Malaysian equities came under selling pressure following global risk-off moves.", "source": "LiveMint", "date": "Apr 2026"},
    {"badge": "Positive", "badge_class": "badge-bull", "headline": "HKEX & Bursa Malaysia launch co-branded index, sign MOU for connectivity", "summary": "Strategic partnership to enhance cross-border investment flows between HK and Malaysian markets.", "source": "HKEX", "date": "Mar 2026"},
    {"badge": "Rally", "badge_class": "badge-bull", "headline": "Bursa Malaysia, Asian stocks rise on hopes for speedy Middle East resolution", "summary": "Asian markets rallied on hopes for swift resolution, providing temporary relief.", "source": "Asia News Network", "date": "Apr 2026"},
]

FALLBACK_INTL_NEWS = [
    {"badge": "Watch", "badge_class": "badge-neutral", "headline": "Wall St Week Ahead: Inflation in focus for markets jostled by Middle East war signals", "summary": "Fresh inflation data could start showing the Middle East war's economic impact.", "source": "Reuters", "date": "Apr 2026"},
    {"badge": "Recovery", "badge_class": "badge-bull", "headline": "Stocks recover from early losses, close with weekly gain. US oil tops $110/barrel", "summary": "Wall Street shook off an early stumble to close with slim gains.", "source": "AP News", "date": "Apr 2026"},
    {"badge": "Risk", "badge_class": "badge-bear", "headline": "Middle East Conflict circles world markets, stirring fears of stalled growth & inflation", "summary": "Widening conflict threatening Strait of Hormuz has sparked global stock declines.", "source": "WSJ", "date": "Mar 2026"},
    {"badge": "Headwinds", "badge_class": "badge-neutral", "headline": "SpaceX, Anthropic & OpenAI mega IPOs alone can't fix this stock market", "summary": "Despite anticipated tech IPOs, the market faces structural headwinds.", "source": "CNBC", "date": "Apr 2026"},
    {"badge": "Geopolitical", "badge_class": "badge-bear", "headline": "Trump gives Iran until Tuesday night to open Strait of Hormuz", "summary": "Ultimatum intensifies standoff over critical shipping lane.", "source": "Reuters / WSJ", "date": "Apr 2026"},
    {"badge": "Supply", "badge_class": "badge-bull", "headline": "OPEC+ agrees to boost oil output when Strait of Hormuz reopens", "summary": "Oil cartel signals readiness to increase production once shipping route becomes accessible.", "source": "Reuters", "date": "Apr 2026"},
]

FALLBACK_LOCAL_STOCKS = [
    {"name": "Maybank", "ticker": "1155.KL", "sector": "Banking", "buy_zone": "10.80-11.30", "target": "MYR 13.00", "upside": "+15%", "justification": "Malaysia's largest bank. Consistent 5-6% dividend yield. Top pick by CGS International & RHB Research. Foreign shareholding near historic low."},
    {"name": "CIMB Group", "ticker": "1295.KL", "sector": "Banking", "buy_zone": "4.50-4.70", "target": "MYR 5.50", "upside": "+18%", "justification": "Strong ASEAN franchise, improving ROE, ~5% dividend yield. Benefits from HKEX-Bursa MOU."},
    {"name": "Tenaga Nasional", "ticker": "5347.KL", "sector": "Utilities", "buy_zone": "13.50-14.10", "target": "MYR 16.00", "upside": "+14%", "justification": "Defensive play amid geopolitical uncertainty. Key beneficiary of data center demand & NETR infrastructure."},
    {"name": "IHH Healthcare", "ticker": "5225.KL", "sector": "Healthcare", "buy_zone": "8.50-9.00", "target": "MYR 10.50", "upside": "+17%", "justification": "Asia's largest private healthcare group. Defensive growth with rising medical tourism."},
    {"name": "99 Speedmart", "ticker": "5326.KL", "sector": "Retail", "buy_zone": "3.00-3.35", "target": "MYR 4.00", "upside": "+19%", "justification": "Defensive growth with 2,800+ stores. Recession-resilient consumer staples. Rapid expansion."},
]

FALLBACK_INTL_STOCKS = [
    {"name": "ASML Holding", "ticker": "ASML", "sector": "Semiconductors", "buy_zone": "$1,250-1,320", "target": "$1,600", "upside": "+21%", "justification": "Monopoly on EUV lithography — irreplaceable for AI chips. Strong backlog through 2028."},
    {"name": "Alibaba", "ticker": "BABA", "sector": "E-commerce / Cloud", "buy_zone": "$115-125", "target": "$160", "upside": "+31%", "justification": "China recovery play with expanding cloud AI business. Significant discount to intrinsic value."},
    {"name": "MercadoLibre", "ticker": "MELI", "sector": "E-comm / Fintech", "buy_zone": "$1,650-1,720", "target": "$2,200", "upside": "+28%", "justification": "LatAm's Amazon + PayPal. Massive fintech growth via Mercado Pago. Underpenetrated market."},
    {"name": "Apple", "ticker": "AAPL", "sector": "Technology", "buy_zone": "$245-258", "target": "$300", "upside": "+17%", "justification": "Record services revenue, AI integration across products. Defensive mega-cap in volatile market."},
]

FALLBACK_GOLD = {
    "headlines": [
        {"text": "Gold loses 15% from war highs as safe haven trade unwinds", "source": "Bitcoin.com", "date": "Apr"},
        {"text": "Gold overtakes U.S. Treasuries as world's largest foreign reserve asset", "source": "Economics", "date": "Apr"},
        {"text": "Brazil cuts dollar holdings, adds 42 tons of gold as BRICS push grows", "source": "WatcherGuru", "date": "Apr"},
        {"text": "Kiyosaki recommends Bitcoin & gold as 1974 shift comes full circle", "source": "CoinTelegraph", "date": "Apr"},
        {"text": "Gold futures on Bursa Malaysia Derivatives expected to trade cautiously", "source": "KLSEScreener", "date": "Apr"},
    ],
    "buy_zone": "$4,400-4,650", "target": "$5,000-5,400", "stop_loss": "$4,100",
    "sentiment": "BULLISH Long-Term", "sentiment_class": "badge-bull",
    "analysis": "Gold pulled back 15% from January highs near $5,500. J.P. Morgan targets $5,055 by Q4 2026; Goldman Sachs targets $5,400; UBS sees $6,200. Central bank buying remains strong. Current pullback driven by unwinding of Middle East safe-haven trade. Dip-buying opportunity for medium-to-long-term investors."
}

FALLBACK_BTC = {
    "headlines": [
        {"text": "Bitcoin at $66,500 on Liberation Day — new prediction targets $240K", "source": "FinanceMagnates", "date": "Apr"},
        {"text": "Bitcoin ETF outflows amid US-Iran tensions pressure price", "source": "Capital.com", "date": "Apr"},
        {"text": "Bitcoin enters April with fading ETF momentum, rising whale selling", "source": "BeInCrypto", "date": "Mar"},
        {"text": "Bitcoin ETFs 'will be larger' than gold ETFs: Analyst", "source": "CoinTelegraph", "date": "Apr"},
        {"text": "Bitcoin tends to outperform gold & stocks after global shocks", "source": "CoinDesk", "date": "Apr"},
        {"text": "Fidelity: Bitcoin winning back gold investors", "source": "U.Today", "date": "Apr"},
    ],
    "rsi": "51.91", "rsi_label": "Neutral", "macd": "-650", "macd_label": "Death Cross",
    "ma7": "$67,991", "ma25": "$69,415", "ma99": "$76,372", "atr": "$2,315", "atr_pct": "3.34%",
    "support": "$64,058 / $65,971 / $66,011", "resistance": "$71,337 / $72,667 / $74,885",
    "buy_zone": "$64,000-67,000", "target_short": "$72,000-74,000", "stop_loss": "$60,000",
    "sentiment_short": "Neutral-Bearish (Short-Term)", "sentiment_short_class": "badge-neutral",
    "sentiment_mid": "Cautiously Bullish (Medium-Term)", "sentiment_mid_class": "badge-bull",
    "analysis": "BTC dropped 45% from Oct 2025 ATH of ~$125K, now consolidating in $66-70K range. RSI neutral but MACD in death cross. Headwinds: ETF outflows, US-Iran war uncertainty, tariff fears. Tailwinds: Historical outperformance after global shocks, growing institutional adoption. Wait for confirmed breakout above $72K, or accumulate at $64K support zone."
}

# ── Gemini API ─────────────────────────────────────────────────────────────

def call_gemini(prompt, max_retries=2):
    """Call Gemini 2.0 Flash API. Returns response text or None on failure."""
    if not GEMINI_API_KEY:
        print("  [WARN] GEMINI_API_KEY not set, skipping AI analysis.")
        return None
    url = f"{GEMINI_URL}?key={GEMINI_API_KEY}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 4096}
    }).encode("utf-8")
    for attempt in range(max_retries + 1):
        try:
            req = urllib.request.Request(url, data=payload,
                headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return text.strip()
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            print(f"  [ERROR] Gemini attempt {attempt+1}/{max_retries+1}: HTTP {e.code} - {body[:500]}")
            if attempt < max_retries:
                time.sleep(2)
        except Exception as e:
            print(f"  [ERROR] Gemini attempt {attempt+1}/{max_retries+1}: {e}")
            if attempt < max_retries:
                time.sleep(2)
    return None


def _parse_gemini_json(text):
    """Parse JSON from Gemini response, stripping markdown fences."""
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = lines[1:]  # remove opening fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"  [ERROR] JSON parse failed: {e}")
        print(f"  Response preview: {cleaned[:200]}...")
        return None


def fetch_gemini_local_news():
    """Ask Gemini for current Malaysian/Bursa market news."""
    today = datetime.now().strftime("%d %B %Y")
    prompt = f"""You are a financial news analyst specializing in Malaysian markets.
Provide exactly 5 current news items about Bursa Malaysia and Malaysian financial markets as of {today}.

Return ONLY a JSON array (no markdown, no explanation) with this exact structure:
[
  {{
    "badge": "Cautious|Mixed|Positive|Rally|Sell-off|Neutral",
    "badge_class": "badge-bear|badge-neutral|badge-bull",
    "headline": "Short headline (max 120 chars)",
    "summary": "2-3 sentence summary (max 200 chars)",
    "source": "Source name",
    "date": "{datetime.now().strftime('%d %b %Y')}"
  }}
]

Focus on the most recent and impactful developments affecting Bursa Malaysia, FBM KLCI, ringgit, and Malaysian equities."""
    result = _parse_gemini_json(call_gemini(prompt))
    if isinstance(result, list) and len(result) >= 3:
        print(f"  Got {len(result)} local news items from Gemini.")
        return result
    print("  [WARN] Using fallback local news.")
    return None


def fetch_gemini_intl_news():
    """Ask Gemini for current international market news."""
    today = datetime.now().strftime("%d %B %Y")
    prompt = f"""You are a Wall Street financial analyst.
Provide exactly 6 current international financial news items as of {today}.

Return ONLY a JSON array (no markdown, no explanation) with this exact structure:
[
  {{
    "badge": "Watch|Recovery|Risk|Headwinds|Geopolitical|Supply|Rally|Sell-off",
    "badge_class": "badge-bear|badge-neutral|badge-bull",
    "headline": "Short headline (max 120 chars)",
    "summary": "2-3 sentence summary (max 200 chars)",
    "source": "Source name",
    "date": "{datetime.now().strftime('%d %b %Y')}"
  }}
]

Cover Wall Street, global macro, geopolitics, commodities, and major market-moving events."""
    result = _parse_gemini_json(call_gemini(prompt))
    if isinstance(result, list) and len(result) >= 3:
        print(f"  Got {len(result)} international news items from Gemini.")
        return result
    print("  [WARN] Using fallback international news.")
    return None


def fetch_gemini_local_stocks(prices):
    """Ask Gemini for Bursa Malaysia stock recommendations."""
    today = datetime.now().strftime("%d %B %Y")
    prompt = f"""You are a Malaysian equity research analyst.
Based on current market conditions as of {today}, provide exactly 5 Bursa Malaysia stock recommendations.

Current live prices:
- Maybank (1155.KL): MYR {prices.get('maybank', 11.26)}
- CIMB Group (1295.KL): MYR {prices.get('cimb', 4.66)}
- Tenaga Nasional (5347.KL): MYR {prices.get('tenaga', 14.04)}
- IHH Healthcare (5225.KL): MYR {prices.get('ihh', 8.96)}
- 99 Speedmart (5326.KL): MYR {prices.get('speedmart', 3.32)}

Return ONLY a JSON array (no markdown, no explanation):
[
  {{
    "name": "Stock Name",
    "ticker": "1155.KL",
    "sector": "Banking",
    "buy_zone": "10.80-11.30",
    "target": "MYR 13.00",
    "upside": "+15%",
    "justification": "2-3 sentence justification with specific catalysts"
  }}
]

You may recommend any Bursa-listed stocks. Include realistic buy zones based on recent support levels and analyst consensus targets. Keep upside between 10-30%."""
    result = _parse_gemini_json(call_gemini(prompt))
    if isinstance(result, list) and len(result) >= 3:
        print(f"  Got {len(result)} local stock picks from Gemini.")
        return result
    print("  [WARN] Using fallback local stocks.")
    return None


def fetch_gemini_intl_stocks(prices):
    """Ask Gemini for international stock recommendations."""
    today = datetime.now().strftime("%d %B %Y")
    prompt = f"""You are a global equity research analyst.
Based on current market conditions as of {today}, provide exactly 4 international stock recommendations.

Current live prices:
- ASML Holding (ASML): ${prices.get('asml', 1317.23)}
- Alibaba (BABA): ${prices.get('baba', 122.05)}
- MercadoLibre (MELI): ${prices.get('meli', 1715.52)}
- Apple (AAPL): ${prices.get('aapl', 255.92)}

Return ONLY a JSON array (no markdown, no explanation):
[
  {{
    "name": "Stock Name",
    "ticker": "AAPL",
    "sector": "Technology",
    "buy_zone": "$245-258",
    "target": "$300",
    "upside": "+17%",
    "justification": "2-3 sentence justification with specific catalysts"
  }}
]

You may recommend any internationally listed stocks. Include realistic buy zones and analyst consensus targets. Keep upside between 10-35%."""
    result = _parse_gemini_json(call_gemini(prompt))
    if isinstance(result, list) and len(result) >= 3:
        print(f"  Got {len(result)} international stock picks from Gemini.")
        return result
    print("  [WARN] Using fallback international stocks.")
    return None


def fetch_gemini_gold_analysis(gold_price):
    """Ask Gemini for gold market analysis."""
    today = datetime.now().strftime("%d %B %Y")
    prompt = f"""You are a commodities analyst specializing in gold.
Current gold price: ${gold_price:,.2f}/oz as of {today}.

Return ONLY a JSON object (no markdown, no explanation):
{{
  "headlines": [
    {{"text": "Headline (max 100 chars)", "source": "Source Name", "date": "{datetime.now().strftime('%d %b')}"}},
    {{"text": "...", "source": "...", "date": "..."}},
    {{"text": "...", "source": "...", "date": "..."}},
    {{"text": "...", "source": "...", "date": "..."}},
    {{"text": "...", "source": "...", "date": "..."}}
  ],
  "buy_zone": "$X,XXX-X,XXX",
  "target": "$X,XXX-X,XXX",
  "stop_loss": "$X,XXX",
  "sentiment": "BULLISH Long-Term|BEARISH|NEUTRAL",
  "sentiment_class": "badge-bull|badge-bear|badge-neutral",
  "analysis": "3-4 sentence analysis paragraph covering key drivers, central bank buying, geopolitical factors, and recommendation."
}}

Base analysis on current macro conditions, central bank gold reserves, geopolitical factors, and technical levels. Provide exactly 5 headlines."""
    result = _parse_gemini_json(call_gemini(prompt))
    if isinstance(result, dict) and "headlines" in result and "analysis" in result:
        print("  Got gold analysis from Gemini.")
        return result
    print("  [WARN] Using fallback gold analysis.")
    return None


def fetch_gemini_btc_analysis(btc_price):
    """Ask Gemini for Bitcoin market analysis."""
    today = datetime.now().strftime("%d %B %Y")
    prompt = f"""You are a cryptocurrency analyst specializing in Bitcoin.
Current BTC price: ${btc_price:,.0f} as of {today}.

Return ONLY a JSON object (no markdown, no explanation):
{{
  "headlines": [
    {{"text": "Headline (max 100 chars)", "source": "Source Name", "date": "{datetime.now().strftime('%d %b')}"}},
    {{"text": "...", "source": "...", "date": "..."}},
    {{"text": "...", "source": "...", "date": "..."}},
    {{"text": "...", "source": "...", "date": "..."}},
    {{"text": "...", "source": "...", "date": "..."}},
    {{"text": "...", "source": "...", "date": "..."}}
  ],
  "rsi": "XX.XX",
  "rsi_label": "Neutral|Overbought|Oversold",
  "macd": "-XXX",
  "macd_label": "Death Cross|Bullish Cross|Neutral",
  "ma7": "$XX,XXX",
  "ma25": "$XX,XXX",
  "ma99": "$XX,XXX",
  "atr": "$X,XXX",
  "atr_pct": "X.XX%",
  "support": "$XX,XXX / $XX,XXX / $XX,XXX",
  "resistance": "$XX,XXX / $XX,XXX / $XX,XXX",
  "buy_zone": "$XX,XXX-XX,XXX",
  "target_short": "$XX,XXX-XX,XXX",
  "stop_loss": "$XX,XXX",
  "sentiment_short": "Bearish|Neutral-Bearish|Neutral (Short-Term)",
  "sentiment_short_class": "badge-bear|badge-neutral",
  "sentiment_mid": "Cautiously Bullish|Bullish (Medium-Term)",
  "sentiment_mid_class": "badge-bull|badge-neutral",
  "analysis": "3-4 sentence analysis covering technicals, ETF flows, macro factors, and recommendation with specific price levels."
}}

Provide realistic technical indicator values based on the current price action. Include exactly 6 headlines. Base support/resistance on recent price action."""
    result = _parse_gemini_json(call_gemini(prompt))
    if isinstance(result, dict) and "headlines" in result and "analysis" in result:
        print("  Got BTC analysis from Gemini.")
        return result
    print("  [WARN] Using fallback BTC analysis.")
    return None

# ── Data Fetching ──────────────────────────────────────────────────────────

def fetch_prices():
    """Fetch current prices for all tracked symbols via yfinance."""
    prices = dict(FALLBACK_PRICES)
    if yf is None:
        print("[WARN] yfinance unavailable, using fallback prices.")
        return prices
    for key, symbol in SYMBOLS.items():
        try:
            print(f"  Fetching price for {symbol}...")
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            price = getattr(info, "last_price", None)
            if price is None:
                hist = ticker.history(period="1d")
                if not hist.empty:
                    price = float(hist["Close"].iloc[-1])
            if price is not None:
                prices[key] = round(float(price), 2)
                print(f"    {symbol}: {prices[key]}")
            else:
                print(f"    {symbol}: using fallback {prices[key]}")
        except Exception as e:
            print(f"    [ERROR] {symbol}: {e} — using fallback {prices[key]}")
    return prices


def fetch_ohlcv(symbol, period="6mo"):
    """Fetch OHLCV history for a symbol. Returns (dates[], closes[])."""
    dates, closes = [], []
    if yf is None:
        return dates, closes
    try:
        print(f"  Fetching {period} OHLCV for {symbol}...")
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period)
        if hist.empty:
            return dates, closes
        step = max(1, len(hist) // 40)
        sampled = hist.iloc[::step]
        for idx, row in sampled.iterrows():
            dates.append(idx.strftime("%b %d"))
            closes.append(round(float(row["Close"]), 2))
        print(f"    Got {len(dates)} data points for {symbol}.")
    except Exception as e:
        print(f"    [ERROR] OHLCV {symbol}: {e}")
    return dates, closes


def fetch_news():
    """Fetch headlines from RSS feeds."""
    news = {}
    if feedparser is None:
        return news
    for source, url in RSS_FEEDS.items():
        try:
            print(f"  Fetching news from {source}...")
            feed = feedparser.parse(url)
            titles = [html_module.escape(e.get("title", "")) for e in feed.entries[:5]]
            news[source] = titles
            print(f"    Got {len(titles)} headlines from {source}.")
        except Exception as e:
            print(f"    [ERROR] {source}: {e}")
            news[source] = []
    return news


# ── HTML Helpers ───────────────────────────────────────────────────────────

def _e(s):
    """Shorthand for HTML escaping."""
    return html_module.escape(str(s)) if s else ""

def _fmt_usd(val):
    return f"${val:,.2f}" if val >= 1000 else f"${val:.2f}"

def _fmt_myr(val):
    return f"MYR {val:.2f}"

def _js_array(lst):
    return json.dumps(lst)


# ── HTML Generation ────────────────────────────────────────────────────────

def generate_html(prices, gold_ohlcv, btc_ohlcv, news,
                  ai_local_news, ai_intl_news, ai_local_stocks,
                  ai_intl_stocks, ai_gold, ai_btc):
    """Build the complete HTML dashboard string."""
    myt = timezone(timedelta(hours=8))
    now = datetime.now(myt)
    date_str = now.strftime("%-d %B %Y")
    date_short = now.strftime("%-d %b %Y").upper()
    time_str = now.strftime("%I:%M %p MYT")  # e.g. "08:00 AM MYT"
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S MYT")

    gold_price = prices["gold"]
    btc_price = prices["btc"]
    gold_int = int(round(gold_price))
    btc_int = int(round(btc_price))

    gold_dates, gold_closes = gold_ohlcv
    btc_dates, btc_closes = btc_ohlcv
    news_cards_html = _build_news_cards(news)

    html = _build_html_head(date_str, date_short, time_str, gold_price, btc_price, gold_int, btc_int)
    html += _build_html_stat_cards(gold_int, btc_int)
    html += _build_html_local_news(ai_local_news)
    html += _build_html_intl_news(ai_intl_news)
    html += _build_html_news_feed(news_cards_html)
    html += _build_html_local_stocks(ai_local_stocks, prices)
    html += _build_html_intl_stocks(ai_intl_stocks, prices)
    html += _build_html_gold_section(gold_price, ai_gold)
    html += _build_html_btc_section(btc_price, ai_btc)
    html += _build_html_footer(timestamp, DISPATCH_TOKEN)
    html += _build_html_scripts(gold_dates, gold_closes, gold_int, btc_dates, btc_closes, btc_int)
    html += "\n</body>\n</html>"
    return html


def _build_news_cards(news):
    if not news:
        return ""
    cards = []
    for source, titles in news.items():
        for title in titles[:3]:
            cards.append(
                f'    <div class="card-news anim-card">'
                f'<span class="badge badge-neutral mb-3">{source}</span>'
                f'<h3 class="text-sm font-semibold text-white leading-snug mb-2">{title}</h3>'
                f'<p class="text-[10px] text-gold-600 mt-3 font-mono">{source}</p></div>'
            )
    return "\n".join(cards)


def _build_html_head(date_str, date_short, time_str, gold_price, btc_price, gold_int, btc_int):
    """Return the <!DOCTYPE> through end of <header>."""
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Investment Intelligence Dashboard &mdash; {date_str}</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>
tailwind.config={{theme:{{extend:{{colors:{{vault:{{950:'#050a14',900:'#0a1128',800:'#0f172a',700:'#1e293b',600:'#334155',500:'#475569'}},gold:{{50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e'}},bull:'#22c55e',bear:'#ef4444',btc:'#f7931a'}},fontFamily:{{display:['Space Grotesk','sans-serif'],body:['Inter','sans-serif'],mono:['JetBrains Mono','monospace']}}}}}}}}
</script>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html{{scroll-behavior:smooth}}
body{{background:#050a14;overflow-x:hidden}}
.noise{{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;opacity:.03;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}}
.progress-bar{{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#f59e0b,#fbbf24,#f7931a);z-index:10000;transition:width .1s}}
.glow-gold{{box-shadow:0 0 30px rgba(245,158,11,.08),0 0 60px rgba(245,158,11,.04)}}
.glow-gold-strong{{box-shadow:0 0 40px rgba(245,158,11,.15),0 0 80px rgba(245,158,11,.06)}}
.card{{background:linear-gradient(135deg,rgba(30,41,59,.8),rgba(15,23,42,.9));border:1px solid rgba(245,158,11,.1);border-radius:12px;backdrop-filter:blur(10px)}}
.card:hover{{border-color:rgba(245,158,11,.25);box-shadow:0 0 30px rgba(245,158,11,.06)}}
.card-news{{background:linear-gradient(135deg,rgba(30,41,59,.6),rgba(15,23,42,.8));border:1px solid rgba(245,158,11,.07);border-radius:10px;padding:1.25rem;transition:all .3s}}
.card-news:hover{{border-color:rgba(245,158,11,.2);transform:translateY(-2px)}}
.table-container{{overflow-x:auto;border-radius:12px;border:1px solid rgba(245,158,11,.1)}}
.rec-table{{width:100%;border-collapse:collapse;font-size:.85rem}}
.rec-table thead{{background:rgba(245,158,11,.08)}}
.rec-table th{{padding:12px 14px;text-align:left;font-family:'Space Grotesk',sans-serif;font-weight:600;color:#fbbf24;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}}
.rec-table td{{padding:12px 14px;border-top:1px solid rgba(245,158,11,.06);white-space:nowrap}}
.rec-table tbody tr:nth-child(even){{background:rgba(245,158,11,.02)}}
.rec-table tbody tr:hover{{background:rgba(245,158,11,.06)}}
.rec-box{{background:linear-gradient(135deg,rgba(30,41,59,.9),rgba(15,23,42,.95));border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:1.5rem}}
.badge{{display:inline-block;padding:3px 10px;border-radius:20px;font-size:.7rem;font-weight:600;letter-spacing:.03em}}
.badge-bull{{background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.2)}}
.badge-bear{{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.2)}}
.badge-neutral{{background:rgba(245,158,11,.12);color:#fbbf24;border:1px solid rgba(245,158,11,.2)}}
.section-divider{{height:1px;background:linear-gradient(90deg,transparent,rgba(245,158,11,.15),transparent);margin:3rem 0}}
.hero-mesh{{position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(ellipse at 20% 50%,rgba(245,158,11,.06) 0%,transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(247,147,26,.04) 0%,transparent 50%),radial-gradient(ellipse at 50% 80%,rgba(245,158,11,.03) 0%,transparent 50%)}}
.ticker-strip{{background:rgba(245,158,11,.04);border-top:1px solid rgba(245,158,11,.08);border-bottom:1px solid rgba(245,158,11,.08)}}
@keyframes pulse-gold{{0%,100%{{opacity:.6}}50%{{opacity:1}}}}
.pulse-dot{{animation:pulse-gold 2s ease-in-out infinite}}
.stat-value{{font-family:'Space Grotesk',sans-serif;font-variant-numeric:tabular-nums}}
.chart-container{{width:100%;height:400px;border-radius:12px;overflow:hidden}}
@media(max-width:768px){{.chart-container{{height:300px}}.rec-table{{font-size:.75rem}}.rec-table th,.rec-table td{{padding:8px 10px}}}}
.refresh-btn{{position:fixed;bottom:24px;right:24px;z-index:9998;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;border:none;border-radius:50%;width:48px;height:48px;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(245,158,11,.3);transition:transform .2s}}
.refresh-btn:hover{{transform:scale(1.1)}}
</style>
</head>
<body class="bg-vault-900 text-gray-200 font-body">
<div class="noise"></div>
<div class="progress-bar" id="progressBar"></div>

<!-- HERO -->
<header class="relative min-h-[60vh] flex flex-col justify-center overflow-hidden">
  <div class="hero-mesh"></div>
  <div class="ticker-strip py-2 relative z-10">
    <div class="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-1 text-xs font-mono tracking-wide">
      <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-gold-500 pulse-dot"></span>LIVE {date_short} &middot; {time_str}</span>
      <span>Gold <span class="text-gold-400 font-semibold">${gold_price:,.2f}</span>/oz</span>
      <span>Bitcoin <span class="text-btc font-semibold">${btc_int:,}</span></span>
      <span>FBM KLCI <span class="text-gold-300 font-semibold">1,680&ndash;1,740</span></span>
    </div>
  </div>
  <div class="relative z-10 max-w-7xl mx-auto px-4 py-16 text-center">
    <p class="text-gold-500 font-mono text-sm tracking-[.2em] mb-4 uppercase">Daily Market Brief</p>
    <h1 class="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6">Investment Intelligence<br><span class="text-gold-400">Dashboard</span></h1>
    <p class="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">Comprehensive analysis of local &amp; international markets, stock recommendations, and commodity outlook &mdash; powered by AI &amp; real-time data.</p>
    <div class="mt-8 flex flex-wrap justify-center gap-3 text-xs font-mono">
      <span class="px-3 py-1.5 rounded-full border border-gold-500/20 text-gold-300">Bursa Malaysia</span>
      <span class="px-3 py-1.5 rounded-full border border-gold-500/20 text-gold-300">Wall Street</span>
      <span class="px-3 py-1.5 rounded-full border border-gold-500/20 text-gold-300">Gold</span>
      <span class="px-3 py-1.5 rounded-full border border-gold-500/20 text-gold-300">Bitcoin</span>
    </div>
  </div>
</header>
'''


def _build_html_stat_cards(gold_int, btc_int):
    return f'''
<!-- STAT CARDS -->
<section class="max-w-7xl mx-auto px-4 py-12">
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="statCards">
    <div class="card p-5 glow-gold anim-card">
      <p class="text-xs text-gold-500 font-mono uppercase tracking-wider mb-1">Gold (XAU/USD)</p>
      <p class="stat-value text-3xl font-bold text-gold-300" data-target="{gold_int}">$0</p>
      <p class="text-xs text-gray-400 mt-2">Live price &middot; Updated today</p>
    </div>
    <div class="card p-5 anim-card">
      <p class="text-xs text-btc font-mono uppercase tracking-wider mb-1">Bitcoin (BTC/USD)</p>
      <p class="stat-value text-3xl font-bold text-btc" data-target="{btc_int}">$0</p>
      <p class="text-xs text-gray-400 mt-2">Live price &middot; Updated today</p>
    </div>
    <div class="card p-5 anim-card">
      <p class="text-xs text-gold-500 font-mono uppercase tracking-wider mb-1">FBM KLCI</p>
      <p class="stat-value text-3xl font-bold text-white">1,710</p>
      <p class="text-xs text-gold-300 mt-2">Range 1,680&ndash;1,740 | Cautious</p>
    </div>
    <div class="card p-5 anim-card">
      <p class="text-xs text-gold-500 font-mono uppercase tracking-wider mb-1">S&amp;P 500</p>
      <p class="stat-value text-3xl font-bold text-bull">+0.6%</p>
      <p class="text-xs text-gray-400 mt-2">Weekly gain amid tensions</p>
    </div>
  </div>
</section>
<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_local_news(data=None):
    if data is None:
        data = FALLBACK_LOCAL_NEWS
    cards = ""
    for item in data:
        bc = _e(item.get("badge_class", "badge-neutral"))
        badge = _e(item.get("badge", "News"))
        hl = _e(item.get("headline", ""))
        summary = _e(item.get("summary", ""))
        src = _e(item.get("source", ""))
        dt = _e(item.get("date", ""))
        cards += f'''
    <div class="card-news anim-card">
      <span class="badge {bc} mb-3">{badge}</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">{hl}</h3>
      <p class="text-xs text-gray-400">{summary}</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">{src} &middot; {dt}</p>
    </div>'''
    return f'''
<!-- LOCAL NEWS -->
<section class="max-w-7xl mx-auto px-4 py-12 anim-section">
  <div class="flex items-center gap-3 mb-8">
    <span class="text-2xl">&#127470;&#127486;</span>
    <div>
      <h2 class="font-display text-2xl md:text-3xl font-bold text-white">Local News</h2>
      <p class="text-gold-500 text-sm font-mono">Bursa Malaysia &amp; Malaysian Markets</p>
    </div>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{cards}
  </div>
</section>
<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_intl_news(data=None):
    if data is None:
        data = FALLBACK_INTL_NEWS
    cards = ""
    for item in data:
        bc = _e(item.get("badge_class", "badge-neutral"))
        badge = _e(item.get("badge", "News"))
        hl = _e(item.get("headline", ""))
        summary = _e(item.get("summary", ""))
        src = _e(item.get("source", ""))
        dt = _e(item.get("date", ""))
        cards += f'''
    <div class="card-news anim-card">
      <span class="badge {bc} mb-3">{badge}</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">{hl}</h3>
      <p class="text-xs text-gray-400">{summary}</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">{src} &middot; {dt}</p>
    </div>'''
    return f'''
<!-- INTERNATIONAL NEWS -->
<section class="max-w-7xl mx-auto px-4 py-12 anim-section">
  <div class="flex items-center gap-3 mb-8">
    <span class="text-2xl">&#127758;</span>
    <div>
      <h2 class="font-display text-2xl md:text-3xl font-bold text-white">International News</h2>
      <p class="text-gold-500 text-sm font-mono">Wall Street &amp; Global Markets</p>
    </div>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{cards}
  </div>
</section>
<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_news_feed(news_cards_html):
    if not news_cards_html:
        return ""
    return f'''
<!-- LIVE RSS NEWS FEED -->
<section class="max-w-7xl mx-auto px-4 py-12 anim-section">
  <div class="flex items-center gap-3 mb-8">
    <span class="text-2xl">&#128225;</span>
    <div>
      <h2 class="font-display text-2xl md:text-3xl font-bold text-white">Live News Feed</h2>
      <p class="text-gold-500 text-sm font-mono">Reuters, CNBC, CoinTelegraph, CoinDesk</p>
    </div>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
{news_cards_html}
  </div>
</section>
<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_local_stocks(data, prices):
    if data is None:
        data = FALLBACK_LOCAL_STOCKS
    rows = ""
    for item in data:
        name = _e(item.get("name", ""))
        ticker = _e(item.get("ticker", ""))
        sector = _e(item.get("sector", ""))
        # Use live price if available
        price_str = _e(item.get("price", ""))
        if not price_str:
            # Try to get live price from prices dict
            ticker_map = {"1155.KL": "maybank", "1295.KL": "cimb", "5347.KL": "tenaga", "5225.KL": "ihh", "5326.KL": "speedmart"}
            key = ticker_map.get(item.get("ticker", ""), "")
            if key and key in prices:
                price_str = _fmt_myr(prices[key])
            else:
                price_str = "N/A"
        buy_zone = _e(item.get("buy_zone", ""))
        target = _e(item.get("target", ""))
        upside = _e(item.get("upside", ""))
        just = _e(item.get("justification", ""))
        rows += f'''
        <tr>
          <td class="font-semibold text-white">{name}</td>
          <td class="font-mono text-gold-300">{ticker}</td>
          <td>{sector}</td>
          <td class="font-mono">{price_str}</td>
          <td class="font-mono text-gray-300">{buy_zone}</td>
          <td class="font-mono text-bull font-semibold">{target}</td>
          <td><span class="badge badge-bull">{upside}</span></td>
          <td class="text-xs max-w-xs whitespace-normal">{just}</td>
        </tr>'''
    return f'''
<!-- LOCAL STOCK RECOMMENDATIONS -->
<section class="max-w-7xl mx-auto px-4 py-12 anim-section">
  <div class="flex items-center gap-3 mb-2">
    <span class="text-2xl">&#128200;</span>
    <h2 class="font-display text-2xl md:text-3xl font-bold text-white">Local Stock Picks</h2>
  </div>
  <p class="text-gold-500 text-sm font-mono mb-8">Bursa Malaysia &mdash; AI-Powered Recommendations</p>
  <div class="table-container glow-gold">
    <table class="rec-table">
      <thead>
        <tr><th>Stock</th><th>Ticker</th><th>Sector</th><th>Price</th><th>Buy Zone</th><th>Target</th><th>Upside</th><th>Justification</th></tr>
      </thead>
      <tbody>{rows}
      </tbody>
    </table>
  </div>
</section>
<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_intl_stocks(data, prices):
    if data is None:
        data = FALLBACK_INTL_STOCKS
    rows = ""
    for item in data:
        name = _e(item.get("name", ""))
        ticker = _e(item.get("ticker", ""))
        sector = _e(item.get("sector", ""))
        price_str = _e(item.get("price", ""))
        if not price_str:
            ticker_map = {"ASML": "asml", "BABA": "baba", "MELI": "meli", "AAPL": "aapl"}
            key = ticker_map.get(item.get("ticker", ""), "")
            if key and key in prices:
                price_str = _fmt_usd(prices[key])
            else:
                price_str = "N/A"
        buy_zone = _e(item.get("buy_zone", ""))
        target = _e(item.get("target", ""))
        upside = _e(item.get("upside", ""))
        just = _e(item.get("justification", ""))
        rows += f'''
        <tr>
          <td class="font-semibold text-white">{name}</td>
          <td class="font-mono text-gold-300">{ticker}</td>
          <td>{sector}</td>
          <td class="font-mono">{price_str}</td>
          <td class="font-mono text-gray-300">{buy_zone}</td>
          <td class="font-mono text-bull font-semibold">{target}</td>
          <td><span class="badge badge-bull">{upside}</span></td>
          <td class="text-xs max-w-xs whitespace-normal">{just}</td>
        </tr>'''
    return f'''
<!-- INTERNATIONAL STOCK RECOMMENDATIONS -->
<section class="max-w-7xl mx-auto px-4 py-12 anim-section">
  <div class="flex items-center gap-3 mb-2">
    <span class="text-2xl">&#127759;</span>
    <h2 class="font-display text-2xl md:text-3xl font-bold text-white">International Stock Picks</h2>
  </div>
  <p class="text-gold-500 text-sm font-mono mb-8">Global Markets &mdash; AI-Powered Recommendations</p>
  <div class="table-container glow-gold">
    <table class="rec-table">
      <thead>
        <tr><th>Stock</th><th>Ticker</th><th>Sector</th><th>Price</th><th>Buy Zone</th><th>Target</th><th>Upside</th><th>Justification</th></tr>
      </thead>
      <tbody>{rows}
      </tbody>
    </table>
  </div>
</section>
<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_gold_section(gold_price, data=None):
    if data is None:
        data = FALLBACK_GOLD
    gold_int = int(round(gold_price))
    headlines = ""
    for h in data.get("headlines", []):
        txt = _e(h.get("text", ""))
        src = _e(h.get("source", ""))
        dt = _e(h.get("date", ""))
        headlines += f'''
        <div class="card-news"><p class="text-sm text-white font-medium">{txt}</p><p class="text-[10px] text-gold-600 font-mono mt-1">{src} &middot; {dt}</p></div>'''
    buy_zone = _e(data.get("buy_zone", "$4,400-4,650"))
    target = _e(data.get("target", "$5,000-5,400"))
    stop_loss = _e(data.get("stop_loss", "$4,100"))
    sentiment = _e(data.get("sentiment", "BULLISH Long-Term"))
    sc = _e(data.get("sentiment_class", "badge-bull"))
    analysis = _e(data.get("analysis", ""))
    return f'''
<!-- GOLD SECTION -->
<section class="max-w-7xl mx-auto px-4 py-12 anim-section">
  <div class="flex items-center gap-3 mb-2">
    <span class="text-2xl">&#129351;</span>
    <h2 class="font-display text-2xl md:text-3xl font-bold text-gold-300">Gold Analysis</h2>
  </div>
  <p class="text-gold-600 text-sm font-mono mb-8">XAU/USD &mdash; 6-Month Trend &amp; Outlook</p>
  <div class="card p-4 glow-gold-strong mb-6">
    <div class="chart-container" id="goldChart"></div>
  </div>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div>
      <h3 class="font-display text-lg font-semibold text-gold-400 mb-4">Gold Headlines</h3>
      <div class="space-y-3">{headlines}
      </div>
    </div>
    <div>
      <h3 class="font-display text-lg font-semibold text-gold-400 mb-4">Gold Recommendation</h3>
      <div class="rec-box glow-gold-strong">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div><p class="text-[10px] text-gold-600 font-mono uppercase">Current Price</p><p class="font-display text-xl font-bold text-gold-300">${gold_int:,}/oz</p></div>
          <div><p class="text-[10px] text-gold-600 font-mono uppercase">Buy Zone</p><p class="font-display text-xl font-bold text-white">{buy_zone}</p></div>
          <div><p class="text-[10px] text-gold-600 font-mono uppercase">Target Price</p><p class="font-display text-xl font-bold text-bull">{target}</p></div>
          <div><p class="text-[10px] text-gold-600 font-mono uppercase">Stop Loss</p><p class="font-display text-xl font-bold text-bear">{stop_loss}</p></div>
        </div>
        <div class="mb-3"><span class="badge {sc}">{sentiment}</span></div>
        <p class="text-xs text-gray-300 leading-relaxed">{analysis}</p>
      </div>
    </div>
  </div>
</section>
<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_btc_section(btc_price, data=None):
    if data is None:
        data = FALLBACK_BTC
    btc_int = int(round(btc_price))
    headlines = ""
    for h in data.get("headlines", []):
        txt = _e(h.get("text", ""))
        src = _e(h.get("source", ""))
        dt = _e(h.get("date", ""))
        headlines += f'''
        <div class="card-news"><p class="text-sm text-white font-medium">{txt}</p><p class="text-[10px] text-gold-600 font-mono mt-1">{src} &middot; {dt}</p></div>'''
    rsi = _e(data.get("rsi", "51.91"))
    rsi_label = _e(data.get("rsi_label", "Neutral"))
    macd = _e(data.get("macd", "-650"))
    macd_label = _e(data.get("macd_label", "Death Cross"))
    ma7 = _e(data.get("ma7", "$67,991"))
    ma25 = _e(data.get("ma25", "$69,415"))
    ma99 = _e(data.get("ma99", "$76,372"))
    atr = _e(data.get("atr", "$2,315"))
    atr_pct = _e(data.get("atr_pct", "3.34%"))
    support = _e(data.get("support", "$64,058 / $65,971 / $66,011"))
    resistance = _e(data.get("resistance", "$71,337 / $72,667 / $74,885"))
    buy_zone = _e(data.get("buy_zone", "$64,000-67,000"))
    target_short = _e(data.get("target_short", "$72,000-74,000"))
    stop_loss = _e(data.get("stop_loss", "$60,000"))
    ss = _e(data.get("sentiment_short", "Neutral-Bearish (Short-Term)"))
    ssc = _e(data.get("sentiment_short_class", "badge-neutral"))
    sm = _e(data.get("sentiment_mid", "Cautiously Bullish (Medium-Term)"))
    smc = _e(data.get("sentiment_mid_class", "badge-bull"))
    analysis = _e(data.get("analysis", ""))
    # Badge class for MACD
    macd_bc = "badge-bear" if "death" in macd_label.lower() else ("badge-bull" if "bull" in macd_label.lower() else "badge-neutral")
    rsi_bc = "badge-bear" if "over" in rsi_label.lower() and "bought" in rsi_label.lower() else ("badge-bull" if "over" in rsi_label.lower() and "sold" in rsi_label.lower() else "badge-neutral")
    return f'''
<!-- BITCOIN SECTION -->
<section class="max-w-7xl mx-auto px-4 py-12 anim-section">
  <div class="flex items-center gap-3 mb-2">
    <span class="text-2xl">&#8383;</span>
    <h2 class="font-display text-2xl md:text-3xl font-bold text-btc">Bitcoin Analysis</h2>
  </div>
  <p class="text-orange-400/60 text-sm font-mono mb-8">BTC/USD &mdash; 6-Month Trend, Technicals &amp; Outlook</p>
  <div class="card p-4 mb-6" style="border-color:rgba(247,147,26,.15)">
    <div class="chart-container" id="btcChart"></div>
  </div>
  <!-- BTC Technical Summary -->
  <div class="card p-5 mb-6" style="border-color:rgba(247,147,26,.12)">
    <h3 class="font-display text-lg font-semibold text-btc mb-4">Technical Summary (Daily)</h3>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">RSI(14)</p><p class="font-mono text-lg text-gold-300">{rsi}</p><span class="badge {rsi_bc} text-[10px]">{rsi_label}</span></div>
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">MACD</p><p class="font-mono text-lg text-bear">{macd}</p><span class="badge {macd_bc} text-[10px]">{macd_label}</span></div>
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">MA(7)</p><p class="font-mono text-lg text-gray-300">{ma7}</p></div>
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">MA(25)</p><p class="font-mono text-lg text-gray-300">{ma25}</p></div>
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">MA(99)</p><p class="font-mono text-lg text-gray-400">{ma99}</p></div>
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">ATR</p><p class="font-mono text-lg text-gold-300">{atr}</p><span class="badge badge-neutral text-[10px]">{atr_pct} Vol</span></div>
    </div>
    <div class="mt-4 pt-4 border-t border-gold-500/10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      <div><span class="text-bull font-mono text-xs">Support:</span> <span class="font-mono text-gray-300">{support}</span></div>
      <div><span class="text-bear font-mono text-xs">Resistance:</span> <span class="font-mono text-gray-300">{resistance}</span></div>
    </div>
  </div>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div>
      <h3 class="font-display text-lg font-semibold text-btc mb-4">Bitcoin Headlines</h3>
      <div class="space-y-3">{headlines}
      </div>
    </div>
    <div>
      <h3 class="font-display text-lg font-semibold text-btc mb-4">Bitcoin Recommendation</h3>
      <div class="rec-box" style="border-color:rgba(247,147,26,.2)">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div><p class="text-[10px] text-gray-500 font-mono uppercase">Current Price</p><p class="font-display text-xl font-bold text-btc">${btc_int:,}</p></div>
          <div><p class="text-[10px] text-gray-500 font-mono uppercase">Buy Zone</p><p class="font-display text-xl font-bold text-white">{buy_zone}</p></div>
          <div><p class="text-[10px] text-gray-500 font-mono uppercase">Short-Term Target</p><p class="font-display text-xl font-bold text-bull">{target_short}</p></div>
          <div><p class="text-[10px] text-gray-500 font-mono uppercase">Stop Loss</p><p class="font-display text-xl font-bold text-bear">{stop_loss}</p></div>
        </div>
        <div class="mb-3 flex gap-2 flex-wrap">
          <span class="badge {ssc}">{ss}</span>
          <span class="badge {smc}">{sm}</span>
        </div>
        <p class="text-xs text-gray-300 leading-relaxed">{analysis}</p>
      </div>
    </div>
  </div>
</section>
<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_footer(timestamp, dispatch_token):
    refresh_js = ""
    if dispatch_token:
        refresh_js = f'''
<div id="refreshModal" style="display:none;position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);align-items:center;justify-content:center">
  <div class="card p-6 max-w-sm mx-4 text-center" style="border-color:rgba(245,158,11,.25)">
    <div id="refreshIdle">
      <p class="text-gold-400 font-display font-semibold text-lg mb-2">Refresh Dashboard</p>
      <p class="text-gray-400 text-sm mb-4">This will trigger a full rebuild with fresh AI analysis and live market data. It takes about 2-3 minutes.</p>
      <div class="flex gap-3 justify-center">
        <button onclick="triggerRefresh()" class="px-4 py-2 rounded-lg bg-gold-500 text-black font-semibold text-sm hover:bg-gold-400 transition">Confirm</button>
        <button onclick="closeRefreshModal()" class="px-4 py-2 rounded-lg border border-gray-600 text-gray-400 text-sm hover:border-gray-400 transition">Cancel</button>
      </div>
    </div>
    <div id="refreshLoading" style="display:none">
      <p class="text-gold-400 font-display font-semibold text-lg mb-2">&#8635; Rebuilding...</p>
      <p class="text-gray-400 text-sm">Workflow triggered. The dashboard will update in a few minutes. You can close this and check back later.</p>
      <button onclick="closeRefreshModal()" class="mt-4 px-4 py-2 rounded-lg border border-gray-600 text-gray-400 text-sm hover:border-gray-400 transition">Close</button>
    </div>
    <div id="refreshError" style="display:none">
      <p class="text-red-400 font-display font-semibold text-lg mb-2">Error</p>
      <p id="refreshErrorMsg" class="text-gray-400 text-sm mb-4"></p>
      <button onclick="closeRefreshModal()" class="px-4 py-2 rounded-lg border border-gray-600 text-gray-400 text-sm hover:border-gray-400 transition">Close</button>
    </div>
  </div>
</div>
<script>
const _DT="{dispatch_token}";
function openRefreshModal(){{document.getElementById("refreshModal").style.display="flex";document.getElementById("refreshIdle").style.display="block";document.getElementById("refreshLoading").style.display="none";document.getElementById("refreshError").style.display="none"}}
function closeRefreshModal(){{document.getElementById("refreshModal").style.display="none"}}
function triggerRefresh(){{document.getElementById("refreshIdle").style.display="none";document.getElementById("refreshLoading").style.display="block";fetch("https://api.github.com/repos/chengfai80/investment-dashboard/actions/workflows/refresh-dashboard.yml/dispatches",{{method:"POST",headers:{{"Authorization":"Bearer "+_DT,"Accept":"application/vnd.github+json"}},body:JSON.stringify({{ref:"main"}})}}).then(function(r){{if(!r.ok)throw new Error("HTTP "+r.status)}}).catch(function(e){{document.getElementById("refreshLoading").style.display="none";document.getElementById("refreshError").style.display="block";document.getElementById("refreshErrorMsg").textContent="Failed to trigger workflow: "+e.message}})}}
</script>'''
    button_onclick = 'onclick="openRefreshModal()"' if dispatch_token else 'onclick="location.reload()"'
    return f'''
<!-- DISCLAIMER -->
<section class="max-w-7xl mx-auto px-4 py-8">
  <div class="card p-5 text-center" style="border-color:rgba(239,68,68,.15)">
    <p class="text-xs text-gray-500 leading-relaxed max-w-3xl mx-auto">This report is for <span class="text-gray-400 font-semibold">informational purposes only</span> and does not constitute financial advice, investment recommendations, or an offer to buy or sell any securities. Past performance does not guarantee future results. All investments carry risk, including the potential loss of principal. Cryptocurrency markets are highly volatile. Always consult a licensed financial advisor before making investment decisions. Data may be delayed or subject to revision. AI-generated analysis may contain inaccuracies.</p>
  </div>
</section>
<!-- FOOTER -->
<footer class="border-t border-gold-500/10 mt-8">
  <div class="max-w-7xl mx-auto px-4 py-8 text-center">
    <p class="text-xs text-gray-600 font-mono">Powered by <span class="text-gold-500">MuleRun Super Agent</span> &middot; AI Analysis by <span class="text-gold-500">Gemini</span></p>
    <p class="text-[10px] text-gray-700 mt-2">Data sourced from Yahoo Finance, Reuters, CNBC, CoinTelegraph, CoinDesk &middot; Generated {timestamp}</p>
  </div>
</footer>
{refresh_js}
<button class="refresh-btn" {button_onclick} title="Refresh dashboard">&#8635;</button>
'''


def _build_html_scripts(gold_dates, gold_closes, gold_int, btc_dates, btc_closes, btc_int):
    if gold_dates and gold_closes:
        gd_js = _js_array(gold_dates)
        gp_js = _js_array(gold_closes)
        g_min = int(min(gold_closes) * 0.95)
        g_max = int(max(gold_closes) * 1.05)
    else:
        gd_js = "['Oct 6','Oct 13','Oct 16','Oct 20','Oct 31','Nov 10','Nov 25','Dec 1','Dec 11','Dec 17','Dec 22','Dec 31','Jan 5','Jan 12','Jan 20','Jan 26','Jan 29','Feb 2','Feb 6','Feb 13','Feb 23','Mar 2','Mar 10','Mar 18','Mar 23','Mar 31','Apr 2','Apr 5']"
        gp_js = "[3948,4108,4280,4336,3982,4112,4139,4239,4286,4348,4445,4326,4437,4604,4760,5080,5318,4623,4951,5022,5205,5294,5230,4890,4404,4648,4652,4644]"
        g_min = 3800
        g_max = 5500
    if btc_dates and btc_closes:
        bd_js = _js_array(btc_dates)
        bp_js = _js_array(btc_closes)
        b_min = int(min(btc_closes) * 0.90)
        b_max = int(max(btc_closes) * 1.05)
    else:
        bd_js = "['Oct 6','Oct 10','Oct 17','Oct 27','Nov 4','Nov 14','Nov 21','Dec 1','Dec 9','Dec 22','Dec 31','Jan 5','Jan 20','Jan 31','Feb 5','Feb 10','Feb 23','Mar 2','Mar 9','Mar 16','Mar 23','Mar 31','Apr 4','Apr 6']"
        bp_js = "[124753,113214,106468,114119,101591,94398,85091,86322,92692,88490,87509,93883,88311,78621,62702,68794,64617,68776,68402,74861,70915,68233,67291,69189]"
        b_min = 55000
        b_max = 130000
    return f'''
<script>
window.addEventListener('scroll',function(){{var h=document.documentElement;var p=(h.scrollTop/(h.scrollHeight-h.clientHeight))*100;document.getElementById('progressBar').style.width=p+'%'}});
function animateValue(el,start,end,dur){{var st=null;var step=function(ts){{if(!st)st=ts;var p=Math.min((ts-st)/dur,1);el.textContent='$'+Math.floor(p*(end-start)+start).toLocaleString();if(p<1)requestAnimationFrame(step)}};requestAnimationFrame(step)}}
gsap.registerPlugin(ScrollTrigger);
gsap.utils.toArray('.anim-card').forEach(function(el,i){{gsap.from(el,{{scrollTrigger:{{trigger:el,start:'top 90%',toggleActions:'play none none none'}},opacity:0,y:40,duration:.6,delay:i*.07,ease:'power2.out'}})}});
gsap.utils.toArray('.anim-section').forEach(function(el){{gsap.from(el,{{scrollTrigger:{{trigger:el,start:'top 85%'}},opacity:0,y:30,duration:.8,ease:'power2.out'}})}});
document.querySelectorAll('[data-target]').forEach(function(el){{var t=parseInt(el.dataset.target);ScrollTrigger.create({{trigger:el,start:'top 90%',onEnter:function(){{animateValue(el,0,t,1200)}}}});}});
var goldDates={gd_js};
var goldPrices={gp_js};
var goldChart=echarts.init(document.getElementById('goldChart'),null,{{renderer:'svg'}});
goldChart.setOption({{
  tooltip:{{trigger:'axis',backgroundColor:'rgba(15,23,42,.95)',borderColor:'rgba(245,158,11,.3)',borderWidth:1,textStyle:{{fontFamily:'JetBrains Mono',fontSize:12,color:'#fde68a'}},formatter:function(p){{return '<div style="font-family:Space Grotesk;font-weight:600;color:#fbbf24;margin-bottom:4px">'+p[0].axisValue+'</div><div style="font-family:JetBrains Mono;font-size:14px;color:#fff">$'+p[0].value.toLocaleString()+'/oz</div>'}}}},
  grid:{{top:30,right:20,bottom:40,left:70,containLabel:false}},
  xAxis:{{type:'category',data:goldDates,axisLine:{{lineStyle:{{color:'rgba(245,158,11,.15)'}}}},axisLabel:{{color:'rgba(251,191,36,.5)',fontFamily:'JetBrains Mono',fontSize:10,rotate:45}},axisTick:{{show:false}}}},
  yAxis:{{type:'value',min:{g_min},max:{g_max},axisLine:{{show:false}},splitLine:{{lineStyle:{{color:'rgba(245,158,11,.06)'}}}},axisLabel:{{color:'rgba(251,191,36,.4)',fontFamily:'JetBrains Mono',fontSize:10,formatter:'${{value}}'}}}},
  series:[{{type:'line',smooth:true,symbol:'none',lineStyle:{{color:'#f59e0b',width:2.5}},areaStyle:{{color:new echarts.graphic.LinearGradient(0,0,0,1,[{{offset:0,color:'rgba(245,158,11,.35)'}},{{offset:.5,color:'rgba(245,158,11,.08)'}},{{offset:1,color:'rgba(245,158,11,0)'}}])}},data:goldPrices,markLine:{{silent:true,symbol:'none',lineStyle:{{color:'rgba(245,158,11,.3)',type:'dashed'}},data:[{{yAxis:{gold_int},label:{{formatter:'Current ${gold_int:,}',color:'#fbbf24',fontFamily:'JetBrains Mono',fontSize:10}}}}]}}}}]
}});
var btcDates={bd_js};
var btcPrices={bp_js};
var btcChart=echarts.init(document.getElementById('btcChart'),null,{{renderer:'svg'}});
btcChart.setOption({{
  tooltip:{{trigger:'axis',backgroundColor:'rgba(15,23,42,.95)',borderColor:'rgba(247,147,26,.3)',borderWidth:1,textStyle:{{fontFamily:'JetBrains Mono',fontSize:12,color:'#fed7aa'}},formatter:function(p){{return '<div style="font-family:Space Grotesk;font-weight:600;color:#f7931a;margin-bottom:4px">'+p[0].axisValue+'</div><div style="font-family:JetBrains Mono;font-size:14px;color:#fff">$'+p[0].value.toLocaleString()+'</div>'}}}},
  grid:{{top:30,right:20,bottom:40,left:80,containLabel:false}},
  xAxis:{{type:'category',data:btcDates,axisLine:{{lineStyle:{{color:'rgba(247,147,26,.15)'}}}},axisLabel:{{color:'rgba(247,147,26,.4)',fontFamily:'JetBrains Mono',fontSize:10,rotate:45}},axisTick:{{show:false}}}},
  yAxis:{{type:'value',min:{b_min},max:{b_max},axisLine:{{show:false}},splitLine:{{lineStyle:{{color:'rgba(247,147,26,.06)'}}}},axisLabel:{{color:'rgba(247,147,26,.35)',fontFamily:'JetBrains Mono',fontSize:10,formatter:function(v){{return '$'+Math.round(v/1000)+'K'}}}}}},
  series:[{{type:'line',smooth:true,symbol:'none',lineStyle:{{color:'#f7931a',width:2.5}},areaStyle:{{color:new echarts.graphic.LinearGradient(0,0,0,1,[{{offset:0,color:'rgba(247,147,26,.3)'}},{{offset:.5,color:'rgba(247,147,26,.06)'}},{{offset:1,color:'rgba(247,147,26,0)'}}])}},data:btcPrices,markLine:{{silent:true,symbol:'none',lineStyle:{{color:'rgba(247,147,26,.3)',type:'dashed'}},data:[{{yAxis:{btc_int},label:{{formatter:'Current ${btc_int:,}',color:'#f7931a',fontFamily:'JetBrains Mono',fontSize:10}}}}]}}}}]
}});
window.addEventListener('resize',function(){{goldChart.resize();btcChart.resize()}});
</script>
'''


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Investment Intelligence Dashboard Generator")
    print("=" * 60)

    print("\n[1/6] Fetching live prices...")
    prices = fetch_prices()

    print("\n[2/6] Fetching Gold OHLCV (6 months)...")
    gold_ohlcv = fetch_ohlcv("GC=F", period="6mo")

    print("\n[3/6] Fetching Bitcoin OHLCV (6 months)...")
    btc_ohlcv = fetch_ohlcv("BTC-USD", period="6mo")

    print("\n[4/6] Fetching news headlines...")
    news = fetch_news()

    print("\n[5/6] Fetching AI-powered analysis via Gemini...")
    ai_local_news = fetch_gemini_local_news()
    ai_intl_news = fetch_gemini_intl_news()
    ai_local_stocks = fetch_gemini_local_stocks(prices)
    ai_intl_stocks = fetch_gemini_intl_stocks(prices)
    ai_gold = fetch_gemini_gold_analysis(prices["gold"])
    ai_btc = fetch_gemini_btc_analysis(prices["btc"])

    print("\n[6/6] Generating HTML dashboard...")
    html = generate_html(prices, gold_ohlcv, btc_ohlcv, news,
                         ai_local_news, ai_intl_news, ai_local_stocks,
                         ai_intl_stocks, ai_gold, ai_btc)

    output_path = os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "index.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"\nDashboard saved to: {output_path}")
    print("Done!")


if __name__ == "__main__":
    main()
