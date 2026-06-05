from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import html
import json
import mimetypes
import os
import secrets
import threading
import time
import urllib.parse
from collections import defaultdict, deque
from dataclasses import dataclass
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import jwt
import pandas as pd
import requests
from jinja2 import DictLoader, Environment, select_autoescape

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent
SECRET = os.environ.get("FT_V2_SECRET", "ft-v2-local-secret")
HOST = os.environ.get("FT_V2_HOST", "127.0.0.1")
PORT = int(os.environ.get("FT_V2_PORT", "8765"))
DEFAULT_TZ = dt.timezone(dt.timedelta(hours=8))

USER_CONFIGS = {
    "chengfai@hotmail.com": {
        "firebase_api_key": "AIzaSyCrIBLkwz114iEHDS6J0kWk0QNiXBk9Ls8",
        "firebase_project_id": "financialtrackerapp-453413",
        "service_account": WORKSPACE / "financial-tracker-app" / "fai_key.json",
        "display_name": "ChengFai",
    },
    "engseeaw@gmail.com": {
        "firebase_api_key": "AIzaSyA412O6Y4lycWMxG2Sw7L6SS6-AZB6AvU8",
        "firebase_project_id": "see-financialtrackerapp",
        "service_account": WORKSPACE / "financial-tracker-app" / "see_key.json",
        "display_name": "EngSee",
    },
}

SESSION_STORE: Dict[str, Dict[str, Any]] = {}
SESSION_LOCK = threading.Lock()

CACHE: Dict[str, Any] = {
    "data": {},
    "schema": {},
    "fetched_at": 0.0,
}

CHART_HINTS = {
    "expensesummary": "expense",
    "commitment": "commitment",
    "accounts": "accounts",
    "investment": "investment",
    "share": "investment",
    "fd": "investment",
    "insuranceinvestment": "investment",
    "epf": "investment",
    "sspn": "investment",
}

TEMPLATES = {
    "base.html": r"""
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ title or 'Financial Tracker Pro' }}</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg: #081120;
      --panel: rgba(15, 23, 42, 0.86);
      --panel2: rgba(30, 41, 59, 0.82);
      --line: rgba(148, 163, 184, 0.18);
      --text: #e5eefb;
      --muted: #94a3b8;
      --accent: #6ea8fe;
      --accent2: #5eead4;
      --danger: #fb7185;
      --good: #34d399;
    }
    html, body { height:100%; }
    body {
      background:
        radial-gradient(circle at top left, rgba(110,168,254,.18), transparent 26%),
        radial-gradient(circle at 80% 0%, rgba(94,234,212,.16), transparent 24%),
        linear-gradient(180deg, #050816 0%, #0b1220 35%, #0d1528 100%);
      color: var(--text);
      font-feature-settings: "ss01" 1, "cv01" 1;
    }
    .app-shell { min-height: 100vh; }
    .sidebar {
      background: linear-gradient(180deg, rgba(15,23,42,.92), rgba(15,23,42,.72));
      border-right: 1px solid var(--line);
      backdrop-filter: blur(20px);
    }
    .brand {
      font-weight: 700;
      letter-spacing: .2px;
    }
    .nav-pills .nav-link {
      color: #cbd5e1;
      border: 1px solid transparent;
      margin-bottom: .35rem;
      text-align: left;
      border-radius: 14px;
      padding: .7rem .9rem;
    }
    .nav-pills .nav-link.active {
      background: linear-gradient(135deg, rgba(110,168,254,.22), rgba(94,234,212,.16));
      border-color: rgba(110,168,254,.38);
      color: white;
      box-shadow: 0 10px 30px rgba(0,0,0,.2);
    }
    .glass {
      background: linear-gradient(180deg, rgba(15,23,42,.84), rgba(15,23,42,.70));
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: 0 12px 36px rgba(0,0,0,.24);
      backdrop-filter: blur(20px);
    }
    .metric-card {
      border-radius: 22px;
      padding: 18px 20px;
      background: linear-gradient(180deg, rgba(30,41,59,.92), rgba(15,23,42,.82));
      border: 1px solid var(--line);
      height: 100%;
    }
    .metric-label { color: var(--muted); font-size: .84rem; text-transform: uppercase; letter-spacing: .08em; }
    .metric-value { font-size: 1.65rem; font-weight: 700; margin-top: .25rem; }
    .metric-note { color: var(--muted); font-size: .84rem; }
    .table { color: var(--text); }
    .table thead th { color: #cbd5e1; border-bottom-color: var(--line); }
    .table td, .table th { border-color: var(--line); }
    .table-hover tbody tr:hover { background: rgba(255,255,255,.03); color: white; }
    .form-control, .form-select, .input-group-text, .btn {
      border-radius: 14px;
    }
    .form-control, .form-select {
      background: rgba(255,255,255,.04);
      border-color: rgba(148,163,184,.18);
      color: var(--text);
    }
    .form-control:focus, .form-select:focus {
      background: rgba(255,255,255,.05);
      color: var(--text);
      border-color: rgba(110,168,254,.6);
      box-shadow: 0 0 0 .2rem rgba(110,168,254,.16);
    }
    .form-control::placeholder { color: #94a3b8; }
    .btn-primary {
      background: linear-gradient(135deg, #2563eb, #06b6d4);
      border: none;
    }
    .btn-outline-light {
      border-color: rgba(255,255,255,.16);
      color: #e2e8f0;
    }
    .badge-soft {
      background: rgba(110,168,254,.16);
      border: 1px solid rgba(110,168,254,.2);
      color: #cfe1ff;
    }
    .text-muted { color: var(--muted) !important; }
    .chart-wrap {
      position: relative;
      min-height: 320px;
    }
    .page-title { font-weight: 700; letter-spacing: -0.02em; }
    .subtle-divider { border-top: 1px solid var(--line); }
    .record-pill {
      display:inline-flex; align-items:center; gap:.35rem;
      padding:.28rem .65rem; border-radius:999px;
      background: rgba(255,255,255,.05); border: 1px solid var(--line);
      color:#dbeafe; font-size:.82rem;
    }
    a { color: #9fd3ff; }
    .small-kpi { color: var(--muted); font-size: .8rem; }
    .assistant-box {
      background: linear-gradient(180deg, rgba(15,23,42,.82), rgba(2,6,23,.72));
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 20px;
    }
    .code-box {
      background: rgba(15,23,42,.8);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 14px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
<div class="container-fluid app-shell">
  <div class="row min-vh-100">
    <aside class="col-12 col-lg-2 sidebar p-3 p-lg-4">
      <div class="d-flex align-items-center gap-3 mb-4">
        <div class="rounded-4 d-flex align-items-center justify-content-center" style="width:48px;height:48px;background:linear-gradient(135deg,rgba(110,168,254,.25),rgba(94,234,212,.22));border:1px solid var(--line)">
          <i class="bi bi-pie-chart-fill fs-4 text-white"></i>
        </div>
        <div>
          <div class="brand fs-5">Financial Tracker Pro</div>
          <div class="text-muted small">Professional local v2</div>
        </div>
      </div>
      {% if session %}
      <div class="glass p-3 mb-4">
        <div class="small-kpi">Signed in as</div>
        <div class="fw-semibold">{{ session.display_name }}</div>
        <div class="text-muted small">{{ session.email }}</div>
        <div class="d-grid mt-3"><a class="btn btn-outline-light btn-sm" href="/logout"><i class="bi bi-box-arrow-right me-1"></i>Logout</a></div>
      </div>
      {% endif %}
      <div class="nav nav-pills flex-column gap-1">
        {% for item in nav %}
        <a class="nav-link {% if item.key == active %}active{% endif %}" href="/app?tab={{ item.key }}">
          <i class="bi {{ item.icon }} me-2"></i>{{ item.label }}
        </a>
        {% endfor %}
      </div>
      <div class="mt-4 glass p-3">
        <div class="small-kpi mb-1">Status</div>
        <div class="fw-semibold">Running locally</div>
        <div class="text-muted small">No Streamlit, no current script changes.</div>
      </div>
    </aside>
    <main class="col-12 col-lg-10 p-3 p-lg-4">
      {% if flash %}
      <div class="alert alert-{{ flash.kind }} glass border-0 mb-4">{{ flash.message }}</div>
      {% endif %}
      {% block content %}{% endblock %}
    </main>
  </div>
</div>
</body>
</html>
""",
    "login.html": r"""
{% extends "base.html" %}
{% block content %}
<div class="row justify-content-center align-items-center" style="min-height:80vh;">
  <div class="col-12 col-xl-6 col-xxl-5">
    <div class="glass p-4 p-md-5">
      <div class="d-flex align-items-center gap-3 mb-4">
        <div class="rounded-4 d-flex align-items-center justify-content-center" style="width:56px;height:56px;background:linear-gradient(135deg,rgba(37,99,235,.28),rgba(6,182,212,.18));border:1px solid var(--line)">
          <i class="bi bi-shield-lock-fill fs-3 text-white"></i>
        </div>
        <div>
          <h1 class="page-title h3 mb-1">Sign in</h1>
          <div class="text-muted">Access your financial tracker in the new interface.</div>
        </div>
      </div>
      <form method="post" action="/login" class="row g-3">
        <div class="col-12">
          <label class="form-label">Email</label>
          <input name="email" class="form-control form-control-lg" placeholder="you@example.com" autocomplete="username" required>
        </div>
        <div class="col-12">
          <label class="form-label">Password</label>
          <input name="password" type="password" class="form-control form-control-lg" placeholder="••••••••" autocomplete="current-password" required>
        </div>
        <div class="col-12 d-grid mt-2">
          <button class="btn btn-primary btn-lg">Continue</button>
        </div>
      </form>
      <div class="mt-4 text-muted small">
        Uses your existing Firebase login and Firestore data, but through a custom local web app.
      </div>
    </div>
  </div>
</div>
{% endblock %}
""",
    "dashboard.html": r"""
{% extends "base.html" %}
{% block content %}
<div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
  <div>
    <h1 class="page-title h2 mb-1">{{ title }}</h1>
    <div class="text-muted">{{ subtitle }}</div>
  </div>
  <div class="d-flex gap-2 flex-wrap">
    <span class="record-pill"><i class="bi bi-clock"></i> {{ now }}</span>
    <span class="record-pill"><i class="bi bi-database"></i> {{ collections|length }} collections</span>
  </div>
</div>

<div class="row g-3 mb-4">
  {% for m in metrics %}
  <div class="col-12 col-md-6 col-xxl-3">
    <div class="metric-card">
      <div class="metric-label">{{ m.label }}</div>
      <div class="metric-value">{{ m.value }}</div>
      <div class="metric-note">{{ m.note }}</div>
    </div>
  </div>
  {% endfor %}
</div>

<div class="row g-4">
  <div class="col-12 col-xxl-8">
    <div class="glass p-4 h-100">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 class="h5 mb-1">{{ chart_title }}</h2>
          <div class="text-muted small">{{ chart_note }}</div>
        </div>
        <span class="badge badge-soft rounded-pill">Live from Firestore</span>
      </div>
      <div class="chart-wrap"><canvas id="mainChart"></canvas></div>
    </div>
  </div>
  <div class="col-12 col-xxl-4">
    <div class="glass p-4 h-100">
      <h2 class="h5 mb-3">Recent activity</h2>
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle mb-0">
          <thead><tr><th>Collection</th><th>Record</th><th>Value</th></tr></thead>
          <tbody>
          {% for row in recent_rows %}
            <tr>
              <td>{{ row.collection }}</td>
              <td class="text-truncate" style="max-width:160px;">{{ row.label }}</td>
              <td>{{ row.value }}</td>
            </tr>
          {% endfor %}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<div class="row g-4 mt-1">
  <div class="col-12 col-xl-6">
    <div class="glass p-4 h-100">
      <h2 class="h5 mb-3">Top categories</h2>
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead><tr><th>Category</th><th class="text-end">Amount</th></tr></thead>
          <tbody>
          {% for row in category_rows %}
            <tr><td>{{ row.category }}</td><td class="text-end">{{ row.amount }}</td></tr>
          {% endfor %}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <div class="col-12 col-xl-6">
    <div class="glass p-4 h-100">
      <h2 class="h5 mb-3">Insight</h2>
      <p class="text-muted mb-0">{{ insight }}</p>
    </div>
  </div>
</div>

<script>
const labels = {{ chart_labels | safe }};
const values = {{ chart_values | safe }};
const ctx = document.getElementById('mainChart');
if (ctx) {
  new Chart(ctx, {
    type: '{{ chart_type }}',
    data: {
      labels,
      datasets: [{
        label: '{{ chart_series_label }}',
        data: values,
        borderColor: 'rgba(110,168,254,1)',
        backgroundColor: '{{ chart_fill }}',
        tension: 0.35,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148,163,184,.12)' } },
        y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148,163,184,.12)' } }
      }
    }
  });
}
</script>
{% endblock %}
""",
    "collection.html": r"""
{% extends "base.html" %}
{% block content %}
<div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
  <div>
    <h1 class="page-title h2 mb-1">{{ title }}</h1>
    <div class="text-muted">{{ subtitle }}</div>
  </div>
  <form method="get" action="/app" class="d-flex gap-2 flex-wrap">
    <input type="hidden" name="tab" value="{{ active }}">
    <select name="collection" class="form-select">
      {% for c in collections %}
      <option value="{{ c }}" {% if c == collection %}selected{% endif %}>{{ c }}</option>
      {% endfor %}
    </select>
    <button class="btn btn-outline-light">Open</button>
  </form>
</div>

<div class="row g-3 mb-4">
  <div class="col-12 col-md-4"><div class="metric-card"><div class="metric-label">Documents</div><div class="metric-value">{{ total_docs }}</div><div class="metric-note">Loaded from Firestore</div></div></div>
  <div class="col-12 col-md-4"><div class="metric-card"><div class="metric-label">Fields</div><div class="metric-value">{{ fields|length }}</div><div class="metric-note">{{ fields_preview }}</div></div></div>
  <div class="col-12 col-md-4"><div class="metric-card"><div class="metric-label">Last refresh</div><div class="metric-value">{{ refreshed_at }}</div><div class="metric-note">Reloaded on demand</div></div></div>
</div>

<div class="row g-4">
  <div class="col-12 col-xl-7">
    <div class="glass p-4 h-100">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="h5 mb-0">Records</h2>
        <a class="btn btn-sm btn-outline-light" href="/app?tab={{ active }}&collection={{ collection }}&refresh=1"><i class="bi bi-arrow-clockwise"></i> Refresh</a>
      </div>
      <div class="table-responsive" style="max-height: 70vh; overflow:auto;">
        <table class="table table-hover align-middle table-sm">
          <thead>
            <tr>
              <th style="width: 120px;">Actions</th>
              {% for f in fields %}<th>{{ f }}</th>{% endfor %}
            </tr>
          </thead>
          <tbody>
          {% for row in rows %}
            <tr>
              <td>
                <a class="btn btn-sm btn-outline-light me-1" href="/app?tab=transaction-manager&collection={{ collection }}&edit={{ row.id }}">Edit</a>
                <form method="post" action="/delete" style="display:inline;" onsubmit="return confirm('Delete this record?');">
                  <input type="hidden" name="collection" value="{{ collection }}">
                  <input type="hidden" name="doc_id" value="{{ row.id }}">
                  <button class="btn btn-sm btn-outline-danger">Del</button>
                </form>
              </td>
              {% for f in fields %}
              <td>{{ row.get(f, '') }}</td>
              {% endfor %}
            </tr>
          {% endfor %}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <div class="col-12 col-xl-5">
    <div class="glass p-4 mb-4">
      <h2 class="h5 mb-3">Add new record</h2>
      <form method="post" action="/upsert" class="row g-3">
        <input type="hidden" name="collection" value="{{ collection }}">
        <input type="hidden" name="mode" value="create">
        {% for f in fields %}
        <div class="col-12">
          <label class="form-label">{{ f }}</label>
          <input name="{{ f }}" class="form-control" placeholder="{{ field_placeholders.get(f, '') }}">
        </div>
        {% endfor %}
        <div class="col-12 d-grid"><button class="btn btn-primary">Create record</button></div>
      </form>
    </div>

    {% if edit_row %}
    <div class="glass p-4">
      <h2 class="h5 mb-3">Edit record</h2>
      <form method="post" action="/upsert" class="row g-3">
        <input type="hidden" name="collection" value="{{ collection }}">
        <input type="hidden" name="mode" value="update">
        <input type="hidden" name="doc_id" value="{{ edit_row.id }}">
        {% for f in fields %}
        <div class="col-12">
          <label class="form-label">{{ f }}</label>
          <input name="{{ f }}" class="form-control" value="{{ edit_row.get(f, '') }}">
        </div>
        {% endfor %}
        <div class="col-12 d-grid"><button class="btn btn-primary">Save changes</button></div>
      </form>
    </div>
    {% endif %}
  </div>
</div>
{% endblock %}
""",
    "assistant.html": r"""
{% extends "base.html" %}
{% block content %}
<div class="d-flex justify-content-between align-items-start align-items-md-center flex-column flex-md-row gap-3 mb-4">
  <div>
    <h1 class="page-title h2 mb-1">Financial Mate</h1>
    <div class="text-muted">AI assistant powered by Gemini REST, with Firestore context.</div>
  </div>
  <span class="record-pill"><i class="bi bi-stars"></i> Professional analyst mode</span>
</div>

<div class="row g-4">
  <div class="col-12 col-xl-5">
    <div class="assistant-box">
      <form method="post" action="/assistant" class="row g-3">
        <div class="col-12">
          <label class="form-label">Ask a question</label>
          <textarea name="prompt" class="form-control" rows="8" placeholder="e.g. Why are expenses higher this month? What changed versus last month?" required>{{ prompt }}</textarea>
        </div>
        <div class="col-12 d-grid">
          <button class="btn btn-primary btn-lg">Analyze</button>
        </div>
      </form>
      <div class="mt-3 text-muted small">Tip: ask for a summary, trend, anomalies, or a breakdown by collection.</div>
    </div>
  </div>
  <div class="col-12 col-xl-7">
    <div class="glass p-4 h-100">
      <h2 class="h5 mb-3">Result</h2>
      {% if answer %}
        <div class="code-box">{{ answer }}</div>
      {% else %}
        <div class="text-muted">Your answer will appear here.</div>
      {% endif %}
      {% if notes %}
      <div class="mt-4">
        <h3 class="h6 text-uppercase text-muted">Notes</h3>
        <div class="small text-muted">{{ notes }}</div>
      </div>
      {% endif %}
    </div>
  </div>
</div>
{% endblock %}
""",
}

ENV = Environment(
    loader=DictLoader(TEMPLATES),
    autoescape=select_autoescape(["html", "xml"]),
)


def now_kuala_lumpur() -> dt.datetime:
    return dt.datetime.now(DEFAULT_TZ)


def fmt_money(value: Any) -> str:
    try:
        return f"RM {float(value):,.2f}"
    except Exception:
        return str(value)


def fmt_num(value: Any) -> str:
    try:
        n = float(value)
        if abs(n - round(n)) < 1e-9:
            return f"{int(round(n)):,}"
        return f"{n:,.2f}"
    except Exception:
        return str(value)


def infer_type(value: Any) -> str:
    if value is None:
        return "str"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, (dt.datetime, dt.date)):
        return "date"
    return "str"


def normalize_value(raw: str, field_type: str) -> Any:
    text = (raw or "").strip()
    if text == "":
        return None
    if field_type == "bool":
        return text.lower() in {"1", "true", "yes", "y", "on"}
    if field_type == "int":
        try:
            return int(float(text.replace(",", "")))
        except Exception:
            return text
    if field_type == "float":
        try:
            return float(text.replace(",", ""))
        except Exception:
            return text
    if field_type == "date":
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                return dt.datetime.strptime(text, fmt).date()
            except Exception:
                pass
        try:
            return dt.datetime.fromisoformat(text)
        except Exception:
            return text
    return text


class FirebaseRest:
    def __init__(self, email: str):
        if email not in USER_CONFIGS:
            raise ValueError("Unauthorized user")
        self.email = email
        self.conf = USER_CONFIGS[email]
        self.project_id = self.conf["firebase_project_id"]
        self.api_key = self.conf["firebase_api_key"]
        self.sa_path = self.conf["service_account"]
        self._sa = self._load_sa()
        self._access_token = None
        self._token_exp = 0.0
        self._id_token = None
        self._refresh_token = None
        self._local_id = None

    def _load_sa(self) -> Dict[str, Any]:
        with open(self.sa_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def sign_in(self, password: str) -> Dict[str, Any]:
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={self.api_key}"
        payload = {"email": self.email, "password": password, "returnSecureToken": True}
        r = requests.post(url, json=payload, timeout=30)
        if not r.ok:
            raise RuntimeError(r.text)
        data = r.json()
        self._id_token = data["idToken"]
        self._refresh_token = data.get("refreshToken")
        self._local_id = data.get("localId")
        return data

    def id_token(self) -> str:
        if not self._id_token:
            raise RuntimeError("Not signed in")
        return self._id_token

    def access_token(self) -> str:
        if self._access_token and time.time() < self._token_exp - 60:
            return self._access_token
        scope = "https://www.googleapis.com/auth/datastore"
        now = int(time.time())
        payload = {
            "iss": self._sa["client_email"],
            "scope": scope,
            "aud": self._sa["token_uri"],
            "iat": now,
            "exp": now + 3600,
        }
        headers = {"kid": self._sa.get("private_key_id")}
        assertion = jwt.encode(payload, self._sa["private_key"], algorithm="RS256", headers=headers)
        token_resp = requests.post(
            self._sa["token_uri"],
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
            timeout=30,
        )
        if not token_resp.ok:
            raise RuntimeError(token_resp.text)
        data = token_resp.json()
        self._access_token = data["access_token"]
        self._token_exp = time.time() + int(data.get("expires_in", 3600))
        return self._access_token

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token()}", "Content-Type": "application/json"}

    def list_collection_ids(self) -> List[str]:
        url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents:listCollectionIds"
        r = requests.post(url, headers=self._headers(), json={"pageSize": 200}, timeout=30)
        if not r.ok:
            raise RuntimeError(r.text)
        ids = r.json().get("collectionIds", [])
        ids = sorted(set(ids))
        for required in ["expensesummary", "commitment", "accounts", "transaction_templates", "bank", "banks", "cardusage", "investment", "share", "fd", "epf", "insuranceinvestment", "sspn"]:
            if required not in ids:
                ids.append(required)
        return ids

    def list_documents(self, collection: str, page_size: int = 500) -> List[Dict[str, Any]]:
        url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents/{collection}"
        r = requests.get(url, headers=self._headers(), params={"pageSize": page_size}, timeout=45)
        if r.status_code == 404:
            return []
        if not r.ok:
            raise RuntimeError(r.text)
        docs = []
        for doc in r.json().get("documents", []):
            docs.append(self._doc_to_python(doc))
        return docs

    def create_document(self, collection: str, data: Dict[str, Any]) -> Dict[str, Any]:
        body = {"fields": self._python_to_firestore_fields(data)}
        url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents/{collection}"
        r = requests.post(url, headers=self._headers(), json=body, timeout=45)
        if not r.ok:
            raise RuntimeError(r.text)
        return self._doc_to_python(r.json())

    def update_document(self, collection: str, doc_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        body = {"fields": self._python_to_firestore_fields(data)}
        url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents/{collection}/{urllib.parse.quote(doc_id, safe='')}"
        r = requests.patch(url, headers=self._headers(), json=body, timeout=45)
        if not r.ok:
            raise RuntimeError(r.text)
        return self._doc_to_python(r.json())

    def delete_document(self, collection: str, doc_id: str) -> None:
        url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents/{collection}/{urllib.parse.quote(doc_id, safe='')}"
        r = requests.delete(url, headers=self._headers(), timeout=45)
        if not r.ok:
            raise RuntimeError(r.text)

    def _doc_to_python(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        fields = doc.get("fields", {})
        out = {k: self._firestore_value_to_python(v) for k, v in fields.items()}
        out["id"] = doc.get("name", "").split("/")[-1]
        out["_name"] = doc.get("name")
        out["_create_time"] = doc.get("createTime")
        out["_update_time"] = doc.get("updateTime")
        return out

    def _firestore_value_to_python(self, value: Dict[str, Any]) -> Any:
        if not isinstance(value, dict):
            return value
        if "stringValue" in value:
            return value["stringValue"]
        if "integerValue" in value:
            try:
                return int(value["integerValue"])
            except Exception:
                return value["integerValue"]
        if "doubleValue" in value:
            return float(value["doubleValue"])
        if "booleanValue" in value:
            return bool(value["booleanValue"])
        if "timestampValue" in value:
            raw = value["timestampValue"]
            try:
                return dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except Exception:
                return raw
        if "mapValue" in value:
            fields = value["mapValue"].get("fields", {})
            return {k: self._firestore_value_to_python(v) for k, v in fields.items()}
        if "arrayValue" in value:
            arr = value["arrayValue"].get("values", [])
            return [self._firestore_value_to_python(v) for v in arr]
        if "nullValue" in value:
            return None
        return value

    def _python_to_firestore_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        fields: Dict[str, Any] = {}
        for k, v in data.items():
            if k.startswith("_") or k == "id":
                continue
            fields[k] = self._python_to_firestore_value(v)
        return fields

    def _python_to_firestore_value(self, value: Any) -> Dict[str, Any]:
        if value is None:
            return {"nullValue": None}
        if isinstance(value, bool):
            return {"booleanValue": value}
        if isinstance(value, int) and not isinstance(value, bool):
            return {"integerValue": str(value)}
        if isinstance(value, float):
            return {"doubleValue": value}
        if isinstance(value, dt.datetime):
            dtv = value
            if dtv.tzinfo is None:
                dtv = dtv.replace(tzinfo=DEFAULT_TZ)
            return {"timestampValue": dtv.isoformat()}
        if isinstance(value, dt.date):
            dtv = dt.datetime.combine(value, dt.time(0, 0), tzinfo=DEFAULT_TZ)
            return {"timestampValue": dtv.isoformat()}
        if isinstance(value, dict):
            return {"mapValue": {"fields": self._python_to_firestore_fields(value)}}
        if isinstance(value, list):
            return {"arrayValue": {"values": [self._python_to_firestore_value(v) for v in value]}}
        return {"stringValue": str(value)}


GEMINI_API_KEY = "AIzaSyBOFmlgZw4VgkYYzYojd8bYvCzi3KxKEm0"
GEMINI_MODEL = "gemini-2.5-pro"


def gemini_generate(prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1200},
    }
    r = requests.post(url, json=payload, timeout=90)
    if not r.ok:
        raise RuntimeError(r.text)
    data = r.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def get_session(handler: BaseHTTPRequestHandler) -> Optional[Dict[str, Any]]:
    cookie = SimpleCookie(handler.headers.get("Cookie"))
    sid = cookie.get("ft_v2_sid")
    if not sid:
        return None
    with SESSION_LOCK:
        sess = SESSION_STORE.get(sid.value)
        if not sess:
            return None
        sess["last_seen"] = time.time()
        return sess


def set_session_cookie(handler: BaseHTTPRequestHandler, sid: str):
    handler.send_header("Set-Cookie", f"ft_v2_sid={sid}; Path=/; HttpOnly; SameSite=Lax")


def create_session(email: str, auth_data: Dict[str, Any]) -> str:
    sid = secrets.token_urlsafe(32)
    with SESSION_LOCK:
        SESSION_STORE[sid] = {
            "email": email,
            "display_name": USER_CONFIGS[email]["display_name"],
            "auth": auth_data,
            "firebase": None,
            "last_seen": time.time(),
        }
    return sid


def get_firebase(sess: Dict[str, Any]) -> FirebaseRest:
    firebase = sess.get("firebase")
    if firebase is None:
        firebase = FirebaseRest(sess["email"])
        firebase._id_token = sess["auth"]["idToken"]
        firebase._refresh_token = sess["auth"].get("refreshToken")
        firebase._local_id = sess["auth"].get("localId")
        sess["firebase"] = firebase
    return firebase


def flash(kind: str, message: str) -> Dict[str, str]:
    return {"kind": kind, "message": message}


def summarize_df(rows: List[Dict[str, Any]]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows)


def collection_schema(rows: List[Dict[str, Any]]) -> List[str]:
    keys: List[str] = []
    seen = set()
    for row in rows:
        for key in row.keys():
            if key.startswith("_") or key == "id":
                continue
            if key not in seen:
                seen.add(key)
                keys.append(key)
    return keys


def detect_field_types(rows: List[Dict[str, Any]], fields: List[str]) -> Dict[str, str]:
    inferred = {f: "str" for f in fields}
    for row in rows:
        for field in fields:
            if field in row and row[field] is not None:
                inferred[field] = infer_type(row[field])
    return inferred


def safe_float(x: Any) -> float:
    try:
        return float(x)
    except Exception:
        return 0.0


def as_num(x: Any) -> float:
    if isinstance(x, (int, float)):
        return float(x)
    if isinstance(x, str):
        try:
            return float(x.replace(",", ""))
        except Exception:
            return 0.0
    return 0.0


def top_amount_rows(rows: List[Dict[str, Any]], amount_key_candidates: List[str] = ["Amount", "amount", "Value", "value"]) -> List[Dict[str, Any]]:
    amount_key = None
    for k in amount_key_candidates:
        if rows and any(k in r for r in rows):
            amount_key = k
            break
    if not amount_key:
        return []
    sorted_rows = sorted(rows, key=lambda r: abs(as_num(r.get(amount_key))), reverse=True)
    return sorted_rows[:6]


def money_sum(rows: List[Dict[str, Any]], key: str = "Amount") -> float:
    return sum(as_num(r.get(key)) for r in rows)


def recent_rows_for_display(collection: str, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out = []
    for row in rows[:8]:
        label_bits = [str(row.get(k, "")) for k in ("Name", "Category", "Description", "Insurer", "Company", "Title") if row.get(k)]
        label = " · ".join(label_bits[:2]) if label_bits else row.get("id", "")
        value = ""
        for key in ("Amount", "TCV", "MRC", "OTC", "Balance", "Value", "Unit Price"):
            if key in row:
                value = fmt_money(row.get(key))
                break
        out.append({"collection": collection, "label": label or row.get("id", ""), "value": value})
    return out


def expense_categories(rows: List[Dict[str, Any]]) -> List[Tuple[str, float]]:
    totals = defaultdict(float)
    for row in rows:
        cat = str(row.get("Category") or row.get("Expense Category") or row.get("Type") or "Uncategorised")
        amount = as_num(row.get("Amount", row.get("amount", 0)))
        totals[cat] += amount
    return sorted(totals.items(), key=lambda item: abs(item[1]), reverse=True)


def build_dashboard(sess: Dict[str, Any], firebase: FirebaseRest, collections: Dict[str, List[Dict[str, Any]]], active: str, flash_msg: Optional[Dict[str, str]] = None):
    expenses = collections.get("expensesummary", [])
    commitment = collections.get("commitment", [])
    accounts = collections.get("accounts", [])
    investments = collections.get("investment", []) + collections.get("share", []) + collections.get("fd", []) + collections.get("epf", []) + collections.get("insuranceinvestment", []) + collections.get("sspn", [])

    expense_total = sum(abs(as_num(r.get("Amount"))) for r in expenses if str(r.get("Category", "")).lower() != "salary")
    salary = sum(as_num(r.get("Amount")) for r in expenses if str(r.get("Category", "")).lower() == "salary")
    gross = salary * (0.70 if sess["email"] == "chengfai@hotmail.com" else 0.86)
    balance = gross - expense_total
    annual_commitment = sum(as_num(r.get("Amount")) for r in commitment)
    net_assets = sum(as_num(r.get("Balance", r.get("Amount", 0))) for r in accounts)
    inv_total = sum(as_num(r.get("Amount", r.get("Total Amount", r.get("Value", 0)))) for r in investments)

    metrics = [
        {"label": "Salary Income", "value": fmt_money(salary), "note": "From expensesummary / Salary"},
        {"label": "Monthly Expenses", "value": fmt_money(expense_total), "note": "Non-salary monthly outflow"},
        {"label": "Cash Balance", "value": fmt_money(balance), "note": "After estimated tax"},
        {"label": "Net Assets", "value": fmt_money(net_assets + inv_total), "note": "Accounts + investments"},
    ]

    chart_data = expense_categories(expenses)
    chart_labels = [k for k, _ in chart_data[:10]] or ["No data"]
    chart_values = [abs(v) for _, v in chart_data[:10]] or [0]
    recent = []
    for c in ["expensesummary", "commitment", "accounts", "investment", "share"]:
        recent.extend(recent_rows_for_display(c, collections.get(c, [])[:4]))
    recent = recent[:8]
    category_rows = [{"category": k, "amount": fmt_money(v)} for k, v in chart_data[:8]]
    insight = (
        f"Current salary estimate is {fmt_money(salary)} with monthly expenses of {fmt_money(expense_total)}. "
        f"Projected post-tax balance is {fmt_money(balance)}. Annual commitments total {fmt_money(annual_commitment)}."
    )
    return ENV.get_template("dashboard.html").render(
        title="Executive Dashboard",
        subtitle="A cleaner, more mature view of the same financial data.",
        session=sess,
        nav=NAV,
        active=active,
        flash=flash_msg,
        now=now_kuala_lumpur().strftime("%a, %d %b %Y %H:%M"),
        collections=list(collections.keys()),
        metrics=metrics,
        chart_title="Expense distribution",
        chart_note="Top categories from expensesummary",
        chart_labels=json.dumps(chart_labels),
        chart_values=json.dumps(chart_values),
        chart_type="doughnut",
        chart_series_label="Amount",
        chart_fill="rgba(110,168,254,0.24)",
        recent_rows=recent,
        category_rows=category_rows,
        insight=insight,
    )


NAV = [
    {"key": "dashboard", "label": "Dashboard", "icon": "bi-speedometer2"},
    {"key": "monthly-expense", "label": "Monthly Expense", "icon": "bi-wallet2"},
    {"key": "transaction-manager", "label": "Transaction Manager", "icon": "bi-list-check"},
    {"key": "monthly-commitment", "label": "Monthly Commitment", "icon": "bi-calendar-week"},
    {"key": "accounts", "label": "Accounts", "icon": "bi-bank"},
    {"key": "template", "label": "Template Library", "icon": "bi-ui-checks-grid"},
    {"key": "financial-mate", "label": "Financial Mate", "icon": "bi-chat-square-dots"},
]


def load_all_data(firebase: FirebaseRest) -> Tuple[Dict[str, List[Dict[str, Any]]], Dict[str, List[str]]]:
    try:
        col_ids = firebase.list_collection_ids()
    except Exception:
        col_ids = list(CHART_HINTS.keys())
    data: Dict[str, List[Dict[str, Any]]] = {}
    schema: Dict[str, List[str]] = {}
    for col in col_ids:
        try:
            rows = firebase.list_documents(col)
        except Exception:
            rows = []
        data[col] = rows
        schema[col] = collection_schema(rows)
    return data, schema


def refresh_cache(firebase: FirebaseRest):
    data, schema = load_all_data(firebase)
    CACHE["data"] = data
    CACHE["schema"] = schema
    CACHE["fetched_at"] = time.time()
    return data, schema


def get_cached_data(firebase: FirebaseRest, force: bool = False):
    if force or not CACHE["data"] or (time.time() - CACHE["fetched_at"] > 120):
        return refresh_cache(firebase)
    return CACHE["data"], CACHE["schema"]


def render_collection_page(sess: Dict[str, Any], firebase: FirebaseRest, collections: Dict[str, List[Dict[str, Any]]], active: str, collection: str, edit_id: Optional[str], flash_msg: Optional[Dict[str, str]]):
    rows = collections.get(collection, [])
    fields = collection_schema(rows)
    ftypes = detect_field_types(rows, fields)
    edit_row = next((r for r in rows if r.get("id") == edit_id), None)
    field_placeholders = {f: f"{ftypes.get(f, 'str')} value" for f in fields}
    return ENV.get_template("collection.html").render(
        title=collection.replace("_", " ").title(),
        subtitle="Browse, add, edit, and delete records with a professional UI.",
        session=sess,
        nav=NAV,
        active=active,
        flash=flash_msg,
        collections=sorted(collections.keys()),
        collection=collection,
        total_docs=len(rows),
        fields=fields[:18],
        fields_preview=", ".join(fields[:6]) + ("…" if len(fields) > 6 else ""),
        rows=rows[:200],
        edit_row=edit_row,
        field_placeholders=field_placeholders,
        refreshed_at=now_kuala_lumpur().strftime("%H:%M:%S"),
    )


def render_monthly_expense(sess: Dict[str, Any], firebase: FirebaseRest, collections: Dict[str, List[Dict[str, Any]]], flash_msg: Optional[Dict[str, str]]):
    expenses = collections.get("expensesummary", [])
    commitment = collections.get("commitment", [])
    filtered_commitment = [r for r in commitment if not any(k.lower() in str(r.get("Description", "")).lower() for k in ["Installment", "Nirvana", "Piano", "GHHS", "Coway", "Netflix", "Spotify", "Maintenance Fee"])]
    annual_total = sum(as_num(r.get("Amount")) for r in filtered_commitment)
    monthly_avg = annual_total / 12 if annual_total else 0
    rounded_monthly = int(((monthly_avg + 99) // 100) * 100) if monthly_avg else 0
    salary = sum(as_num(r.get("Amount")) for r in expenses if str(r.get("Category", "")).lower() == "salary")
    gross = salary * (0.70 if sess["email"] == "chengfai@hotmail.com" else 0.86)
    monthly = defaultdict(float)
    for row in expenses:
        monthly[str(row.get("Category") or "Uncategorised")] += abs(as_num(row.get("Amount")))
    top = sorted(monthly.items(), key=lambda item: item[1], reverse=True)[:12]
    chart_labels = [k for k, _ in top] or ["No data"]
    chart_values = [v for _, v in top] or [0]
    return ENV.get_template("dashboard.html").render(
        title="Monthly Expense",
        subtitle="Income, commitments, and spending built into one disciplined view.",
        session=sess,
        nav=NAV,
        active="monthly-expense",
        flash=flash_msg,
        now=now_kuala_lumpur().strftime("%a, %d %b %Y %H:%M"),
        collections=sorted(collections.keys()),
        metrics=[
            {"label": "Annual Commitment", "value": fmt_money(annual_total), "note": "Filtered monthly commitments"},
            {"label": "Suggested Monthly", "value": fmt_money(rounded_monthly), "note": "Rounded monthly target"},
            {"label": "Salary", "value": fmt_money(salary), "note": "Salary bucket from expensesummary"},
            {"label": "Gross After Tax", "value": fmt_money(gross), "note": "Based on your current rules"},
        ],
        chart_title="Spend by category",
        chart_note="Top monthly categories from expensesummary",
        chart_labels=json.dumps(chart_labels),
        chart_values=json.dumps(chart_values),
        chart_type="bar",
        chart_series_label="Amount",
        chart_fill="rgba(94,234,212,0.25)",
        recent_rows=[{"collection": "expensesummary", "label": r.get("Category", r.get("Description", r.get("Name", r.get("id", "")))), "value": fmt_money(r.get("Amount"))} for r in expenses[:8]],
        category_rows=[{"category": k, "amount": fmt_money(v)} for k, v in top[:8]],
        insight=f"If you carry these commitments into the next year, the annualized amount is {fmt_money(annual_total)} and the rounded monthly projection is {fmt_money(rounded_monthly)}.",
    )


def render_assistant(sess: Dict[str, Any], firebase: FirebaseRest, collections: Dict[str, List[Dict[str, Any]]], prompt: str = "", answer: str = "", notes: str = "", flash_msg: Optional[Dict[str, str]] = None):
    return ENV.get_template("assistant.html").render(
        title="Financial Mate",
        subtitle="Natural-language analysis with your current Firestore data.",
        session=sess,
        nav=NAV,
        active="financial-mate",
        flash=flash_msg,
        prompt=prompt,
        answer=answer,
        notes=notes,
    )


def build_prompt(firebase: FirebaseRest, collections: Dict[str, List[Dict[str, Any]]], user_prompt: str) -> str:
    summary_bits = []
    for name in ["expensesummary", "commitment", "accounts", "investment", "share", "fd", "epf", "insuranceinvestment", "sspn"]:
        rows = collections.get(name, [])
        if not rows:
            continue
        summary_bits.append(f"[{name}] rows={len(rows)} fields={collection_schema(rows)[:12]}")
        preview = rows[:5]
        summary_bits.append(json.dumps(preview, default=str)[:2500])
    return f"""
You are a senior financial analyst assistant inside a professional internal finance app.

User email: {firebase.email}

You must answer in concise professional language.
If the user asks for numbers, use the provided data and state any assumptions.
If data is missing, say so plainly.

DATA SUMMARY:
{os.linesep.join(summary_bits)}

QUESTION:
{user_prompt}
""".strip()


class Handler(BaseHTTPRequestHandler):
    server_version = "FTV2/1.0"

    def log_message(self, fmt, *args):
        return

    def send_html(self, html_text: str, status: int = 200, extra_headers: Optional[Dict[str, str]] = None):
        body = html_text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def send_redirect(self, location: str, cookie_sid: Optional[str] = None):
        self.send_response(302)
        if cookie_sid:
            set_session_cookie(self, cookie_sid)
        self.send_header("Location", location)
        self.end_headers()

    def parse_form(self) -> Dict[str, str]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8", errors="ignore")
        return {k: v[0] for k, v in urllib.parse.parse_qs(raw, keep_blank_values=True).items()}

    def do_GET(self):
        path = urllib.parse.urlparse(self.path)
        route = path.path
        query = urllib.parse.parse_qs(path.query)
        sess = get_session(self)
        if route == "/":
            if sess:
                return self.send_redirect("/app?tab=dashboard")
            return self.send_redirect("/login")
        if route == "/login":
            if sess:
                return self.send_redirect("/app?tab=dashboard")
            html_text = ENV.get_template("login.html").render(title="Login", nav=[], active="", session=None, flash=None)
            return self.send_html(html_text)
        if route == "/logout":
            cookie = SimpleCookie(self.headers.get("Cookie"))
            sid = cookie.get("ft_v2_sid")
            if sid:
                with SESSION_LOCK:
                    SESSION_STORE.pop(sid.value, None)
            self.send_response(302)
            self.send_header("Set-Cookie", "ft_v2_sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
            self.send_header("Location", "/login")
            self.end_headers()
            return
        if route != "/app":
            return self.send_html("<h1>Not found</h1>", status=404)
        if not sess:
            return self.send_redirect("/login")
        try:
            firebase = get_firebase(sess)
            force = query.get("refresh", ["0"])[0] == "1"
            collections, schema = get_cached_data(firebase, force=force)
            tab = query.get("tab", ["dashboard"])[0]
            collection = query.get("collection", ["expensesummary"])[0]
            edit = query.get("edit", [None])[0]
            flash_msg = None
            if tab == "dashboard":
                return self.send_html(build_dashboard(sess, firebase, collections, tab))
            if tab == "monthly-expense":
                return self.send_html(render_monthly_expense(sess, firebase, collections, flash_msg))
            if tab == "transaction-manager":
                if collection not in collections:
                    collection = next(iter(collections.keys()), "expensesummary")
                return self.send_html(render_collection_page(sess, firebase, collections, tab, collection, edit, flash_msg))
            if tab == "monthly-commitment":
                collection = "commitment" if "commitment" in collections else collection
                return self.send_html(render_collection_page(sess, firebase, collections, tab, collection, edit, flash_msg))
            if tab == "accounts":
                collection = "accounts" if "accounts" in collections else collection
                return self.send_html(render_collection_page(sess, firebase, collections, tab, collection, edit, flash_msg))
            if tab == "template":
                collection = "transaction_templates" if "transaction_templates" in collections else collection
                return self.send_html(render_collection_page(sess, firebase, collections, tab, collection, edit, flash_msg))
            if tab == "financial-mate":
                return self.send_html(render_assistant(sess, firebase, collections, flash_msg=flash_msg))
            return self.send_html(build_dashboard(sess, firebase, collections, "dashboard"))
        except Exception as e:
            return self.send_html(f"<pre style='white-space:pre-wrap;color:#fff;background:#111;padding:20px'>Error: {html.escape(str(e))}</pre>", status=500)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path)
        route = path.path
        sess = get_session(self)
        if route == "/login":
            form = self.parse_form()
            email = form.get("email", "").strip().lower()
            password = form.get("password", "")
            if email not in USER_CONFIGS:
                return self.send_html(ENV.get_template("login.html").render(title="Login", nav=[], active="", session=None, flash=flash("danger", "Unauthorized user.")), status=401)
            try:
                firebase = FirebaseRest(email)
                auth = firebase.sign_in(password)
                sid = create_session(email, auth)
                with SESSION_LOCK:
                    SESSION_STORE[sid]["firebase"] = firebase
                return self.send_redirect("/app?tab=dashboard", cookie_sid=sid)
            except Exception as e:
                message = str(e)
                if len(message) > 260:
                    message = message[:260] + "…"
                return self.send_html(ENV.get_template("login.html").render(title="Login", nav=[], active="", session=None, flash=flash("danger", f"Login failed: {message}")), status=401)

        if not sess:
            return self.send_redirect("/login")

        firebase = get_firebase(sess)
        form = self.parse_form()
        try:
            if route == "/delete":
                collection = form.get("collection", "")
                doc_id = form.get("doc_id", "")
                firebase.delete_document(collection, doc_id)
                refresh_cache(firebase)
                return self.send_redirect(f"/app?tab=transaction-manager&collection={urllib.parse.quote(collection)}")

            if route == "/upsert":
                collection = form.get("collection", "")
                mode = form.get("mode", "create")
                doc_id = form.get("doc_id", "")
                current_rows = CACHE["data"].get(collection, [])
                fields = collection_schema(current_rows)
                ftypes = detect_field_types(current_rows, fields)
                data = {}
                for field in fields:
                    if field in form:
                        data[field] = normalize_value(form[field], ftypes.get(field, "str"))
                if mode == "create":
                    firebase.create_document(collection, data)
                else:
                    firebase.update_document(collection, doc_id, data)
                refresh_cache(firebase)
                return self.send_redirect(f"/app?tab=transaction-manager&collection={urllib.parse.quote(collection)}")

            if route == "/assistant":
                prompt = form.get("prompt", "").strip()
                collections, schema = get_cached_data(firebase)
                built_prompt = build_prompt(firebase, collections, prompt)
                try:
                    answer = gemini_generate(built_prompt)
                except Exception as e:
                    answer = f"Gemini request failed: {e}"
                return self.send_html(render_assistant(sess, firebase, collections, prompt=prompt, answer=answer, notes="Generated from your live Firestore data."))

            return self.send_html("<h1>Not found</h1>", status=404)
        except Exception as e:
            return self.send_html(f"<pre style='white-space:pre-wrap;color:#fff;background:#111;padding:20px'>Error: {html.escape(str(e))}</pre>", status=500)


def main():
    print(f"Financial Tracker Pro v2 starting on http://{HOST}:{PORT}")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
