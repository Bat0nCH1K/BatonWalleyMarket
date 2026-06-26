// Wasteland Market Terminal — market.js v15 (график по времени + пунктир прогноза)
let currentScreen = 'items';
let marketTab = 'overview';

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('open');
}

function switchScreen(screen) {
    currentScreen = screen;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + screen);
    if (target) target.classList.add('active');
    if (screen === 'items') renderItems();
    if (screen === 'trades') renderTrades();
    if (screen === 'events') { if (typeof initCalendar === 'function') initCalendar(); if (typeof renderEvents === 'function') renderEvents(); }
    if (screen === 'storage') renderStorage();
    if (screen === 'goals') { if (typeof renderGoals === 'function') renderGoals(); }
    if (screen === 'market') renderMarket();
    if (screen === 'advisor') { if (typeof renderAdvisor === 'function') renderAdvisor(); }
}

function switchMarketTab(tab) {
    marketTab = tab;
    document.querySelectorAll('.market-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderMarket();
}

function addItemForm() {
    const name = document.getElementById('newItemName').value.trim();
    const type = document.getElementById('newItemType').value;
    const lotSize = parseInt(document.getElementById('newLotSize').value || '1') || 1;
    if (!name) return;
    addItem(name, type, lotSize);
    document.getElementById('newItemName').value = '';
    renderItems();
}

function selectItem(name) {
    selectedItem = name;
    const item = items.find(i => i.name === name);
    if (!item) return;
    const isPart = item.type === 'part';
    const now = new Date(); now.setHours(now.getHours() + 3);
    const timeStr = now.toISOString().slice(0, 16);
    const activeEvent = getActiveEvent();
    const eventOptions = [
        '<option value="">Без события</option>',
        '<option value="factory">🏭 Фабрика</option>',
        '<option value="rating_end">⚔️ Рейтинг</option>',
        '<option value="battlepass">🎫 БП</option>',
        '<option value="road">🛣️ Наследие</option>',
        '<option value="raven">🐦‍⬛ Ворон</option>',
        '<option value="workshop">🔧 Цех</option>',
        '<option value="bounty">🎯 Охота</option>'
    ];
    if (activeEvent) eventOptions.forEach((opt, i) => { if (opt.includes('value="' + activeEvent.type + '"')) eventOptions[i] = opt.replace('">', '" selected>'); });

    document.getElementById('screen-item-detail').classList.add('active');
    document.getElementById('screen-items').classList.remove('active');
    document.getElementById('detailTitle').textContent = (item.type==='resource'?'⛏️':'🔧') + ' ' + name + ' (лот: ' + item.lotSize + ' шт)';
    
    document.getElementById('detailContent').innerHTML = `
        <div class="price-panel">
            <input type="datetime-local" id="entryTime" value="${timeStr}">
            <div class="row">
                <input type="number" id="entryBuy" placeholder="Цена покупки (за лот)" step="0.01">
                <input type="number" id="entrySell" placeholder="Цена продажи (за лот)" step="0.01">
            </div>
            ${isPart ? `<div style="display:flex;gap:12px;font-size:0.8em;margin-bottom:6px;"><label><input type="checkbox" id="entryNerf"> 🔻 Нерф</label><label><input type="checkbox" id="entryBuff"> 🔺 Бафф</label></div>` : ''}
            <select id="entryEvent">${eventOptions.join('')}</select>
            ${activeEvent ? `<div style="font-size:0.7em;color:var(--accent);margin-top:4px;">📅 Сейчас: ${activeEvent.type}</div>` : ''}
            <div class="row" style="margin-top:8px;"><button class="accent" onclick="submitPriceEntry()">ЗАПИСАТЬ</button><button class="danger" onclick="deleteSelectedItem();switchScreen('items');">УДАЛИТЬ</button></div>
            <div id="itemGraph"></div>
        </div>`;
    renderItemGraph();
}

function submitPriceEntry() {
    const now = new Date(); now.setHours(now.getHours() + 3);
    const time = document.getElementById('entryTime').value || now.toISOString().slice(0, 16);
    const buy = parseFloat(document.getElementById('entryBuy').value);
    const sell = parseFloat(document.getElementById('entrySell').value);
    const event = document.getElementById('entryEvent').value;
    const nerf = document.getElementById('entryNerf')?.checked || false;
    const buff = document.getElementById('entryBuff')?.checked || false;
    if (isNaN(buy) || isNaN(sell)) { alert('Введи цены'); return; }
    addPriceEntry(time, buy, sell, event, nerf, buff);
    renderItems(); selectItem(selectedItem);
}

function renderItems() {
    const list = document.getElementById('itemsList');
    if (!list) return;
    if (items.length === 0) { list.innerHTML = '<p style="color:#888;">Нет предметов</p>'; return; }
    
    const searchEl = document.getElementById('itemSearch');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    let filtered = items;
    if (search) filtered = items.filter(i => i.name.toLowerCase().includes(search));
    
    let html = '<div class="row"><input type="text" id="itemSearch" placeholder="🔍 Фильтр..." oninput="renderItems()"></div>';
    html += filtered.map(item => {
        const data = prices[item.name] || [];
        const last = data[data.length - 1];
        const lastBuy = last ? (last.buy / item.lotSize).toFixed(2) : '—';
        return `<div class="item-card" onclick="selectItem('${item.name}')"><div class="name">${item.type==='resource'?'⛏️':'🔧'} ${item.name} (×${item.lotSize})</div><div class="stats">${data.length} зап. | ${lastBuy} ₽/шт</div></div>`;
    }).join('');
    list.innerHTML = html || '<p style="color:#888;">Ничего не найдено</p>';
    updateTradeSelect(); updateStorageSelect();
}

function renderItemGraph() {
    if (!selectedItem) return;
    const data = prices[selectedItem] || [];
    const item = items.find(i => i.name === selectedItem);
    const lotSize = item ? item.lotSize : 1;
    const container = document.getElementById('itemGraph');
    if (data.length < 2) { container.innerHTML = '<p style="color:#888;">📊 Нужно 2+ записи</p>'; return; }
    
    const pred = getPrediction(selectedItem);
    const buys = data.map(p => p.buy / lotSize);
    const allVals = [...buys];
    const itemTrades = trades.filter(t => t.item === selectedItem);
    itemTrades.forEach(t => { allVals.push(t.buyPrice / lotSize); allVals.push(t.sellPrice / lotSize); });
    
    // Временные метки
    const firstTime = new Date(data[0].time).getTime();
    const lastTime = new Date(data[data.length-1].time).getTime();
    const timeRange = lastTime - firstTime || 3600000; // минимум 1 час
    const timeRangeHours = timeRange / 3600000;
    
    // Добавляем точку прогноза через 24 часа
    const forecastTime = lastTime + 86400000; // +24 часа
    const forecastHoursFromStart = (forecastTime - firstTime) / 3600000;
    const lastBuyVal = buys[buys.length - 1];
    const forecastVal = lastBuyVal + pred.slope * 24; // slope * 24 часа
    
    const allForecast = [...allVals, forecastVal];
    const maxVal = Math.max(...allForecast) * 1.05;
    const minVal = Math.min(...allForecast) * 0.95;
    const range = maxVal - minVal || 1;
    
    const totalTimeRange = Math.max(timeRangeHours, 24) + 24; // от первой записи до прогноза + запас
    const W = 320, H = 150, padL = 45, padR = 20, padT = 15, padB = 25;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    
    // Сетка
    let grid = '';
    for (let i = 0; i <= 4; i++) {
        const y = padT + plotH * i / 4;
        grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#1a2a2a" stroke-width="0.5"/>`;
        grid += `<text x="${padL - 5}" y="${y + 3}" fill="#555" font-size="8" text-anchor="end">${(maxVal - range * i / 4).toFixed(1)}</text>`;
    }
    
    // Функция X по времени
    function timeToX(t) {
        const hoursFromStart = (t - firstTime) / 3600000;
        return padL + (hoursFromStart / totalTimeRange) * plotW;
    }
    function valToY(v) {
        return padT + plotH - ((v - minVal) / range) * plotH;
    }
    
    // Точки данных и линия
    let dots = '';
    let linePts = '';
    data.forEach((p, i) => {
        const t = new Date(p.time).getTime();
        const x = timeToX(t);
        const by = valToY(p.buy / lotSize);
        const sy = valToY(p.sell / lotSize);
        linePts += `${x},${by} `;
        dots += `<circle cx="${x}" cy="${by}" r="3" fill="#d4a574" style="cursor:pointer;" onclick="alert('${p.time.slice(0,16)}\nПокупка: ${(p.buy/lotSize).toFixed(2)}/шт\nПродажа: ${(p.sell/lotSize).toFixed(2)}/шт')"/>`;
        dots += `<circle cx="${x}" cy="${sy}" r="2.5" fill="#6aaa6a" opacity="0.7"/>`;
    });
    
    // Маркеры сделок
    itemTrades.forEach(t => {
        const tradeTime = new Date(t.buyDate).getTime();
        if (tradeTime >= firstTime && tradeTime <= forecastTime) {
            const x = timeToX(tradeTime);
            const by = valToY(t.buyPrice / lotSize);
            const sy = valToY(t.sellPrice / lotSize);
            dots += `<line x1="${x}" y1="${by}" x2="${x}" y2="${sy}" stroke="#4fc3f7" stroke-width="2" stroke-dasharray="3,3"/>`;
            dots += `<circle cx="${x}" cy="${by}" r="4" fill="#4fc3f7" stroke="#0a0f0f" stroke-width="1.5"/>`;
            dots += `<circle cx="${x}" cy="${sy}" r="4" fill="#ff9800" stroke="#0a0f0f" stroke-width="1.5"/>`;
        }
    });
    
    // Пунктир прогноза
    const lastX = timeToX(lastTime);
    const lastY = valToY(lastBuyVal);
    const forecastX = timeToX(forecastTime);
    const forecastY = valToY(forecastVal);
    const forecastColor = pred.slope < -0.05 ? '#6aaa6a' : pred.slope > 0.05 ? '#c06060' : '#888';
    
    let forecastLine = '';
    forecastLine += `<line x1="${lastX}" y1="${lastY}" x2="${forecastX}" y2="${forecastY}" stroke="${forecastColor}" stroke-width="2" stroke-dasharray="6,4" opacity="0.8"/>`;
    forecastLine += `<circle cx="${forecastX}" cy="${forecastY}" r="5" fill="none" stroke="${forecastColor}" stroke-width="2" stroke-dasharray="3,3"/>`;
    
    // Метка времени
    const timeLabelStep = totalTimeRange > 72 ? 24 : totalTimeRange > 24 ? 12 : 6;
    let timeLabels = '';
    for (let h = 0; h <= totalTimeRange; h += timeLabelStep) {
        const x = padL + (h / totalTimeRange) * plotW;
        if (x <= W - padR) {
            timeLabels += `<text x="${x}" y="${H - 5}" fill="#555" font-size="7" text-anchor="middle">${h}ч</text>`;
        }
    }
    
    container.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;background:#0a0f0f;border-radius:6px;border:1px solid var(--border);margin-top:8px;">
            ${grid}
            ${timeLabels}
            <polyline points="${linePts}" fill="none" stroke="#d4a574" stroke-width="1.5" opacity="0.6"/>
            ${forecastLine}
            ${dots}
        </svg>
        <div style="display:flex;gap:10px;font-size:0.6em;color:#888;margin-top:4px;flex-wrap:wrap;">
            <span>🟠 Покупка</span><span>🟢 Продажа</span><span>🔵 Сделка</span><span style="color:${forecastColor}">--- Прогноз</span>
        </div>
        <div style="font-size:0.6em;color:#666;margin-top:2px;">Шкала времени: 0 = первая запись, каждая метка = ${timeLabelStep}ч</div>
        <div class="status-badge ${pred.class}">${pred.text}</div>
        <div class="stat-row">
            <div class="stat-box"><div class="val">${pred.avgBuy.toFixed(2)}</div><div class="lbl">Средняя/шт</div></div>
            <div class="stat-box"><div class="val">${(pred.confidence*100).toFixed(0)}%</div><div class="lbl">Уверенность</div></div>
        </div>`;
}

// === СКЛАД (без потенциала, чистая оценка) ===
function updateStorageSelect() {
    const s = document.getElementById('storageItemSelect');
    if (s) s.innerHTML = items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
}

function addToStorageUI() {
    const select = document.getElementById('storageItemSelect');
    const qtyEl = document.getElementById('storageQty');
    const modEl = document.getElementById('storageModded');
    if (!select || !qtyEl || !modEl) return;
    const item = select.value;
    const qty = parseInt(qtyEl.value) || 1;
    const modded = modEl.checked;
    if (!item) { alert('Выбери предмет'); return; }
    const data = prices[item] || [];
    const itemObj = items.find(i => i.name === item);
    const ls = itemObj ? itemObj.lotSize : 1;
    const lastPrice = data.length > 0 ? Number(data[data.length - 1].buy) : 0;
    const buyPrice = lastPrice / ls;
    storageItems.push({ item, qty, buyPrice, modded, date: new Date().toISOString() });
    saveAll();
    qtyEl.value = '1'; modEl.checked = false;
    renderStorage();
}

function renderStorage() {
    const list = document.getElementById('storageList'), totalEl = document.getElementById('storageTotal');
    if (!list) return;
    if (storageItems.length === 0) { list.innerHTML = '<p style="color:#888;">Склад пуст</p>'; if (totalEl) totalEl.innerHTML = ''; return; }
    let tv = 0;
    list.innerHTML = storageItems.map((s, i) => {
        const data = prices[s.item] || [];
        const item = items.find(it => it.name === s.item);
        const ls = item ? item.lotSize : 1;
        const pricePerUnit = data.length > 0 ? data[data.length - 1].sell / ls : 0;
        const val = pricePerUnit * s.qty;
        tv += val;
        return `<div class="item-card"><div class="name">${s.item} ×${s.qty}</div><div class="stats">Оценка: ${val.toFixed(0)} голды</div><button class="delete-btn" onclick="storageItems.splice(${i},1);saveAll();renderStorage();">✕</button></div>`;
    }).join('');
    const total = balance + tv;
    if (totalEl) totalEl.innerHTML = `
        <div class="stat-row" style="margin-top:10px;">
            <div class="stat-box"><div class="val">${balance.toFixed(0)}</div><div class="lbl">💰 Баланс</div></div>
            <div class="stat-box"><div class="val">${tv.toFixed(0)}</div><div class="lbl">📦 Склад</div></div>
            <div class="stat-box"><div class="val" style="color:var(--accent)">${total.toFixed(0)}</div><div class="lbl">🏦 Общее</div></div>
        </div>`;
}

// === СДЕЛКИ ===
function updateTradeSelect() { const s = document.getElementById('tradeItemSelect'); if (s) s.innerHTML = items.map(i => `<option value="${i.name}">${i.name}</option>`).join(''); }
function submitTrade() {
    const item = document.getElementById('tradeItemSelect').value;
    const buy = parseFloat(document.getElementById('tradeBuyPrice').value);
    const sell = parseFloat(document.getElementById('tradeSellPrice').value);
    if (!item || isNaN(buy) || isNaN(sell)) { alert('Заполни'); return; }
    const now = new Date(); now.setHours(now.getHours() + 3);
    const timeStr = now.toISOString();
    addTrade(item, buy, sell);
    if (trades.length > 0) { trades[trades.length-1].buyDate = timeStr; trades[trades.length-1].sellDate = timeStr; saveAll(); }
    document.getElementById('tradeBuyPrice').value = ''; document.getElementById('tradeSellPrice').value = '';
    renderTrades(); renderStorage();
}
function renderTrades() {
    const tbody = document.querySelector('#tradesTable tbody');
    if (!tbody) return;
    tbody.innerHTML = trades.map((t, i) => `<tr><td>${t.item}</td><td>${t.buyPrice.toFixed(0)}</td><td>${t.sellPrice.toFixed(0)}</td><td style="color:${t.profit>=0?'var(--profit)':'var(--loss)'}">${t.profit.toFixed(0)}</td><td style="color:${t.profit>=0?'var(--profit)':'var(--loss)'}">${t.profitPct.toFixed(1)}%</td><td>${new Date(t.buyDate).toLocaleString('ru-RU',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td><td><button class="delete-btn" onclick="trades.splice(${i},1);saveAll();renderTrades();">✕</button></td></tr>`).join('');
    const tp = trades.reduce((a,b)=>a+b.profit,0);
    document.getElementById('tradeStats').innerHTML = `<div class="stat-row"><div class="stat-box"><div class="val" style="color:${tp>=0?'var(--profit)':'var(--loss)'}">${tp.toFixed(0)}</div><div class="lbl">Прибыль</div></div><div class="stat-box"><div class="val">${trades.length}</div><div class="lbl">Сделок</div></div></div>`;
}

// === ОБЗОР ===
function renderMarket() {
    const container = document.getElementById('marketContent');
    if (!container) return;
    
    let filtered = items;
    if (marketTab === 'resources') filtered = items.filter(i => i.type === 'resource');
    if (marketTab === 'parts') filtered = items.filter(i => i.type === 'part');
    
    if (filtered.length === 0) { container.innerHTML = '<p style="color:#888;">Нет предметов</p>'; return; }
    
    let totalAvgBuy = 0, count = 0, trendingUp = 0, trendingDown = 0, stable = 0;
    filtered.forEach(item => {
        const data = prices[item.name] || [];
        if (data.length >= 2) {
            const pred = getPrediction(item.name);
            totalAvgBuy += pred.avgBuy;
            count++;
            if (pred.slope > 0.05) trendingUp++;
            else if (pred.slope < -0.05) trendingDown++;
            else stable++;
        }
    });
    const avgMarket = count > 0 ? totalAvgBuy / count : 0;
    
    let allBuys = [];
    filtered.forEach(item => {
        (prices[item.name] || []).forEach(p => allBuys.push(p.buy / (items.find(i=>i.name===item.name)?.lotSize||1)));
    });
    allBuys.sort((a,b) => a-b);
    const maxAll = allBuys.length > 0 ? allBuys[allBuys.length-1] : 0;
    const minAll = allBuys.length > 0 ? allBuys[0] : 0;
    const rangeAll = maxAll - minAll || 1;
    const W = 300, H = 80, pad = 10;
    let linePts = '';
    if (allBuys.length > 1) {
        allBuys.forEach((b, i) => {
            const x = pad + (i / (allBuys.length - 1)) * (W - pad * 2);
            const y = H - pad - ((b - minAll) / rangeAll) * (H - pad * 2);
            linePts += `${x},${y} `;
        });
    }
    
    let html = `
        <div class="stat-row">
            <div class="stat-box"><div class="val">${avgMarket.toFixed(2)}</div><div class="lbl">Средняя цена/шт</div></div>
            <div class="stat-box"><div class="val">${count}</div><div class="lbl">Предметов с данными</div></div>
            <div class="stat-box"><div class="val" style="color:var(--profit)">${trendingUp}</div><div class="lbl">📈 Растут</div></div>
            <div class="stat-box"><div class="val" style="color:var(--loss)">${trendingDown}</div><div class="lbl">📉 Падают</div></div>
        </div>`;
    
    if (linePts) {
        html += `<svg viewBox="0 0 ${W} ${H}" style="width:100%;background:#0a0f0f;border-radius:6px;border:1px solid var(--border);margin-top:8px;">
            <polyline points="${linePts}" fill="none" stroke="#d4a574" stroke-width="2"/>
        </svg>
        <div style="font-size:0.65em;color:#888;text-align:center;">Общий тренд рынка (все цены)</div>`;
    }
    
    html += '<h3 style="margin-top:12px;">📋 Детализация</h3>';
    html += '<div class="row"><input type="text" id="marketSearch" placeholder="🔍 Фильтр..." oninput="renderMarket()"></div>';
    const search = document.getElementById('marketSearch')?.value?.toLowerCase() || '';
    let detailFiltered = filtered;
    if (search) detailFiltered = filtered.filter(i => i.name.toLowerCase().includes(search));
    detailFiltered.sort((a,b) => { const pa = getPrediction(a.name), pb = getPrediction(b.name); return pb.slope - pa.slope; });
    
    detailFiltered.forEach(item => {
        const data = prices[item.name] || [];
        if (data.length < 2) return;
        const pred = getPrediction(item.name);
        html += `<div class="item-card" onclick="switchScreen('items');selectItem('${item.name}');"><div class="name">${item.type==='resource'?'⛏️':'🔧'} ${item.name}</div><div style="display:flex;gap:8px;margin-top:4px;"><span style="font-size:0.8em;">${pred.avgBuy.toFixed(2)} ₽/шт</spa
