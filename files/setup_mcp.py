import json, os, pathlib

config_path = pathlib.Path(os.environ["APPDATA"]) / "Claude" / "claude_desktop_config.json"
config_path.parent.mkdir(parents=True, exist_ok=True)

# קרא config קיים אם יש
existing = {}
if config_path.exists():
    try:
        existing = json.loads(config_path.read_text(encoding="utf-8"))
        # גיבוי
        backup = config_path.with_suffix(".json.backup")
        backup.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"גיבוי נשמר: {backup}")
    except:
        pass

# הוסף את השרת החדש
if "mcpServers" not in existing:
    existing["mcpServers"] = {}

existing["mcpServers"]["technion-ece"] = {
    "command": "python",
    "args": [r"C:\Users\eyald\OneDrive - Technion\planer_ee\files\mcp_server.py"],
    "env": {
        "PINECONE_API_KEY": "pcsk_7A2auo_GK7Br7suohjBAucJC4SgsoKxiEqXDNgVtoMqasymWhnGuRnv72FNagr1oYAY6DS"
    }
}

config_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n✅ הושלם! Config נכתב ל:\n   {config_path}")
print("\n⚠️  סגור ופתח את Claude מחדש!")
input("\nלחץ Enter לסיום...")
