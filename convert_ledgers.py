#!/usr/bin/env python3
"""Convert brief-run ledger markdown tables into site-src day JSON files.
Usage: convert_ledgers.py YYYY-MM-DD [YYYY-MM-DD ...]
Reads ~/workspace/goals/9/hidden_files/<date>-brief-run.md, writes
site-src/days/<date>.json in build.py schema."""
import json, os, re, sys

BASE = os.path.expanduser("~/workspace/goals/9/hidden_files")
DAYS = os.path.join(BASE, "site-src", "days")

def parse(date):
    path = os.path.join(BASE, f"{date}-brief-run.md")
    items, grp = [], ""
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            m = re.match(r"###\s*销量带\s*([0-9–\-]+)", line)
            if m:
                grp = f"销量带 {m.group(1)}"
                continue
            if line.startswith("###"):
                grp = ""
                continue
            if not line.startswith("|"):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) != 13 or not cells[0].isdigit() or not cells[4].isdigit():
                continue
            _, b, p, t, iid, price, cond, sold, avail, loc, fit, _link, note = cells
            items.append({
                "avail": avail, "b": b, "cond": cond,
                "fit": "" if fit == "—" else fit,
                "grp": grp, "id": iid, "loc": loc,
                "note": "" if note == "—" else note,
                "p": p, "price": price, "sold": int(sold), "t": t,
            })
    return {"date": date, "items": items}

for date in sys.argv[1:]:
    day = parse(date)
    out = os.path.join(DAYS, f"{date}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(day, f, ensure_ascii=False, indent=1, sort_keys=True)
    print(f"{date}: {len(day['items'])} items -> {out}")
