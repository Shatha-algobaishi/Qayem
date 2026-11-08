"""Query the public OSV vulnerability database for Maven's resolved dependencies.

Run mvn dependency:list -DoutputFile=target/dependencies.txt first.
No credentials or application data are transmitted: only package names/versions.
"""
import json
from pathlib import Path
import re
import urllib.request

root = Path(__file__).resolve().parents[1]
dependencies = []
for line in (root / "backend-java/target/dependencies.txt").read_text().splitlines():
    match = re.match(r"\s+([^:\s]+):([^:\s]+):jar:([^:\s]+):(compile|runtime|test)", line)
    if match:
        group, artifact, version, scope = match.groups()
        dependencies.append({"name": f"{group}:{artifact}", "version": version, "scope": scope})
if not dependencies:
    raise SystemExit("No resolved Maven dependencies found.")
payload = {"queries": [{"package": {"ecosystem": "Maven", "name": dep["name"]},
                        "version": dep["version"]} for dep in dependencies]}
request = urllib.request.Request("https://api.osv.dev/v1/querybatch",
                                 data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
with urllib.request.urlopen(request, timeout=60) as response:
    results = json.load(response)["results"]
findings = [{**dep, "advisories": [v["id"] for v in result.get("vulns", [])]}
            for dep, result in zip(dependencies, results) if result.get("vulns")]
report = {"source": "https://osv.dev", "dependenciesChecked": len(dependencies), "findings": findings}
out = root / "output/security"
out.mkdir(parents=True, exist_ok=True)
(out / "maven-osv.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
raise SystemExit(bool(findings))
