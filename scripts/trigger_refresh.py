import requests
import os

try:
    with open('/home/chengfai/.dash_pat', 'r') as f:
        TOKEN = f.read().strip()
except Exception as e:
    print(f"Error reading token: {e}")
    exit(1)

URL = "https://api.github.com/repos/chengfai80/investment-dashboard/actions/workflows/refresh-dashboard.yml/dispatches"

headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {TOKEN}"
}

response = requests.post(URL, headers=headers, json={"ref": "main"})
if response.status_code == 204:
    print("Successfully triggered GitHub workflow!")
else:
    print(f"Failed to trigger workflow: {response.status_code} {response.text}")
