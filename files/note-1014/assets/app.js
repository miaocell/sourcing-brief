/* 选品罗盘 · 本地版 —— 交互逻辑（原生 JS，无框架、无外链） */
(function () {
  'use strict';

  var POOLS = window.POOLS || {};
  var POOL_STATS = window.POOL_STATS || {};
  var DATA_DATE = window.DATA_DATE || '未更新';

  var POOL_ORDER = ['amz', 'walmart', 'japan', 'mexico', 'poland'];
  var POOL_LABEL = {
    amz: 'AMZ 美国站', walmart: '沃尔玛美国站', japan: 'AMZ 日本站',
    mexico: 'MC 墨西哥站', poland: 'AL 波兰站'
  };

  // 外网搜索入口（仅由用户点击时打开新标签，页面自身不加载任何外部资源）
  var SEARCH_URL = {
    amz: 'https://www.amazon.com/s?k=',
    walmart: 'https://www.walmart.com/search?q=',
    japan: 'https://www.amazon.co.jp/s?k=',
    mexico: 'https://listado.mercadolibre.com.mx/',
    poland: 'https://allegro.pl/listing?string='
  };

  // 价格门槛：整机 ≥300 USD（A 方案）/ 配件 ≥40 USD
  var TH_MACHINE = 300;
  var TH_PART = 40;
  // 各站工作汇率（JPY→USD、PLN→USD），与原项目换算口径一致
  var FX = { jpy: 148, pln: 4.0 };

  // ── 工具：取值（多键回退，杜绝混键导致空白列）──
  function pick(r, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = r[keys[i]];
      if (v != null && String(v).trim() !== '') return String(v);
    }
    return '';
  }

  // ── 中国品牌判定：品牌名字加浅红突出显示（WPS 式）──
  function isCnBrand(r) {
    var src = pick(r, ['品牌来源', 'brandSource', 'origin', 'source']);
    if (!src) return false;
    return /^中国/.test(src) || src.indexOf('中国品牌') >= 0 || src.indexOf('中国出口') >= 0;
  }

  // ── 价格解析：取区间上限 ──
  function priceHi(v) {
    if (v == null) return null;
    var m = String(v).replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
    if (!m || !m.length) return null;
    var hi = 0;
    for (var i = 0; i < m.length; i++) { var n = parseFloat(m[i]); if (n > hi) hi = n; }
    return hi;
  }

  function rowUsd(pool, r) {
    if (pool === 'amz') return priceHi(r.price);
    if (pool === 'walmart' || pool === 'mexico') return priceHi(r.usd);
    if (pool === 'japan') { var j = priceHi(r.jpy); return j == null ? null : j / FX.jpy; }
    if (pool === 'poland') { var p = priceHi(r.price); return p == null ? null : p / FX.pln; }
    return null;
  }

  function thresholdFor(pool, r) {
    if (pool === 'amz') return r.priceType === 'machine' ? TH_MACHINE : TH_PART;
    return TH_MACHINE;
  }

  // ── 加载期价格过滤（渲染前一次性执行，不合规行不进内存池）──
  var FILTER_LOG = [];
  (function applyPriceGate() {
    for (var i = 0; i < POOL_ORDER.length; i++) {
      var pool = POOL_ORDER[i];
      if (!POOLS[pool]) continue;
      POOLS[pool] = POOLS[pool].filter(function (r) {
        var v = rowUsd(pool, r);
        if (v == null) return true; // 无价格字段 → 豁免（历史数据，构建期已过原项目护栏）
        var th = thresholdFor(pool, r);
        if (v >= th) return true;
        FILTER_LOG.push({
          pool: pool,
          brand: pick(r, ['品牌中文名', 'brandCn', '品牌英文']) + ' / ' + pick(r, ['品牌英文名', 'brandEn']),
          model: pick(r, ['推荐型号或型号族', 'model']),
          price: pick(r, ['price', 'usd', 'jpy', 'mxn', 'rmb']) || '—',
          usd: Math.round(v),
          th: th
        });
        return false;
      });
    }
  })();

  // ── 过滤后重算品牌统计（顶栏、池标签、工具栏读数全部取此值）──
  function recomputeStats() {
    var stats = {}, total = 0;
    for (var i = 0; i < POOL_ORDER.length; i++) {
      var p = POOL_ORDER[i];
      var rows = POOLS[p] || [];
      var set = {};
      for (var j = 0; j < rows.length; j++) {
        var b = pick(rows[j], p === 'amz' ? ['品牌英文名', 'brandEn', '品牌英文'] : ['brandEn', '品牌英文名', '品牌英文']);
        if (b) set[b] = 1;
      }
      var n = Object.keys(set).length;
      stats[p] = { brandCount: n, rowCount: rows.length };
      total += n;
    }
    stats.total = total;
    POOL_STATS = stats;
    window.POOL_STATS = stats;
  }
  recomputeStats();

  // ── 各池展示列（keys 为多键回退数组）──
  var COLUMNS = {
    amz: [
      { keys: ['品类', 'category'], label: '品类', type: 'cat' },
      { keys: ['品牌中文名', 'brandCn', '品牌中文'], label: '品牌中文' },
      { keys: ['品牌英文名', 'brandEn', '品牌英文'], label: '品牌英文', type: 'brand' },
      { keys: ['推荐型号或型号族', 'model'], label: '推荐型号', type: 'model' },
      { keys: ['国内用户信号', 'domestic'], label: '国内信号' },
      { keys: ['拆机/替换升级件', 'parts'], label: '拆机/替换件' },
      { keys: ['品牌来源', 'source'], label: '品牌来源' },
      { keys: ['channel', '渠道来源'], label: '渠道来源', type: 'channel' },
      { keys: ['选品优先级', 'priority'], label: '优先级', type: 'priority' }
    ],
    walmart: [
      { keys: ['category', '品类'], label: '品类', type: 'cat' },
      { keys: ['brandCn', '品牌中文名'], label: '品牌中文' },
      { keys: ['brandEn', '品牌英文名'], label: '品牌英文', type: 'brand' },
      { keys: ['model', '推荐型号或型号族'], label: '型号', type: 'model' },
      { keys: ['usd'], label: 'USD 价格', type: 'price' },
      { keys: ['parts', '拆机/替换升级件'], label: '拆机件' },
      { keys: ['channel', '渠道来源'], label: '渠道来源', type: 'channel' },
      { keys: ['fit', '开发判断'], label: '开发判断' }
    ],
    japan: [
      { keys: ['category', '品类'], label: '品类', type: 'cat' },
      { keys: ['brandCn', '品牌中文名'], label: '品牌中文' },
      { keys: ['brandEn', '品牌英文名'], label: '品牌英文', type: 'brand' },
      { keys: ['model', '推荐型号或型号族'], label: '型号', type: 'model' },
      { keys: ['jpy'], label: 'JPY 价格', type: 'price' },
      { keys: ['parts', '拆机/替换升级件'], label: '拆机件' },
      { keys: ['channel', '渠道来源'], label: '渠道来源', type: 'channel' },
      { keys: ['fit', '开发判断'], label: '开发判断' }
    ],
    mexico: [
      { keys: ['category', '品类'], label: '品类', type: 'cat' },
      { keys: ['brandCn', '品牌中文名'], label: '品牌中文' },
      { keys: ['brandEn', '品牌英文名'], label: '品牌英文', type: 'brand' },
      { keys: ['model', '推荐型号或型号族'], label: '型号', type: 'model' },
      { keys: ['mxn'], label: 'MXN 价格', type: 'price' },
      { keys: ['parts', '拆机/替换升级件'], label: '拆机件' },
      { keys: ['channel', '渠道来源'], label: '渠道来源', type: 'channel' },
      { keys: ['fit', '开发判断'], label: '开发判断' }
    ],
    poland: [
      { keys: ['category', '品类'], label: '品类', type: 'cat' },
      { keys: ['brandCn', '品牌中文名'], label: '品牌中文' },
      { keys: ['brandEn', '品牌英文名'], label: '品牌英文', type: 'brand' },
      { keys: ['model', '推荐型号或型号族'], label: '型号', type: 'model' },
      { keys: ['price'], label: '价格', type: 'price' },
      { keys: ['parts', '拆机/替换升级件'], label: '拆机件' },
      { keys: ['channel', '渠道来源'], label: '渠道来源', type: 'channel' },
      { keys: ['fit', '开发判断'], label: '开发判断' }
    ]
  };

  var STATUSES = ['未处理', '想做', '已做', '不做'];

  // localStorage 前缀
  var STORE_PREFIX = 'sc-local::';
  var currentPool = 'amz';
  var filtered = [];

  // 状态/备注存储（file:// 下可能抛异常）
  var store = {
    safe: (function () {
      try { localStorage.setItem('__sc_test__', '1'); localStorage.removeItem('__sc_test__'); return true; }
      catch (e) { return false; }
    })(),
    get: function (k, d) { if (!this.safe) return d; try { var v = localStorage.getItem(STORE_PREFIX + k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { if (!this.safe) return; try { localStorage.setItem(STORE_PREFIX + k, v); } catch (e) {} }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function channelClass(c) {
    c = (c || '').trim();
    if (/1688/.test(c)) return 'ch-1688';
    if (/淘宝/.test(c)) return 'ch-taobao';
    if (/闲鱼/.test(c)) return 'ch-xianyu';
    if (/抖音/.test(c)) return 'ch-douyin';
    if (/ebay/i.test(c)) return 'ch-ebay';
    if (/本地/.test(c)) return 'ch-local';
    return 'ch-none';
  }

  function priorityClass(p) {
    p = (p || '').trim();
    return p === 'P1' ? 'p-p1' : p === 'P2' ? 'p-p2' : 'p-p3';
  }

  function rowId(r) {
    var b = pick(r, ['品牌英文名', '品牌英文', 'brandEn', '品牌中文名', 'brandCn']);
    var m = pick(r, ['推荐型号或型号族', 'model']);
    return b + '||' + m;
  }

  function rowStatus(r) {
    return store.get('status::' + currentPool + '::' + rowId(r), pick(r, ['初始状态', 'initStatus', '状态']) || '未处理');
  }

  // ── 外网搜索词：英文品牌名 + 英文型号（无英文名才降级中文名）──
  function cleanModelForSearch(m) {
    if (!m) return '';
    var s = String(m)
      .replace(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, ' ')   // 去中文与全角符号
      .replace(/[()\[\]{}]/g, ' ')                                   // 去括号
      .replace(/\+\s*\d+/g, ' ')                                     // 去 "+14" 之类数量噪声
      .replace(/(^|\s)[+\-–—]+(\s|$)/g, ' ')                         // 去独立加号/破折号
      .replace(/(^|\s)[A-Za-z](\s|$)/g, ' ')                         // 去独立单字母残留
      .replace(/\s+/g, ' ');
    var parts = s.split(/[\/,;|]/).map(function (p) { return p.trim(); })
      .filter(function (p) { return p.length >= 2 && /[A-Za-z]/.test(p); });
    if (!parts.length) return '';
    return parts.slice(0, 2).join(' ');
  }

  function searchTermFor(r) {
    var brandEn = pick(r, ['品牌英文名', 'brandEn', '品牌英文']);
    var brandCn = pick(r, ['品牌中文名', 'brandCn', '品牌中文']);
    var model = pick(r, ['推荐型号或型号族', 'model']);
    var cm = cleanModelForSearch(model);
    if (cm) return ((brandEn || brandCn) + ' ' + cm).trim();
    if (brandEn) return brandEn.trim();                   // 品牌有英文名 → 只用英文品牌，不带中文型号
    return ((brandCn || '') + (model ? ' ' + model : '')).trim();  // 仅中文品牌时才降级
  }

  // ── 渲染 ──
  function renderTabs() {
    var el = document.getElementById('poolTabs');
    el.innerHTML = '';
    POOL_ORDER.forEach(function (p) {
      var cnt = POOL_STATS[p] ? POOL_STATS[p].brandCount : (POOLS[p] || []).length;
      var b = document.createElement('button');
      b.className = 'pool-tab' + (p === currentPool ? ' active' : '');
      b.setAttribute('role', 'tab');
      b.innerHTML = esc(POOL_LABEL[p]) + ' <span class="cnt">' + cnt + '</span>';
      b.onclick = function () { setPool(p); };
      el.appendChild(b);
    });
  }

  function renderSummary() {
    var total = POOL_STATS.total || 0;
    var rows = 0;
    POOL_ORDER.forEach(function (p) { rows += (POOLS[p] || []).length; });
    document.getElementById('totalBrands').textContent = total;
    document.getElementById('totalRows').textContent = rows;
    document.getElementById('dataDate').textContent = DATA_DATE;

    var warn = store.safe ? '' : '<span class="warn">（file:// 下状态不持久，建议用「备份」导出）</span>';
    var dropped = FILTER_LOG.length;
    var s = '五个池子品牌数之和 <b>' + total + '</b> · 条目 <b>' + rows + '</b> 条' +
      ' · 门槛过滤剔除 <b>' + dropped + '</b> 条（整机&lt;$' + TH_MACHINE + ' / 配件&lt;$' + TH_PART + '）' + warn;
    document.getElementById('qualitySummary').innerHTML = s;
  }

  function setPool(p) {
    currentPool = p;
    renderTabs();
    renderFilters();
    apply();
  }

  function renderFilters() {
    var rows = POOLS[currentPool] || [];
    var cats = {}, prios = {};
    rows.forEach(function (r) {
      var c = pick(r, ['品类', 'category']);
      if (c) cats[c] = true;
      var pr = pick(r, ['选品优先级', 'priority']);
      if (pr) prios[pr] = true;
    });
    var catSel = document.getElementById('catFilter');
    catSel.innerHTML = '<option value="">全部品类</option>' +
      Object.keys(cats).sort().map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');

    var prSel = document.getElementById('priorityFilter');
    prSel.innerHTML = '<option value="">全部优先级</option>' +
      Object.keys(prios).sort().map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join('');

    var stSel = document.getElementById('statusFilter');
    stSel.innerHTML = '<option value="">全部状态</option>' +
      STATUSES.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');
  }

  function apply() {
    var q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
    var cat = document.getElementById('catFilter').value;
    var pr = document.getElementById('priorityFilter').value;
    var st = document.getElementById('statusFilter').value;

    var rows = POOLS[currentPool] || [];
    filtered = rows.filter(function (r) {
      if (cat && pick(r, ['品类', 'category']) !== cat) return false;
      if (pr && pick(r, ['选品优先级', 'priority']) !== pr) return false;
      if (st && rowStatus(r) !== st) return false;
      if (q) {
        var hay = [
          pick(r, ['品牌中文名', 'brandCn', '品牌中文']),
          pick(r, ['品牌英文名', 'brandEn', '品牌英文']),
          pick(r, ['推荐型号或型号族', 'model']),
          pick(r, ['品类', 'category']),
          pick(r, ['拆机/替换升级件', 'parts']),
          pick(r, ['channel', '渠道来源'])
        ].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    renderTable();
    var cnt = POOL_STATS[currentPool] ? POOL_STATS[currentPool].brandCount : rows.length;
    document.getElementById('poolBrandCount').textContent =
      POOL_LABEL[currentPool] + ' · ' + cnt + ' 品牌 · 显示 ' + filtered.length + '/' + rows.length + ' 条';
    document.getElementById('emptyState').hidden = filtered.length > 0;
  }

  function renderTable() {
    var cols = COLUMNS[currentPool] || COLUMNS.amz;
    var head = document.getElementById('gridHead');
    head.innerHTML = '<tr>' + cols.map(function (c) {
      return '<th>' + esc(c.label) + '</th>';
    }).join('') + '<th>状态</th>';

    var body = document.getElementById('gridBody');
    body.innerHTML = '';
    filtered.forEach(function (r) {
      var tr = document.createElement('tr');
      cols.forEach(function (c) {
        var td = document.createElement('td');
        var v = pick(r, c.keys);
        if (c.type === 'cat') { td.className = 'cell-cat'; td.textContent = v; }
        else if (c.type === 'brand' || c.label === '品牌中文') {
          if (c.type === 'brand') td.className = 'cell-brand';
          if (isCnBrand(r) && v) { td.innerHTML = '<span class="cn-hl">' + esc(v) + '</span>'; }
          else { td.textContent = v; }
        }
        else if (c.type === 'model') { td.className = 'cell-model'; td.textContent = v; }
        else if (c.type === 'price') { td.className = 'cell-price'; td.textContent = v; }
        else if (c.type === 'channel') {
          td.innerHTML = '<span class="cell-channel ' + channelClass(v) + '">' + esc(v || '未标注') + '</span>';
        }
        else if (c.type === 'priority') {
          td.innerHTML = v ? '<span class="pill ' + priorityClass(v) + '">' + esc(v) + '</span>' : '';
        }
        else { td.textContent = v; }
        tr.appendChild(td);
      });
      var stTd = document.createElement('td');
      var st = rowStatus(r);
      stTd.innerHTML = '<span class="status-tag"><span class="status-dot st-' + esc(st) + '"></span>' + esc(st) + '</span>';
      stTd.onclick = function (e) { e.stopPropagation(); cycleStatus(r); };
      tr.appendChild(stTd);

      tr.onclick = function () { openModal(r); };
      body.appendChild(tr);
    });
  }

  function cycleStatus(r) {
    var cur = rowStatus(r);
    var idx = STATUSES.indexOf(cur);
    var next = STATUSES[(idx + 1) % STATUSES.length];
    store.set('status::' + currentPool + '::' + rowId(r), next);
    apply();
  }

  function setStatus(r, s) {
    store.set('status::' + currentPool + '::' + rowId(r), s);
  }

  // ── 复制到剪贴板（file:// 下 clipboard API 不可用时回退 execCommand）──
  function copyText(text, btn) {
    function done() {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = '已复制';
      btn.classList.add('copied');
      setTimeout(function () { btn.textContent = old; btn.classList.remove('copied'); }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done)['catch'](function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch (e) { alert('复制失败，请手动选择文本复制。'); }
    }
  }

  function openModal(r) {
    var id = rowId(r);
    var st = rowStatus(r);
    var note = store.get('note::' + currentPool + '::' + id, '');

    var brandEn = pick(r, ['品牌英文名', 'brandEn', '品牌英文']);
    var brandCn = pick(r, ['品牌中文名', 'brandCn', '品牌中文']);
    var model = pick(r, ['推荐型号或型号族', 'model']);
    var cat = pick(r, ['品类', 'category']);

    // hero：英文品牌名做视觉焦点；无英文名时降级中文名
    var heroEn = brandEn || brandCn;
    var heroCn = brandEn ? brandCn : '';

    var term = searchTermFor(r);
    var url = (SEARCH_URL[currentPool] || SEARCH_URL.amz) + encodeURIComponent(term);

    var html = '';
    html += '<div class="modal-hero">';
    html += '<div class="hero-en">' + (isCnBrand(r) && heroEn ? '<span class="cn-hl">' + esc(heroEn) + '</span>' : esc(heroEn || '（无品牌名）')) + '</div>';
    if (heroCn && heroCn !== heroEn) html += '<div class="hero-cn">' + (isCnBrand(r) ? '<span class="cn-hl">' + esc(heroCn) + '</span>' : esc(heroCn)) + '</div>';
    html += '</div>';
    html += '<div class="modal-sub">' + esc(cat) + ' · ' + esc(POOL_LABEL[currentPool]) + '</div>';

    // 外网搜索块
    if (term) {
      html += '<div class="searchbox">';
      html += '<div class="sb-label">外网搜索词（英文品牌 + 英文型号）</div>';
      html += '<div class="sb-row">';
      html += '<code class="sb-term" id="sbTerm">' + esc(term) + '</code>';
      html += '<button class="btn-copy" id="copyTerm" type="button">复制</button>';
      html += '<a class="btn-open" id="openSearch" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">打开搜索</a>';
      html += '</div></div>';
    }

    function block(label, value, cls) {
      if (value == null || value === '') return '';
      return '<div class="field-block"><div class="fb-label">' + esc(label) + '</div>' +
        '<div class="fb-value' + (cls ? ' ' + cls : '') + '">' + value + '</div></div>';
    }

    // 型号（大字深色）
    html += block('推荐型号 / 型号族', esc(model), 'model-strong');
    // 价格
    var price = pick(r, ['usd', 'price', 'jpy', 'mxn', 'rmb']);
    if (price) html += block('价格', esc(price), 'price');
    // 拆机/替换件
    html += block('拆机 / 替换件', esc(pick(r, ['拆机/替换升级件', 'parts'])));
    // 品牌来源 / 供应链
    html += block('品牌来源 / 供应链', esc(pick(r, ['品牌来源', 'source'])));
    var supply = pick(r, ['中国替换件可得性', 'supply']);
    if (supply) html += block('中国替换件可得性', esc(supply));
    // 开发判断
    html += block('开发判断', esc(pick(r, ['fit', '开发判断'])));
    // 国内信号
    var domestic = pick(r, ['国内用户信号', 'domestic']);
    if (domestic) html += block('国内信号', esc(domestic));
    // 四字段
    html += block('来源平台', esc(pick(r, ['srcPlatform', '来源平台'])));
    html += block('渠道来源', esc(pick(r, ['channel', '渠道来源'])));
    var srcUrl = pick(r, ['srcUrl', '来源链接']);
    if (srcUrl && srcUrl !== '未更新') {
      html += block('来源链接', '<a href="' + esc(srcUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(srcUrl) + '</a>');
    } else {
      html += block('来源链接', '未更新');
    }
    html += block('抓取日期', esc(pick(r, ['srcDate', '抓取日期']) || '未更新'));

    // 状态切换
    html += '<div class="modal-actions">' + STATUSES.map(function (s) {
      return '<button class="btn-status' + (st === s ? ' on' : '') + '" data-status="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('') + '</div>';

    // 备注
    html += '<div class="field-block" style="margin-top:16px"><div class="fb-label">备注</div>' +
      '<textarea id="noteArea" placeholder="记录备注…">' + esc(note) + '</textarea></div>';

    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modal').hidden = false;

    var copyBtn = document.getElementById('copyTerm');
    if (copyBtn) copyBtn.onclick = function () { copyText(term, copyBtn); };

    document.querySelectorAll('.btn-status').forEach(function (b) {
      b.onclick = function () {
        var s = b.getAttribute('data-status');
        setStatus(r, s);
        document.querySelectorAll('.btn-status').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-status') === s); });
        apply();
      };
    });
    document.getElementById('noteArea').onchange = function () {
      store.set('note::' + currentPool + '::' + id, this.value);
    };
  }

  // ── 备份 / 恢复 ──
  function backup() {
    var dump = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf(STORE_PREFIX) === 0) dump[k] = localStorage.getItem(k);
    }
    var blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '选品罗盘-备份-' + DATA_DATE + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function restore(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var dump = JSON.parse(fr.result);
        var n = 0;
        Object.keys(dump).forEach(function (k) {
          if (k.indexOf(STORE_PREFIX) === 0) { store.set(k.slice(STORE_PREFIX.length), dump[k]); n++; }
        });
        alert('已恢复 ' + n + ' 条状态/备注（只补空缺，不覆盖现有）。');
        apply();
      } catch (e) { alert('恢复失败：文件格式不正确。'); }
    };
    fr.readAsText(file);
  }

  // ── 初始化 ──
  function init() {
    renderTabs();
    renderSummary();
    setPool('amz');

    document.getElementById('searchInput').addEventListener('input', apply);
    document.getElementById('catFilter').addEventListener('change', apply);
    document.getElementById('priorityFilter').addEventListener('change', apply);
    document.getElementById('statusFilter').addEventListener('change', apply);

    document.getElementById('backupBtn').onclick = backup;
    document.getElementById('restoreBtn').onclick = function () { document.getElementById('restoreInput').click(); };
    document.getElementById('restoreInput').onchange = function () {
      if (this.files && this.files[0]) restore(this.files[0]);
      this.value = '';
    };

    document.getElementById('modalClose').onclick = function () { document.getElementById('modal').hidden = true; };
    document.getElementById('modal').onclick = function (e) { if (e.target === this) this.hidden = true; };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.getElementById('modal').hidden = true; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
