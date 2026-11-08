"""Read-only integration smoke test against the local isolated demo server."""
import json
import os
from pathlib import Path
import urllib.request
import urllib.error

base = os.environ.get("API_BASE_URL", "http://localhost:5020/api/v1")
def call(path, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(base + path, data=json.dumps(body).encode() if body else None, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

password = os.environ.get("DEMO_PASSWORD")
if not password:
    raise SystemExit("Set DEMO_PASSWORD to match your local demo server.")
login = call("/auth/login", body={"username": "demo", "password": password})
if not login["user"].get("isDemo"):
    raise SystemExit("Refusing to test a non-demo environment.")
token = login["accessToken"]
session = call("/sessions", token)["items"][0]["id"]
candidate = call("/candidates", token)["items"][0]["id"]
paths = ["/auth/me", "/sessions", f"/sessions/{session}", f"/sessions/{session}/evaluators",
         "/candidates", f"/candidates/{candidate}", f"/candidates/{candidate}/evaluators",
         "/candidates/available-evaluators", "/evaluations/questions", "/evaluations/my",
         f"/evaluations/session/{session}", "/manager/dashboard", "/manager/pending-decisions",
         f"/manager/sessions/{session}/comparison", "/manager/evaluator-analytics", "/manager/audit-log",
         "/reports/candidates", "/reports/sessions", "/reports/evaluators", "/reports/results",
         "/users", "/users/roles", "/users/evaluators", "/users/" + login["user"]["id"],
         "/admin/questions", "/admin/settings", "/admin/reference-lists",
         "/admin/reference-lists/Qualification", "/notifications", "/notifications/unread-count"]
results = []
for path in paths:
    try:
        call(path, token)
        results.append({"path": path, "passed": True})
    except (urllib.error.HTTPError, urllib.error.URLError) as error:
        results.append({"path": path, "passed": False, "error": str(error)})
out = Path(__file__).resolve().parents[1] / "output"
out.mkdir(exist_ok=True)
(out / "demo-smoke.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
raise SystemExit(any(not result["passed"] for result in results))
