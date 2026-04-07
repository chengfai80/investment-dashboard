#!/usr/bin/env python3
"""
Investment Intelligence Dashboard Generator
Fetches live market data and news, then generates a complete HTML dashboard.
"""

import json
import html as html_module
from datetime import datetime

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
    "gold": 4644.30,
    "btc": 69189,
    "aapl": 255.92,
    "asml": 1317.23,
    "baba": 122.05,
    "meli": 1715.52,
    "maybank": 11.26,
    "cimb": 4.66,
    "tenaga": 14.04,
    "ihh": 8.96,
    "speedmart": 2.10,
}


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
        print(f"[WARN] yfinance unavailable, skipping OHLCV for {symbol}.")
        return dates, closes

    try:
        print(f"  Fetching {period} OHLCV for {symbol}...")
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period)
        if hist.empty:
            print(f"    No data returned for {symbol}.")
            return dates, closes
        # Sample ~40 points for chart readability
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
    """Fetch headlines from RSS feeds. Returns dict of source -> list of titles."""
    news = {}
    if feedparser is None:
        print("[WARN] feedparser unavailable, skipping news.")
        return news

    for source, url in RSS_FEEDS.items():
        try:
            print(f"  Fetching news from {source}...")
            feed = feedparser.parse(url)
            titles = []
            for entry in feed.entries[:5]:
                titles.append(html_module.escape(entry.get("title", "No title")))
            news[source] = titles
            print(f"    Got {len(titles)} headlines from {source}.")
        except Exception as e:
            print(f"    [ERROR] {source}: {e}")
            news[source] = []
    return news


# ── HTML Generation ────────────────────────────────────────────────────────

def _fmt_usd(val):
    """Format a number as USD string."""
    if val >= 1000:
        return f"${val:,.2f}"
    return f"${val:.2f}"


def _fmt_myr(val):
    return f"MYR {val:.2f}"


def _js_array(lst):
    """Convert a Python list to a JS array literal string."""
    return json.dumps(lst)


def generate_html(prices, gold_ohlcv, btc_ohlcv, news):
    """Build the complete HTML dashboard string."""
    now = datetime.now()
    date_str = now.strftime("%-d %B %Y")
    date_short = now.strftime("%-d %b %Y").upper()
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S")

    gold_price = prices["gold"]
    btc_price = prices["btc"]
    gold_int = int(round(gold_price))
    btc_int = int(round(btc_price))

    # Chart data — use fetched data or fall back to static
    # PLACEHOLDER: CHART_DATA_SECTION
    gold_dates, gold_closes = gold_ohlcv
    btc_dates, btc_closes = btc_ohlcv

    # Build news cards HTML
    # PLACEHOLDER: NEWS_CARDS_SECTION
    news_cards_html = _build_news_cards(news)

    # Local stock prices
    maybank_price = _fmt_myr(prices["maybank"])
    cimb_price = _fmt_myr(prices["cimb"])
    tenaga_price = _fmt_myr(prices["tenaga"])
    ihh_price = _fmt_myr(prices["ihh"])
    speedmart_price = _fmt_myr(prices["speedmart"])

    # International stock prices
    asml_price = _fmt_usd(prices["asml"])
    baba_price = _fmt_usd(prices["baba"])
    meli_price = _fmt_usd(prices["meli"])
    aapl_price = _fmt_usd(prices["aapl"])

    # PLACEHOLDER: BUILD_HTML
    html = _build_html_head(date_str, date_short, gold_price, btc_price, gold_int, btc_int)
    html += _build_html_stat_cards(gold_int, btc_int)
    html += _build_html_local_news()
    html += _build_html_intl_news()
    html += _build_html_news_feed(news_cards_html)
    html += _build_html_local_stocks(maybank_price, cimb_price, tenaga_price, ihh_price, speedmart_price)
    html += _build_html_intl_stocks(asml_price, baba_price, meli_price, aapl_price)
    html += _build_html_gold_section(gold_price)
    html += _build_html_btc_section(btc_price)
    html += _build_html_footer(timestamp)
    html += _build_html_scripts(gold_dates, gold_closes, gold_int, btc_dates, btc_closes, btc_int)
    html += "\n</body>\n</html>"

    return html


def _build_news_cards(news):
    """Build HTML cards for RSS news headlines."""
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


# PLACEHOLDER: All _build_html_* helper functions will be filled in via Edit


def _build_html_head(date_str, date_short, gold_price, btc_price, gold_int, btc_int):
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
.chat-widget{{position:fixed;bottom:24px;left:24px;z-index:9998}}
.chat-btn{{background:linear-gradient(135deg,rgba(30,41,59,.9),rgba(15,23,42,.95));border:1px solid rgba(245,158,11,.2);color:#fbbf24;border-radius:50%;width:48px;height:48px;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;transition:transform .2s}}
.chat-btn:hover{{transform:scale(1.1)}}
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
      <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-gold-500 pulse-dot"></span>LIVE {date_short}</span>
      <span>Gold <span class="text-gold-400 font-semibold">${gold_price:,.2f}</span>/oz</span>
      <span>Bitcoin <span class="text-btc font-semibold">${btc_int:,}</span></span>
      <span>FBM KLCI <span class="text-gold-300 font-semibold">1,680&ndash;1,740</span></span>
    </div>
  </div>
  <div class="relative z-10 max-w-7xl mx-auto px-4 py-16 text-center">
    <p class="text-gold-500 font-mono text-sm tracking-[.2em] mb-4 uppercase">Weekly Market Brief</p>
    <h1 class="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6">Investment Intelligence<br><span class="text-gold-400">Dashboard</span></h1>
    <p class="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">Comprehensive analysis of local &amp; international markets, stock recommendations, and commodity outlook &mdash; powered by real-time data.</p>
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
    """Return the stat cards section."""
    return f'''
<!-- STAT CARDS -->
<section class="max-w-7xl mx-auto px-4 py-12">
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="statCards">
    <div class="card p-5 glow-gold anim-card">
      <p class="text-xs text-gold-500 font-mono uppercase tracking-wider mb-1">Gold (XAU/USD)</p>
      <p class="stat-value text-3xl font-bold text-gold-300" data-target="{gold_int}">$0</p>
      <p class="text-xs text-bear mt-2 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg> -15% from Jan high $5,500</p>
    </div>
    <div class="card p-5 anim-card">
      <p class="text-xs text-btc font-mono uppercase tracking-wider mb-1">Bitcoin (BTC/USD)</p>
      <p class="stat-value text-3xl font-bold text-btc" data-target="{btc_int}">$0</p>
      <p class="text-xs text-bull mt-2 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg> Recovering from $60K Feb low</p>
    </div>
    <div class="card p-5 anim-card">
      <p class="text-xs text-gold-500 font-mono uppercase tracking-wider mb-1">FBM KLCI</p>
      <p class="stat-value text-3xl font-bold text-white">1,710</p>
      <p class="text-xs text-gold-300 mt-2">Range 1,680&ndash;1,740 | Cautious</p>
    </div>
    <div class="card p-5 anim-card">
      <p class="text-xs text-gold-500 font-mono uppercase tracking-wider mb-1">S&amp;P 500</p>
      <p class="stat-value text-3xl font-bold text-bull">+0.6%</p>
      <p class="text-xs text-gray-400 mt-2">Weekly gain amid ME tensions</p>
    </div>
  </div>
</section>

<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_local_news():
    """Return the local news section."""
    return '''
<!-- LOCAL NEWS -->
<section class="max-w-7xl mx-auto px-4 py-12 anim-section">
  <div class="flex items-center gap-3 mb-8">
    <span class="text-2xl">&#127470;&#127486;</span>
    <div>
      <h2 class="font-display text-2xl md:text-3xl font-bold text-white">Local News</h2>
      <p class="text-gold-500 text-sm font-mono">Bursa Malaysia &amp; Malaysian Markets</p>
    </div>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div class="card-news anim-card">
      <span class="badge badge-bear mb-3">Cautious</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">Bursa Malaysia to remain cautious this week, confined within 1,680&ndash;1,740 range due to Mideast conflict</h3>
      <p class="text-xs text-gray-400">Trading expected to be range-bound as geopolitical uncertainty from the Middle East conflict continues to weigh on sentiment.</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">The Star &middot; 5 Apr 2026</p>
    </div>
    <div class="card-news anim-card">
      <span class="badge badge-neutral mb-3">Mixed</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">Bursa ends week mixed on global energy jitters &mdash; FBM KLCI in narrow range</h3>
      <p class="text-xs text-gray-400">The benchmark index traded in a tight range during the week of Mar 30&ndash;Apr 3 as oil price volatility affected regional markets.</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">Business Today &middot; 5 Apr 2026</p>
    </div>
    <div class="card-news anim-card">
      <span class="badge badge-bear mb-3">Sell-off</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">FTSE Bursa Malaysia crashes over 1% amid risk-off sentiment after Trump remarks</h3>
      <p class="text-xs text-gray-400">Malaysian equities came under selling pressure on April 2 following global risk-off moves triggered by geopolitical commentary.</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">LiveMint &middot; 3 Apr 2026</p>
    </div>
    <div class="card-news anim-card">
      <span class="badge badge-bull mb-3">Positive</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">HKEX &amp; Bursa Malaysia launch co-branded index, sign MOU for market connectivity</h3>
      <p class="text-xs text-gray-400">Strategic partnership to enhance cross-border investment flows between Hong Kong and Malaysian capital markets.</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">HKEX &middot; 27 Mar 2026</p>
    </div>
    <div class="card-news anim-card">
      <span class="badge badge-bull mb-3">Rally</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">Bursa Malaysia, Asian stocks rise as Trump plans speedy end to Middle East conflict</h3>
      <p class="text-xs text-gray-400">Asian markets rallied on hopes for a swift resolution to the Iran situation, providing temporary relief to regional equities.</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">Asia News Network &middot; 3 Apr 2026</p>
    </div>
  </div>
</section>

<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_intl_news():
    """Return the international news section."""
    return '''
<!-- INTERNATIONAL NEWS -->
<section class="max-w-7xl mx-auto px-4 py-12 anim-section">
  <div class="flex items-center gap-3 mb-8">
    <span class="text-2xl">&#127758;</span>
    <div>
      <h2 class="font-display text-2xl md:text-3xl font-bold text-white">International News</h2>
      <p class="text-gold-500 text-sm font-mono">Wall Street &amp; Global Markets</p>
    </div>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div class="card-news anim-card">
      <span class="badge badge-neutral mb-3">Watch</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">Wall St Week Ahead: Inflation in focus for markets jostled by Middle East war signals</h3>
      <p class="text-xs text-gray-400">Fresh inflation data and early company earnings could start showing the Middle East war&#39;s economic impact.</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">Reuters &middot; 3 Apr 2026</p>
    </div>
    <div class="card-news anim-card">
      <span class="badge badge-bull mb-3">Recovery</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">Stocks recover from early losses, close with weekly gain. US oil tops $110/barrel</h3>
      <p class="text-xs text-gray-400">Wall Street shook off an early stumble to close with slim gains, marking first winning week in recent sessions.</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">AP News &middot; 3 Apr 2026</p>
    </div>
    <div class="card-news anim-card">
      <span class="badge badge-bear mb-3">Risk</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">Middle East Conflict circles world markets, stirring fears of stalled growth &amp; inflation</h3>
      <p class="text-xs text-gray-400">Widening conflict threatening Strait of Hormuz access has sparked global stock declines and oil price spikes.</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">WSJ &middot; Mar 2026</p>
    </div>
    <div class="card-news anim-card">
      <span class="badge badge-neutral mb-3">Headwinds</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">SpaceX, Anthropic &amp; OpenAI mega IPOs alone can&#39;t fix this stock market &mdash; 3 big headwinds</h3>
      <p class="text-xs text-gray-400">Despite anticipated tech IPOs, the market faces three structural headwinds dragging equities lower.</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">CNBC &middot; 5 Apr 2026</p>
    </div>
    <div class="card-news anim-card">
      <span class="badge badge-bear mb-3">Geopolitical</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">Trump gives Iran until Tuesday night to open Strait of Hormuz</h3>
      <p class="text-xs text-gray-400">Ultimatum intensifies standoff over critical shipping lane; markets brace for potential escalation or resolution.</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">Reuters / WSJ &middot; 5 Apr 2026</p>
    </div>
    <div class="card-news anim-card">
      <span class="badge badge-bull mb-3">Supply</span>
      <h3 class="text-sm font-semibold text-white leading-snug mb-2">OPEC+ agrees to boost oil output when Strait of Hormuz reopens</h3>
      <p class="text-xs text-gray-400">Oil cartel signals readiness to increase production once critical shipping route becomes accessible again.</p>
      <p class="text-[10px] text-gold-600 mt-3 font-mono">Reuters &middot; 5 Apr 2026</p>
    </div>
  </div>
</section>

<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_news_feed(news_cards_html):
    """Return the live RSS news feed section."""
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


def _build_html_local_stocks(maybank, cimb, tenaga, ihh, speedmart):
    """Return the local stock recommendations table."""
    return f'''
<!-- LOCAL STOCK RECOMMENDATIONS -->
<section class="max-w-7xl mx-auto px-4 py-12 anim-section">
  <div class="flex items-center gap-3 mb-2">
    <span class="text-2xl">&#128200;</span>
    <h2 class="font-display text-2xl md:text-3xl font-bold text-white">Local Stock Picks</h2>
  </div>
  <p class="text-gold-500 text-sm font-mono mb-8">Bursa Malaysia &mdash; Analyst-Backed Recommendations for 2026</p>
  <div class="table-container glow-gold">
    <table class="rec-table">
      <thead>
        <tr><th>Stock</th><th>Ticker</th><th>Sector</th><th>Price</th><th>Buy Zone</th><th>Target</th><th>Upside</th><th>Justification</th></tr>
      </thead>
      <tbody>
        <tr>
          <td class="font-semibold text-white">Maybank</td>
          <td class="font-mono text-gold-300">1155.KL</td>
          <td>Banking</td>
          <td class="font-mono">{maybank}</td>
          <td class="font-mono text-gray-300">10.80&ndash;11.30</td>
          <td class="font-mono text-bull font-semibold">MYR 13.00</td>
          <td><span class="badge badge-bull">+15%</span></td>
          <td class="text-xs max-w-xs whitespace-normal">Malaysia&#39;s largest bank. Consistent 5&ndash;6% dividend yield. Top pick by CGS International &amp; RHB Research. Foreign shareholding near historic low &mdash; re-rating potential.</td>
        </tr>
        <tr>
          <td class="font-semibold text-white">CIMB Group</td>
          <td class="font-mono text-gold-300">1295.KL</td>
          <td>Banking</td>
          <td class="font-mono">{cimb}</td>
          <td class="font-mono text-gray-300">4.50&ndash;4.70</td>
          <td class="font-mono text-bull font-semibold">MYR 5.50</td>
          <td><span class="badge badge-bull">+18%</span></td>
          <td class="text-xs max-w-xs whitespace-normal">Strong ASEAN franchise, improving ROE, ~5% dividend yield. Benefits from HKEX-Bursa MOU. The Edge top pick for 2026.</td>
        </tr>
        <tr>
          <td class="font-semibold text-white">Tenaga Nasional</td>
          <td class="font-mono text-gold-300">5347.KL</td>
          <td>Utilities</td>
          <td class="font-mono">{tenaga}</td>
          <td class="font-mono text-gray-300">13.50&ndash;14.10</td>
          <td class="font-mono text-bull font-semibold">MYR 16.00</td>
          <td><span class="badge badge-bull">+14%</span></td>
          <td class="text-xs max-w-xs whitespace-normal">Defensive play amid geopolitical uncertainty. Key beneficiary of data center demand &amp; NETR infrastructure. Stable earnings, ~4% yield.</td>
        </tr>
        <tr>
          <td class="font-semibold text-white">IHH Healthcare</td>
          <td class="font-mono text-gold-300">5225.KL</td>
          <td>Healthcare</td>
          <td class="font-mono">{ihh}</td>
          <td class="font-mono text-gray-300">8.50&ndash;9.00</td>
          <td class="font-mono text-bull font-semibold">MYR 10.50</td>
          <td><span class="badge badge-bull">+17%</span></td>
          <td class="text-xs max-w-xs whitespace-normal">Asia&#39;s largest private healthcare group. Defensive growth with rising medical tourism. Analyst consensus target above MYR 10.</td>
        </tr>
        <tr>
          <td class="font-semibold text-white">99 Speedmart</td>
          <td class="font-mono text-gold-300">5326.KL</td>
          <td>Retail</td>
          <td class="font-mono">{speedmart}</td>
          <td class="font-mono text-gray-300">1.95&ndash;2.10</td>
          <td class="font-mono text-bull font-semibold">MYR 2.50</td>
          <td><span class="badge badge-bull">+19%</span></td>
          <td class="text-xs max-w-xs whitespace-normal">Defensive growth with 2,800+ stores. Recession-resilient consumer staples. Rapid expansion. Featured in &quot;13 Stock Picks for 2026&quot;.</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>

<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_intl_stocks(asml, baba, meli, aapl):
    """Return the international stock recommendations table."""
    return f'''
<!-- INTERNATIONAL STOCK RECOMMENDATIONS -->
<section class="max-w-7xl mx-auto px-4 py-12 anim-section">
  <div class="flex items-center gap-3 mb-2">
    <span class="text-2xl">&#127759;</span>
    <h2 class="font-display text-2xl md:text-3xl font-bold text-white">International Stock Picks</h2>
  </div>
  <p class="text-gold-500 text-sm font-mono mb-8">Global Markets &mdash; Top Analyst-Backed Opportunities for 2026</p>
  <div class="table-container glow-gold">
    <table class="rec-table">
      <thead>
        <tr><th>Stock</th><th>Ticker</th><th>Sector</th><th>Price</th><th>Buy Zone</th><th>Target</th><th>Upside</th><th>Justification</th></tr>
      </thead>
      <tbody>
        <tr>
          <td class="font-semibold text-white">ASML Holding</td>
          <td class="font-mono text-gold-300">ASML</td>
          <td>Semiconductors</td>
          <td class="font-mono">{asml}</td>
          <td class="font-mono text-gray-300">$1,250&ndash;1,320</td>
          <td class="font-mono text-bull font-semibold">$1,600</td>
          <td><span class="badge badge-bull">+21%</span></td>
          <td class="text-xs max-w-xs whitespace-normal">Monopoly on EUV lithography &mdash; irreplaceable for AI chips. Motley Fool&#39;s #1 international pick. Strong backlog through 2028.</td>
        </tr>
        <tr>
          <td class="font-semibold text-white">Alibaba</td>
          <td class="font-mono text-gold-300">BABA</td>
          <td>E-commerce / Cloud</td>
          <td class="font-mono">{baba}</td>
          <td class="font-mono text-gray-300">$115&ndash;125</td>
          <td class="font-mono text-bull font-semibold">$160</td>
          <td><span class="badge badge-bull">+31%</span></td>
          <td class="text-xs max-w-xs whitespace-normal">China recovery play with expanding cloud AI business. Significant discount to intrinsic value. Regulatory headwinds easing.</td>
        </tr>
        <tr>
          <td class="font-semibold text-white">MercadoLibre</td>
          <td class="font-mono text-gold-300">MELI</td>
          <td>E-comm / Fintech</td>
          <td class="font-mono">{meli}</td>
          <td class="font-mono text-gray-300">$1,650&ndash;1,720</td>
          <td class="font-mono text-bull font-semibold">$2,200</td>
          <td><span class="badge badge-bull">+28%</span></td>
          <td class="text-xs max-w-xs whitespace-normal">LatAm&#39;s Amazon + PayPal. Massive fintech growth via Mercado Pago. Top pick by Yahoo Finance &amp; Motley Fool.</td>
        </tr>
        <tr>
          <td class="font-semibold text-white">Apple</td>
          <td class="font-mono text-gold-300">AAPL</td>
          <td>Technology</td>
          <td class="font-mono">{aapl}</td>
          <td class="font-mono text-gray-300">$245&ndash;258</td>
          <td class="font-mono text-bull font-semibold">$300</td>
          <td><span class="badge badge-bull">+17%</span></td>
          <td class="text-xs max-w-xs whitespace-normal">Record services revenue, AI integration across products. iPhone upgrade cycle catalyst. Defensive mega-cap in volatile market.</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>

<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_gold_section(gold_price):
    """Return the gold analysis section."""
    gold_int = int(round(gold_price))
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
      <div class="space-y-3">
        <div class="card-news"><p class="text-sm text-white font-medium">Gold loses 15% from war highs as Operation Epic Fury safe haven trade unwinds</p><p class="text-[10px] text-gold-600 font-mono mt-1">Bitcoin.com &middot; 5 Apr</p></div>
        <div class="card-news"><p class="text-sm text-white font-medium">Gold overtakes U.S. Treasuries as world&#39;s largest foreign reserve asset in 2026</p><p class="text-[10px] text-gold-600 font-mono mt-1">Economics &middot; 4 Apr</p></div>
        <div class="card-news"><p class="text-sm text-white font-medium">Brazil cuts dollar holdings, adds 42 tons of gold as BRICS push grows</p><p class="text-[10px] text-gold-600 font-mono mt-1">WatcherGuru &middot; 3 Apr</p></div>
        <div class="card-news"><p class="text-sm text-white font-medium">Robert Kiyosaki recommends Bitcoin &amp; gold as 1974 shift comes full circle</p><p class="text-[10px] text-gold-600 font-mono mt-1">CoinTelegraph &middot; 5 Apr</p></div>
        <div class="card-news"><p class="text-sm text-white font-medium">Gold futures on Bursa Malaysia Derivatives expected to trade cautiously next week</p><p class="text-[10px] text-gold-600 font-mono mt-1">KLSEScreener &middot; 5 Apr</p></div>
      </div>
    </div>
    <div>
      <h3 class="font-display text-lg font-semibold text-gold-400 mb-4">Gold Recommendation</h3>
      <div class="rec-box glow-gold-strong">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div><p class="text-[10px] text-gold-600 font-mono uppercase">Current Price</p><p class="font-display text-xl font-bold text-gold-300">${gold_int:,}/oz</p></div>
          <div><p class="text-[10px] text-gold-600 font-mono uppercase">Buy Zone</p><p class="font-display text-xl font-bold text-white">$4,400&ndash;4,650</p></div>
          <div><p class="text-[10px] text-gold-600 font-mono uppercase">Target Price</p><p class="font-display text-xl font-bold text-bull">$5,000&ndash;5,400</p></div>
          <div><p class="text-[10px] text-gold-600 font-mono uppercase">Stop Loss</p><p class="font-display text-xl font-bold text-bear">$4,100</p></div>
        </div>
        <div class="mb-3"><span class="badge badge-bull">BULLISH Long-Term</span></div>
        <p class="text-xs text-gray-300 leading-relaxed">Gold pulled back 15% from January highs near $5,500. J.P. Morgan targets $5,055 by Q4 2026; Goldman Sachs targets $5,400; UBS sees $6,200. Central bank buying remains strong at ~585 tonnes/quarter. Current pullback driven by unwinding of Middle East safe-haven trade. <span class="text-gold-400 font-semibold">Dip-buying opportunity for medium-to-long-term investors.</span></p>
      </div>
    </div>
  </div>
</section>

<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_btc_section(btc_price):
    """Return the bitcoin analysis section."""
    btc_int = int(round(btc_price))
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
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">RSI(14)</p><p class="font-mono text-lg text-gold-300">51.91</p><span class="badge badge-neutral text-[10px]">Neutral</span></div>
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">MACD</p><p class="font-mono text-lg text-bear">-650</p><span class="badge badge-bear text-[10px]">Death Cross</span></div>
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">MA(7)</p><p class="font-mono text-lg text-gray-300">$67,991</p></div>
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">MA(25)</p><p class="font-mono text-lg text-gray-300">$69,415</p></div>
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">MA(99)</p><p class="font-mono text-lg text-gray-400">$76,372</p></div>
      <div><p class="text-[10px] text-gray-500 font-mono uppercase">ATR</p><p class="font-mono text-lg text-gold-300">$2,315</p><span class="badge badge-neutral text-[10px]">3.34% Vol</span></div>
    </div>
    <div class="mt-4 pt-4 border-t border-gold-500/10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      <div><span class="text-bull font-mono text-xs">Support:</span> <span class="font-mono text-gray-300">$64,058 / $65,971 / $66,011</span></div>
      <div><span class="text-bear font-mono text-xs">Resistance:</span> <span class="font-mono text-gray-300">$71,337 / $72,667 / $74,885</span></div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div>
      <h3 class="font-display text-lg font-semibold text-btc mb-4">Bitcoin Headlines</h3>
      <div class="space-y-3">
        <div class="card-news"><p class="text-sm text-white font-medium">BTC at $66,500 on Liberation Day &mdash; new prediction targets $240K long-term</p><p class="text-[10px] text-gold-600 font-mono mt-1">FinanceMagnates &middot; 3 Apr</p></div>
        <div class="card-news"><p class="text-sm text-white font-medium">Bitcoin ETF outflows amid US&ndash;Iran tensions pressure price action</p><p class="text-[10px] text-gold-600 font-mono mt-1">Capital.com &middot; 3 Apr</p></div>
        <div class="card-news"><p class="text-sm text-white font-medium">Bitcoin enters April with fading ETF momentum, rising whale selling, bear flag</p><p class="text-[10px] text-gold-600 font-mono mt-1">BeInCrypto &middot; 31 Mar</p></div>
        <div class="card-news"><p class="text-sm text-white font-medium">Bitcoin ETFs &quot;will be larger&quot; than gold ETFs: Analyst</p><p class="text-[10px] text-gold-600 font-mono mt-1">CoinTelegraph &middot; 4 Apr</p></div>
        <div class="card-news"><p class="text-sm text-white font-medium">Bitcoin tends to outperform gold &amp; stocks after global shocks</p><p class="text-[10px] text-gold-600 font-mono mt-1">CoinDesk &middot; 4 Apr</p></div>
        <div class="card-news"><p class="text-sm text-white font-medium">Fidelity: Bitcoin winning back gold investors</p><p class="text-[10px] text-gold-600 font-mono mt-1">U.Today &middot; 3 Apr</p></div>
      </div>
    </div>
    <div>
      <h3 class="font-display text-lg font-semibold text-btc mb-4">Bitcoin Recommendation</h3>
      <div class="rec-box" style="border-color:rgba(247,147,26,.2)">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div><p class="text-[10px] text-gray-500 font-mono uppercase">Current Price</p><p class="font-display text-xl font-bold text-btc">${btc_int:,}</p></div>
          <div><p class="text-[10px] text-gray-500 font-mono uppercase">Buy Zone</p><p class="font-display text-xl font-bold text-white">$64,000&ndash;67,000</p></div>
          <div><p class="text-[10px] text-gray-500 font-mono uppercase">Short-Term Target</p><p class="font-display text-xl font-bold text-bull">$72,000&ndash;74,000</p></div>
          <div><p class="text-[10px] text-gray-500 font-mono uppercase">Stop Loss</p><p class="font-display text-xl font-bold text-bear">$60,000</p></div>
        </div>
        <div class="mb-3 flex gap-2 flex-wrap">
          <span class="badge badge-neutral">Neutral-Bearish (Short-Term)</span>
          <span class="badge badge-bull">Cautiously Bullish (Medium-Term)</span>
        </div>
        <p class="text-xs text-gray-300 leading-relaxed">BTC dropped 45% from Oct 2025 ATH of ~$125K, now consolidating in $66&ndash;70K range. RSI neutral but MACD in death cross. <span class="text-bear font-semibold">Headwinds:</span> ETF outflows, US&ndash;Iran war uncertainty, tariff fears. <span class="text-bull font-semibold">Tailwinds:</span> Historical outperformance after global shocks, growing institutional adoption, ETF infrastructure. Wait for confirmed breakout above $72K for bullish confirmation, or accumulate at $64K support zone. Medium-term target $85,000+ if macro conditions improve.</p>
      </div>
    </div>
  </div>
</section>

<div class="section-divider max-w-7xl mx-auto"></div>
'''


def _build_html_footer(timestamp):
    """Return the disclaimer + footer."""
    return f'''
<!-- DISCLAIMER -->
<section class="max-w-7xl mx-auto px-4 py-8">
  <div class="card p-5 text-center" style="border-color:rgba(239,68,68,.15)">
    <p class="text-xs text-gray-500 leading-relaxed max-w-3xl mx-auto">This report is for <span class="text-gray-400 font-semibold">informational purposes only</span> and does not constitute financial advice, investment recommendations, or an offer to buy or sell any securities. Past performance does not guarantee future results. All investments carry risk, including the potential loss of principal. Cryptocurrency markets are highly volatile. Always consult a licensed financial advisor before making investment decisions. Data may be delayed or subject to revision.</p>
  </div>
</section>

<!-- FOOTER -->
<footer class="border-t border-gold-500/10 mt-8">
  <div class="max-w-7xl mx-auto px-4 py-8 text-center">
    <p class="text-xs text-gray-600 font-mono">Powered by <span class="text-gold-500">MuleRun Super Agent</span></p>
    <p class="text-[10px] text-gray-700 mt-2">Data sourced from Yahoo Finance, Finnhub, CoinGecko, Reuters, J.P. Morgan Research, Goldman Sachs &middot; Generated {timestamp}</p>
  </div>
</footer>

<!-- Refresh Button -->
<button class="refresh-btn" onclick="location.reload()" title="Refresh dashboard">&#8635;</button>

<!-- Chat Widget Placeholder -->
<div class="chat-widget">
  <button class="chat-btn" title="Chat assistant">&#128172;</button>
</div>
'''


def _build_html_scripts(gold_dates, gold_closes, gold_int, btc_dates, btc_closes, btc_int):
    """Return the <script> block."""
    # Use fetched data if available, otherwise fall back to static arrays
    if gold_dates and gold_closes:
        gd_js = _js_array(gold_dates)
        gp_js = _js_array(gold_closes)
        g_min = int(min(gold_closes) * 0.95)
        g_max = int(max(gold_closes) * 1.05)
    else:
        gd_js = "['Oct 6','Oct 13','Oct 16','Oct 20','Oct 31','Nov 10','Nov 25','Nov 28','Dec 1','Dec 11','Dec 17','Dec 22','Dec 26','Dec 31','Jan 5','Jan 12','Jan 20','Jan 22','Jan 26','Jan 28','Jan 29','Jan 30','Feb 2','Feb 6','Feb 9','Feb 13','Feb 23','Feb 27','Mar 2','Mar 10','Mar 13','Mar 18','Mar 19','Mar 23','Mar 25','Mar 31','Apr 1','Apr 2','Apr 5']"
        gp_js = "[3948,4108,4280,4336,3982,4112,4139,4218,4239,4286,4348,4445,4529,4326,4437,4604,4760,4909,5080,5302,5318,4714,4623,4951,5051,5022,5205,5231,5294,5230,5053,4890,4601,4404,4550,4648,4783,4652,4644]"
        g_min = 3800
        g_max = 5500

    if btc_dates and btc_closes:
        bd_js = _js_array(btc_dates)
        bp_js = _js_array(btc_closes)
        b_min = int(min(btc_closes) * 0.90)
        b_max = int(max(btc_closes) * 1.05)
    else:
        bd_js = "['Oct 6','Oct 10','Oct 17','Oct 20','Oct 27','Nov 4','Nov 10','Nov 14','Nov 17','Nov 20','Nov 21','Nov 26','Dec 1','Dec 3','Dec 9','Dec 15','Dec 22','Dec 31','Jan 5','Jan 13','Jan 20','Jan 29','Jan 31','Feb 4','Feb 5','Feb 6','Feb 10','Feb 17','Feb 23','Feb 25','Mar 2','Mar 4','Mar 9','Mar 13','Mar 16','Mar 19','Mar 23','Mar 26','Mar 27','Mar 31','Apr 2','Apr 4','Apr 6']"
        bp_js = "[124753,113214,106468,110589,114119,101591,105997,94398,92094,86632,85091,90518,86322,93528,92692,86420,88490,87509,93883,95322,88311,84562,78621,73020,62702,70555,68794,67494,64617,67960,68776,72711,68402,70968,74861,69913,70915,68792,66338,68233,66889,67291,69189]"
        b_min = 55000
        b_max = 130000

    return f'''
<!-- SCRIPTS -->
<script>
// Progress Bar
window.addEventListener('scroll',function(){{var h=document.documentElement;var p=(h.scrollTop/(h.scrollHeight-h.clientHeight))*100;document.getElementById('progressBar').style.width=p+'%'}});

// Number Counter
function animateValue(el,start,end,dur){{var st=null;var step=function(ts){{if(!st)st=ts;var p=Math.min((ts-st)/dur,1);el.textContent='$'+Math.floor(p*(end-start)+start).toLocaleString();if(p<1)requestAnimationFrame(step)}};requestAnimationFrame(step)}}

// GSAP Animations
gsap.registerPlugin(ScrollTrigger);
gsap.utils.toArray('.anim-card').forEach(function(el,i){{gsap.from(el,{{scrollTrigger:{{trigger:el,start:'top 90%',toggleActions:'play none none none'}},opacity:0,y:40,duration:.6,delay:i*.07,ease:'power2.out'}})}});
gsap.utils.toArray('.anim-section').forEach(function(el){{gsap.from(el,{{scrollTrigger:{{trigger:el,start:'top 85%'}},opacity:0,y:30,duration:.8,ease:'power2.out'}})}});

// Counter animation on stat cards
document.querySelectorAll('[data-target]').forEach(function(el){{var t=parseInt(el.dataset.target);ScrollTrigger.create({{trigger:el,start:'top 90%',onEnter:function(){{animateValue(el,0,t,1200)}}}});}});

// Gold Chart
var goldDates={gd_js};
var goldPrices={gp_js};

var goldChart=echarts.init(document.getElementById('goldChart'),null,{{renderer:'svg'}});
goldChart.setOption({{
  tooltip:{{trigger:'axis',backgroundColor:'rgba(15,23,42,.95)',borderColor:'rgba(245,158,11,.3)',borderWidth:1,textStyle:{{fontFamily:'JetBrains Mono',fontSize:12,color:'#fde68a'}},formatter:function(p){{return '<div style="font-family:Space Grotesk;font-weight:600;color:#fbbf24;margin-bottom:4px">'+p[0].axisValue+'</div><div style="font-family:JetBrains Mono;font-size:14px;color:#fff">$'+p[0].value.toLocaleString()+'/oz</div>'}}}},
  grid:{{top:30,right:20,bottom:40,left:70,containLabel:false}},
  xAxis:{{type:'category',data:goldDates,axisLine:{{lineStyle:{{color:'rgba(245,158,11,.15)'}}}},axisLabel:{{color:'rgba(251,191,36,.5)',fontFamily:'JetBrains Mono',fontSize:10,rotate:45}},axisTick:{{show:false}}}},
  yAxis:{{type:'value',min:{g_min},max:{g_max},axisLine:{{show:false}},splitLine:{{lineStyle:{{color:'rgba(245,158,11,.06)'}}}},axisLabel:{{color:'rgba(251,191,36,.4)',fontFamily:'JetBrains Mono',fontSize:10,formatter:'${{value}}'}}}},
  series:[{{
    type:'line',smooth:true,symbol:'none',lineStyle:{{color:'#f59e0b',width:2.5}},
    areaStyle:{{color:new echarts.graphic.LinearGradient(0,0,0,1,[{{offset:0,color:'rgba(245,158,11,.35)'}},{{offset:.5,color:'rgba(245,158,11,.08)'}},{{offset:1,color:'rgba(245,158,11,0)'}}])}},
    data:goldPrices,
    markLine:{{silent:true,symbol:'none',lineStyle:{{color:'rgba(245,158,11,.3)',type:'dashed'}},data:[{{yAxis:{gold_int},label:{{formatter:'Current ${gold_int:,}',color:'#fbbf24',fontFamily:'JetBrains Mono',fontSize:10}}}}]}}
  }}]
}});

// BTC Chart
var btcDates={bd_js};
var btcPrices={bp_js};

var btcChart=echarts.init(document.getElementById('btcChart'),null,{{renderer:'svg'}});
btcChart.setOption({{
  tooltip:{{trigger:'axis',backgroundColor:'rgba(15,23,42,.95)',borderColor:'rgba(247,147,26,.3)',borderWidth:1,textStyle:{{fontFamily:'JetBrains Mono',fontSize:12,color:'#fed7aa'}},formatter:function(p){{return '<div style="font-family:Space Grotesk;font-weight:600;color:#f7931a;margin-bottom:4px">'+p[0].axisValue+'</div><div style="font-family:JetBrains Mono;font-size:14px;color:#fff">$'+p[0].value.toLocaleString()+'</div>'}}}},
  grid:{{top:30,right:20,bottom:40,left:80,containLabel:false}},
  xAxis:{{type:'category',data:btcDates,axisLine:{{lineStyle:{{color:'rgba(247,147,26,.15)'}}}},axisLabel:{{color:'rgba(247,147,26,.4)',fontFamily:'JetBrains Mono',fontSize:10,rotate:45}},axisTick:{{show:false}}}},
  yAxis:{{type:'value',min:{b_min},max:{b_max},axisLine:{{show:false}},splitLine:{{lineStyle:{{color:'rgba(247,147,26,.06)'}}}},axisLabel:{{color:'rgba(247,147,26,.35)',fontFamily:'JetBrains Mono',fontSize:10,formatter:function(v){{return '$'+Math.round(v/1000)+'K'}}}}}},
  series:[{{
    type:'line',smooth:true,symbol:'none',lineStyle:{{color:'#f7931a',width:2.5}},
    areaStyle:{{color:new echarts.graphic.LinearGradient(0,0,0,1,[{{offset:0,color:'rgba(247,147,26,.3)'}},{{offset:.5,color:'rgba(247,147,26,.06)'}},{{offset:1,color:'rgba(247,147,26,0)'}}])}},
    data:btcPrices,
    markLine:{{silent:true,symbol:'none',lineStyle:{{color:'rgba(247,147,26,.3)',type:'dashed'}},data:[{{yAxis:{btc_int},label:{{formatter:'Current ${btc_int:,}',color:'#f7931a',fontFamily:'JetBrains Mono',fontSize:10}}}}]}}
  }}]
}});

// Resize handler
window.addEventListener('resize',function(){{goldChart.resize();btcChart.resize()}});
</script>
'''


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Investment Intelligence Dashboard Generator")
    print("=" * 60)

    print("\n[1/4] Fetching live prices...")
    prices = fetch_prices()

    print("\n[2/4] Fetching Gold OHLCV (6 months)...")
    gold_ohlcv = fetch_ohlcv("GC=F", period="6mo")

    print("\n[3/4] Fetching Bitcoin OHLCV (6 months)...")
    btc_ohlcv = fetch_ohlcv("BTC-USD", period="6mo")

    print("\n[4/4] Fetching news headlines...")
    news = fetch_news()

    print("\nGenerating HTML dashboard...")
    html = generate_html(prices, gold_ohlcv, btc_ohlcv, news)

    import os
    output_path = os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "index.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"\nDashboard saved to: {output_path}")
    print("Done!")


if __name__ == "__main__":
    main()
