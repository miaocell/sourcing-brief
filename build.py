#!/usr/bin/env python3
"""Build the sourcing brief site (index.html + records/*.md + data.json)
from day files in days/ (one JSON per day, newest kept: last 7 days).
Layout (2026-11-03): list-style rows, day selector tabs, default view
shows only the newest day."""
import json, os, sys, glob

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SRC, "out")
KEEP_DAYS = 7

def load_days():
    days = []
    for path in glob.glob(os.path.join(SRC, "days", "*.json")):
        with open(path, encoding="utf-8") as f:
            days.append(json.load(f))
    days.sort(key=lambda d: d["date"], reverse=True)
    return days[:KEEP_DAYS]

TEMPLATE = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>选品早报</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--text:#1c2330;--muted:#66707f;--line:#e3e7ee;--accent:#0b62d6;--hot:#d64541;--chip:#eef2f8}
@media (prefers-color-scheme:dark){:root{--bg:#12151b;--card:#1b202a;--text:#e8ecf3;--muted:#9aa5b5;--line:#2a3140;--accent:#5ea0ff;--hot:#ff7a72;--chip:#242c3a}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,"PingFang SC","Microsoft YaHei",Segoe UI,Roboto,sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:20px 14px 60px}
h1{font-size:24px;margin:6px 0 2px}
.sub{color:var(--muted);font-size:13px;line-height:1.6}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 14px;font-size:13px}
.stat b{font-size:17px;margin-right:4px}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 2px}
.tabs button{background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:13.5px;cursor:pointer}
.tabs button.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.controls{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 4px;position:sticky;top:0;background:var(--bg);padding:10px 0;z-index:5}
.controls input,.controls select{background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:14px}
.controls input{flex:1;min-width:160px}
.controls label{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:5px}
.day{margin-top:22px}
.dayhead{border-bottom:2px solid var(--line);padding-bottom:8px;margin-bottom:6px}
.dayhead h2{font-size:19px;margin:0 0 4px}
.dayhead .meta{color:var(--muted);font-size:13px}
.daynote{color:var(--muted);font-size:13px;margin:6px 0 0}
.grp{font-size:14px;color:var(--muted);margin:16px 0 2px;font-weight:600}
.list{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.rowitem{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:11px 14px;display:flex;gap:14px;justify-content:space-between;align-items:flex-start}
.rowitem .main{flex:1;min-width:0}
.rowitem .brand{font-weight:700;font-size:15px}
.rowitem .brand .part{font-weight:600}
.badge{display:inline-block;background:var(--hot);color:#fff;border-radius:6px;font-size:11px;padding:1px 6px;margin-left:6px;vertical-align:2px}
.title{color:var(--muted);font-size:12px;line-height:1.5;margin-top:2px}
.fit{font-size:12px;color:var(--muted);margin-top:3px}
.note{font-size:12px;color:var(--muted);line-height:1.5;margin-top:3px}
.side{text-align:right;flex-shrink:0}
.price{font-size:16px;font-weight:700;white-space:nowrap}
.sold{font-weight:700;font-size:13px;margin-top:2px}
.meta2{font-size:12px;color:var(--muted);margin-top:3px;line-height:1.6}
.side a{display:inline-block;margin-top:6px;color:var(--accent);text-decoration:none;font-size:12.5px;border:1px solid var(--line);border-radius:8px;padding:4px 9px;background:var(--chip)}
.empty{color:var(--muted);padding:24px 0;font-size:14px}
footer{color:var(--muted);font-size:12px;margin-top:40px;line-height:1.7}
</style>
</head>
<body>
<div class="wrap">
<h1>选品早报</h1>
<div class="sub">范围：eBay US 配件选品。口径：配件 ≥$50（缝纫机配件 ≥$100）；候选须在刊登页显示 sold 10–200（50–100 最佳）；每天至少 10 条；排除汽车/摩托车配件、家用大家电整类、电池/电源、轮胎/内胎、液体、重复耗材、空调、车库门及三星/惠而浦/美的/GE 品牌，房车/商用制冷除外。点日期切换看前几天的，默认只显示最新一天；本页保留最近 7 天。</div>
<div class="stats" id="stats"></div>
<div class="tabs" id="tabs"></div>
<div class="controls">
<input id="q" type="search" placeholder="搜索品牌、零件、零件号、标题…">
<select id="brand"><option value="">全部品牌</option></select>
<select id="sort">
<option value="orig">默认排序（销量带优先）</option>
<option value="soldDesc">销量 高 → 低</option>
<option value="soldAsc">销量 低 → 高</option>
<option value="priceDesc">价格 高 → 低</option>
<option value="priceAsc">价格 低 → 高</option>
</select>
<label><input type="checkbox" id="hotOnly"> 仅看热销（sold ≥ 100）</label>
</div>
<div id="days"></div>
<footer>数据来源：eBay US 刊登页逐条实测（价格、销量、库存、卖家地）。本页每日更新，历史记录见仓库 records/ 目录。</footer>
</div>
<script>
const DAYS = __DATA__;
const priceNum = s => { const m = String(s).replace(/,/g,"").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
const allBrands = [...new Set(DAYS.flatMap(d => d.items.map(i => i.b)))].sort();
const brandSel = document.getElementById('brand');
allBrands.forEach(b => { const o = document.createElement('option'); o.value = b; o.textContent = b; brandSel.appendChild(o); });
const totalItems = DAYS.reduce((n,d) => n + d.items.length, 0);
document.getElementById('stats').innerHTML =
  `<div class="stat"><b>${totalItems}</b>条候选</div>` +
  `<div class="stat"><b>${allBrands.length}</b>个品牌</div>` +
  `<div class="stat"><b>${DAYS.length}</b>期</div>` +
  (DAYS.length ? `<div class="stat">最新一期 <b>${DAYS[0].date}</b></div>` : '');
let selDay = DAYS.length ? DAYS[0].date : '';
const tabsEl = document.getElementById('tabs');
function renderTabs(){
  tabsEl.innerHTML = '';
  DAYS.forEach(d => {
    const b = document.createElement('button');
    b.textContent = d.date + '（' + d.items.length + '）';
    if (selDay === d.date) b.className = 'on';
    b.onclick = () => { selDay = d.date; renderTabs(); render(); };
    tabsEl.appendChild(b);
  });
  const all = document.createElement('button');
  all.textContent = '全部';
  if (selDay === '__ALL__') all.className = 'on';
  all.onclick = () => { selDay = '__ALL__'; renderTabs(); render(); };
  tabsEl.appendChild(all);
}
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function rowHtml(i){
  const hot = i.sold >= 100 ? '<span class="badge">热销</span>' : '';
  return `<div class="rowitem">
    <div class="main">
      <div class="brand">${esc(i.b)} <span class="part">${esc(i.p)}</span>${hot}</div>
      <div class="title">${esc(i.t)}</div>
      ${i.fit ? `<div class="fit">适配/零件号：${esc(i.fit)}</div>` : ''}
      ${i.note ? `<div class="note">${esc(i.note)}</div>` : ''}
    </div>
    <div class="side">
      <div class="price">${esc(i.price)}</div>
      <div class="sold">${i.sold} sold</div>
      <div class="meta2">${esc(i.cond)} · ${esc(i.avail)}<br>${esc(i.loc)}</div>
      <a href="https://www.ebay.com/itm/${i.id}" target="_blank" rel="noopener">eBay 刊登</a>
    </div>
  </div>`;
}
function render(){
  const q = document.getElementById('q').value.trim().toLowerCase();
  const bf = brandSel.value;
  const sort = document.getElementById('sort').value;
  const hotOnly = document.getElementById('hotOnly').checked;
  const root = document.getElementById('days');
  root.innerHTML = '';
  let any = false;
  DAYS.forEach(d => {
    if (selDay !== '__ALL__' && d.date !== selDay) return;
    let items = d.items.filter(i => {
      if (bf && i.b !== bf) return false;
      if (hotOnly && i.sold < 100) return false;
      if (q) {
        const hay = (i.b + ' ' + i.p + ' ' + i.t + ' ' + (i.fit||'') + ' ' + (i.note||'') + ' ' + i.id).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === 'soldDesc') items = [...items].sort((a,b) => b.sold - a.sold);
    if (sort === 'soldAsc') items = [...items].sort((a,b) => a.sold - b.sold);
    if (sort === 'priceDesc') items = [...items].sort((a,b) => priceNum(b.price) - priceNum(a.price));
    if (sort === 'priceAsc') items = [...items].sort((a,b) => priceNum(a.price) - priceNum(b.price));
    if (!items.length) return;
    any = true;
    const brands = new Set(d.items.map(i => i.b)).size;
    const sec = document.createElement('div'); sec.className = 'day';
    let h = `<div class="dayhead"><h2>${d.date}</h2><div class="meta">本期 ${d.items.length} 条 · ${brands} 个品牌</div>`;
    if (d.note) h += `<div class="daynote">${esc(d.note)}</div>`;
    h += `</div>`;
    const groups = [];
    items.forEach(i => { const g = i.grp || ''; if (!groups.includes(g)) groups.push(g); });
    groups.forEach(g => {
      if (g) h += `<div class="grp">${esc(g)}</div>`;
      h += `<div class="list">` + items.filter(i => (i.grp || '') === g).map(rowHtml).join('') + `</div>`;
    });
    sec.innerHTML = h;
    root.appendChild(sec);
  });
  if (!any) root.innerHTML = '<div class="empty">没有符合当前筛选的条目。</div>';
}
['q','brand','sort','hotOnly'].forEach(id => {
  document.getElementById(id).addEventListener('input', render);
  document.getElementById(id).addEventListener('change', render);
});
renderTabs();
render();
</script>
</body>
</html>
"""

def main():
    days = load_days()
    os.makedirs(OUT, exist_ok=True)
    rec_dir = os.path.join(OUT, "records")
    os.makedirs(rec_dir, exist_ok=True)
    data_json = json.dumps(days, ensure_ascii=False)
    page = TEMPLATE.replace("__DATA__", data_json.replace("</", "<\\/"))
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
        f.write(page)
    with open(os.path.join(OUT, "data.json"), "w", encoding="utf-8") as f:
        json.dump(days, f, ensure_ascii=False, indent=1)
    for d in days:
        lines = [f"# 选品早报 {d['date']}", ""]
        if d.get("note"):
            lines += [d["note"], ""]
        lines.append(f"本期 {len(d['items'])} 条（eBay US 刊登页实测，sold 10–200）。")
        lines.append("")
        cur = None
        for i in d["items"]:
            if i.get("grp") != cur:
                cur = i.get("grp")
                if cur:
                    lines += [f"## {cur}", ""]
            lines.append(f"- **{i['b']} {i['p']}** — {i['price']}，{i['cond']}，{i['sold']} sold，{i['avail']}，{i['loc']}")
            lines.append(f"  - {i['t']}")
            if i.get("fit"):
                lines.append(f"  - 适配/零件号：{i['fit']}")
            if i.get("note"):
                lines.append(f"  - 备注：{i['note']}")
            lines.append(f"  - https://www.ebay.com/itm/{i['id']}")
        with open(os.path.join(rec_dir, d["date"] + ".md"), "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    total = sum(len(d["items"]) for d in days)
    print(f"built: {len(days)} days, {total} items -> {OUT}")

if __name__ == "__main__":
    main()
