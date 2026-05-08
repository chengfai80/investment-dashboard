import requests

TOKEN = "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"
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
