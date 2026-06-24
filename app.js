// Wasteland Market Terminal — app.js

// Хранилище
const STORAGE_ITEMS = 'wl_items_v2';
const STORAGE_PRICES = 'wl_prices_v2';
const STORAGE_TRADES = 'wl_trades_v2';
const STORAGE_EVENTS = 'wl_events_v2';
const STORAGE_PREDICTIONS = 'wl_predictions_v2';
const STORAGE_INSIGHTS = 'wl_insights_v2';

let items = JSON.parse(localStorage.getItem(STORAGE_ITEMS) || '[]');
let prices = JSON.parse(localStorage.getItem(STORAGE_PRICES) || '{}');
let trades = JSON.parse(localStorage.getItem(STORAGE_TRADES) || '[]');
let events = JSON.parse(localStorage.getItem(STORAGE_EVENTS) || '[]');
let predictions = JSON.parse(localStorage.getItem(STORAGE_PREDICTIONS) || '{}');
let insights = JSON.parse(localStorage.getItem(STORAGE_INSIGHTS) || '[]');

let selectedItem = null;
let currentTab = 'items';

function saveAll() {
    localStorage.setItem(STORAGE_ITEMS, JSON.stringify(items));
    localStorage.setItem(STORAGE_PRICES, JSON.stringify(prices));
    localStorage.setItem(STORAGE_TRADES, JSON.stringify(trades));
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(events));
    localStorage.setItem(STORAGE_PREDICTIONS, JSON.stringify(predictions));
    localStorage.setItem(STORAGE_INSIGHTS, JSON.stringify(insights));
}

// Вкладки
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    var tabIndex = { items: 0, trades: 1, analytics: 2, events: 3, insights: 4 }[tab];
    document.querySelectorAll('.tab')[tabIndex].classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'trades') renderTrades();
    if (tab === 'analytics') { updateAnalyticsSelect(); renderAnalytics(); }
    if (tab === 'events') renderEvents();
    if (tab === 'insights') renderInsights();
}

// Предметы
function addItem() {
    var name = document.getElementById('newItemName').value.trim();
    var type = document.getElementById('newItemType').value.trim();
    if (!name) return;
    if (items.find(function(i) { return i.name === name; })) { alert('Уже есть'); return; }
    items.push({ name: name, type: type });
    prices[name] = [];
    predictions[name] = [];
    saveAll();
    document.getElementById('newItemName').value = '';
    document.getElementById('newItemType').value = '';
    renderItems();
}

function selectItem(name) {
    selectedItem = name;
    document.getElementById('priceEntry').style.display = 'block';
    document.getElementById('selectedItemName').textContent = name;
    document.getElementById('entryTime').value = new Date().toISOString().slice(0, 16);
    renderItemAnalytics();
}

function deleteSelectedItem() {
    if (!selectedItem) return;
    if (confirm('Удалить "' + selectedItem + '" и все данные?')) {
        items = items.filter(function(i) { return i.name !== selectedItem; });
        delete prices[selectedItem];
        delete predictions[selectedItem];
        selectedItem = null;
        saveAll();
        document.getElementById('priceEntry').style.display = 'none';
        renderItems();
    }
}

function addPriceEntry() {
    if (!selectedItem) return;
    var time = document.getElementById('entryTime').value || new Date().toISOString().slice(0, 16);
    var buy = parseFloat(document.getElementById('entryBuy').value);
    var sell = parseFloat(document.getElementById('entrySell').value);
    var event = document.getElementById('entryEvent').value;
    if (isNaN(buy) || isNaN(sell)) { alert('Введи цены'); return; }
    if (!prices[selectedItem]) prices[selectedItem] = [];
    prices[selectedItem].push({ time: time, buy: buy, sell: sell, event: event });
    prices[selectedItem].sort(function(a, b) { return new Date(a.time) - new Date(b.time); });
    saveAll();
    document.getElementById('entryBuy').value = '';
    document.getElementById('entrySell').value = '';
    renderItemAnalytics();
    updatePredictions(selectedItem);
    renderItems();
}

function renderItems() {
    var list = document.getElementById('itemsList');
    if (items.length === 0) {
        list.innerHTML = '<p style="color:#888;text-align:center;">Нет предметов.</p>';
        return;
    }
    list.innerHTML = items.map(function(item) {
        var itemTrades = trades.filter(function(t) { return t.item === item.name; });
        var totalProfit = itemTrades.reduce(function(a, b) { return a + b.profit; }, 0);
        var profitColor = totalProfit >= 0 ? 'var(--profit)' : 'var(--loss)';
        return '<div class="item-list-item" onclick="selectItem(\'' + item.name + '\')">' +
            '<span>📦 ' + item.name + ' <span style="color:#888;font-size:0.7em;">' + (item.type || '') + '</span></span>' +
            '<span style="font-size:0.8em;">' +
            (prices[item.name] || []).length + ' зап. | ' +
            itemTrades.length + ' сделок | ' +
            '<span style="color:' + profitColor + '">' + (totalProfit >= 0 ? '+' : '') + totalProfit.toFixed(1) + '</span>' +
            '</span></div>';
    }).join('');
    updateTradeSelect();
    updateInsightSelect();
}

function renderItemAnalytics() {
    if (!selectedItem) return;
    var data = prices[selectedItem] || [];
    var container = document.getElementById('itemAnalytics');
    if (data.length < 2) {
        container.innerHTML = '<p style="color:#888;">Нужно минимум 2 записи.</p>';
        return;
    }
    var pred = getPrediction(selectedItem);
    var itemInsights = insights.filter(function(i) { return i.item === selectedItem; });
    container.innerHTML = '<div class="prediction ' + pred.class + '">' + pred.text + '</div>' +
        '<div style="font-size:0.8em;color:#888;margin-top:4px;">Точность: ' + getModelAccuracy(selectedItem) + '% | Уверенность: ' + (pred.confidence * 100).toFixed(0) + '%</div>' +
        (itemInsights.length > 0 ? '<div style="margin-top:8px;font-size:0.75em;color:var(--accent);">💡 Инсайтов: ' + itemInsights.length + '</div>' : '');
}

// Сделки
function updateTradeSelect() {
    var select = document.getElementById('tradeItemSelect');
    select.innerHTML = items.map(function(i) { return '<option value="' + i.name + '">' + i.name + '</option>'; }).join('');
}

function addTrade() {
    var item = document.getElementById('tradeItemSelect').value;
    var buyPrice = parseFloat(document.getElementById('tradeBuyPrice').value);
    var sellPrice = parseFloat(document.getElementById('tradeSellPrice').value);
    if (!item || isNaN(buyPrice) || isNaN(sellPrice)) { alert('Заполни все поля'); return; }
    var profit = sellPrice - buyPrice;
    var profitPct = (profit / buyPrice) * 100;
    var pred = getPrediction(item);
    trades.push({
        item: item, buyPrice: buyPrice, sellPrice: sellPrice,
        buyDate: new Date().toISOString(), sellDate: new Date().toISOString(),
        profit: profit, profitPct: profitPct, confidence: pred.confidence
    });
    if (!predictions[item]) predictions[item] = [];
    predictions[item].push({
        date: new Date().toISOString(),
        predicted: pred.signal,
        actual: profit > 0 ? 1 : 0,
        confidence: pred.confidence
    });
    saveAll();
    document.getElementById('tradeBuyPrice').value = '';
    document.getElementById('tradeSellPrice').value = '';
    renderTrades();
    renderItems();
}

function deleteTrade(index) {
    trades.splice(index, 1);
    saveAll();
    renderTrades();
}

function renderTrades() {
    var tbody = document.querySelector('#tradesTable tbody');
    tbody.innerHTML = trades.map(function(t, i) {
        return '<tr>' +
            '<td>📦 ' + t.item + '</td>' +
            '<td>' + t.buyPrice.toFixed(2) + '</td>' +
            '<td>' + t.sellPrice.toFixed(2) + '</td>' +
            '<td style="color:' + (t.profit >= 0 ? 'var(--profit)' : 'var(--loss)') + '">' + t.profit.toFixed(2) + '</td>' +
            '<td style="color:' + (t.profit >= 0 ? 'var(--profit)' : 'var(--loss)') + '">' + t.profitPct.toFixed(1) + '%</td>' +
            '<td>' + (t.confidence * 100).toFixed(0) + '%</td>' +
            '<td><button class="delete-btn" onclick="deleteTrade(' + i + ')">✕</button></td>' +
            '</tr>';
    }).join('');
    var totalProfit = trades.reduce(function(a, b) { return a + b.profit; }, 0);
    var winRate = trades.length > 0 ? (trades.filter(function(t) { return t.profit > 0; }).length / trades.length * 100) : 0;
    document.getElementById('tradeStats').innerHTML =
        '<div class="stats-grid">' +
        '<div class="stat-item"><div class="value" style="color:' + (totalProfit >= 0 ? 'var(--profit)' : 'var(--loss)') + '">' + totalProfit.toFixed(2) + '</div><div class="label">ОБЩАЯ ПРИБЫЛЬ</div></div>' +
        '<div class="stat-item"><div class="value">' + trades.length + '</div><div class="label">ВСЕГО СДЕЛОК</div></div>' +
        '<div class="stat-item"><div class="value">' + winRate.toFixed(0) + '%</div><div class="label">УСПЕШНЫХ</div></div>' +
        '<div class="stat-item"><div class="value">' + getGlobalAccuracy() + '%</div><div class="label">ТОЧНОСТЬ МОДЕЛИ</div></div>' +
        '</div>';
}

// Аналитика
function updateAnalyticsSelect() {
    var select = document.getElementById('analyticsItemSelect');
    select.innerHTML = items.map(function(i) { return '<option value="' + i.name + '">' + i.name + '</option>'; }).join('');
}

function renderAnalytics() {
    var item = document.getElementById('analyticsItemSelect').value;
    if (!item) { document.getElementById('analyticsContent').innerHTML = ''; return; }
    var data = prices[item] || [];
    if (data.length === 0) {
        document.getElementById('analyticsContent').innerHTML = '<p style="color:#888;">Нет данных.</p>';
        return;
    }
    var pred = getPrediction(item);
    var buys = data.map(function(p) { return p.buy; });
    var sells = data.map(function(p) { return p.sell; });
    var avgBuy = buys.reduce(function(a, b) { return a + b; }, 0) / buys.length;
    var avgSell = sells.reduce(function(a, b) { return a + b; }, 0) / sells.length;
    var maxPrice = Math.max.apply(null, buys.concat(sells));
    var minPrice = Math.min.apply(null, buys.concat(sells));
    var range = maxPrice - minPrice || 1;
    document.getElementById('analyticsContent').innerHTML =
        '<div class="graph-bar">' + data.map(function(p) {
            var buyH = ((p.buy - minPrice) / range) * 100;
            var sellH = ((p.sell - minPrice) / range) * 100;
            return '<div style="display:flex;flex-direction:column;flex:1;gap:1px;align-items:center;">' +
                '<div class="bar sell" style="height:' + sellH + '%;width:60%;"></div>' +
                '<div class="bar" style="height:' + buyH + '%;width:60%;"></div></div>';
        }).join('') + '</div>' +
        '<div class="stats-grid">' +
        '<div class="stat-item"><div class="value">' + avgBuy.toFixed(2) + '</div><div class="label">СР. ПОКУПКА</div></div>' +
        '<div class="stat-item"><div class="value">' + avgSell.toFixed(2) + '</div><div class="label">СР. ПРОДАЖА</div></div>' +
        '<div class="stat-item"><div class="value">' + minPrice.toFixed(2) + '</div><div class="label">МИН.</div></div>' +
        '<div class="stat-item"><div class="value">' + maxPrice.toFixed(2) + '</div><div class="label">МАКС.</div></div>' +
        '<div class="stat-item"><div class="value">' + ((avgSell - avgBuy) / avgBuy * 100).toFixed(1) + '%</div><div class="label">СПРЕД</div></div>' +
        '<div class="stat-item"><div class="value">' + getModelAccuracy(item) + '%</div><div class="label">ТОЧНОСТЬ</div></div>' +
        '</div>' +
        '<div class="prediction ' + pred.class + '">' + pred.text + '</div>' +
        '<div style="margin-top:8px;font-size:0.8em;">' +
        '<div>📈 Тренд: ' + (pred.trend > 0 ? '↗ Рост' : pred.trend < 0 ? '↘ Падение' : '→ Стабильно') + ' (' + pred.trend.toFixed(1) + '%)</div>' +
        '<div>📊 Волатильность: ' + pred.volatility.toFixed(2) + '</div>' +
        '<div>💡 Уверенность: ' + (pred.confidence * 100).toFixed(0) + '%</div></div>';
}

// Предсказание
function getPrediction(item) {
    var data = prices[item] || [];
    if (data.length < 3) return { signal: 0, confidence: 0, trend: 0, volatility: 0, text: '📊 НЕДОСТАТОЧНО ДАННЫХ', class: 'stable' };
    var buys = data.map(function(p) { return p.buy; });
    var sells = data.map(function(p) { return p.sell; });
    var avgBuy = buys.reduce(function(a, b) { return a + b; }, 0) / buys.length;
    var avgSell = sells.reduce(function(a, b) { return a + b; }, 0) / sells.length;
    var recent = data.slice(-5);
    var recentAvgBuy = recent.reduce(function(a, b) { return a + b.buy; }, 0) / recent.length;
    var trend = ((recentAvgBuy - avgBuy) / avgBuy) * 100;
    var variance = buys.map(function(b) { return (b - avgBuy) * (b - avgBuy); }).reduce(function(a, b) { return a + b; }, 0) / buys.length;
    var volatility = Math.sqrt(variance);
    var signal = 0, confidence = 0.5, text = '', cls = 'stable';
    if (trend > 3) { signal = 0; text = '📈 ЦЕНА РАСТЁТ — продавать или ждать'; cls = 'up'; }
    else if (trend < -3) { signal = 1; text = '📉 ЦЕНА ПАДАЕТ — хороший момент для покупки'; cls = 'down'; }
    else { signal = 0.5; text = '📊 ЦЕНА СТАБИЛЬНА — можно торговать в коридоре'; cls = 'stable'; }
    var lastBuy = buys[buys.length - 1];
    var lastSell = sells[buys.length - 1];
    if (lastBuy < avgBuy * 0.95) { text += '\n💡 ЦЕНА НИЖЕ СРЕДНЕГО — покупать!'; signal = 1; cls = 'down'; }
    if (lastSell > avgSell * 1.05) { text += '\n💰 ЦЕНА ВЫШЕ СРЕДНЕГО — продавать!'; signal = 0; cls = 'up'; }
    confidence = Math.min(0.9, 0.5 + Math.abs(trend) / 20 + (data.length > 10 ? 0.2 : 0));
    var accuracy = getModelAccuracy(item);
    if (accuracy < 40) confidence *= 0.5;
    return { signal: signal, confidence: confidence, trend: trend, volatility: volatility, text: text, class: cls };
}

function updatePredictions(item) {
    if (!item) return;
    var pred = getPrediction(item);
    if (!predictions[item]) predictions[item] = [];
    predictions[item].push({ date: new Date().toISOString(), predicted: pred.signal, confidence: pred.confidence });
    if (predictions[item].length > 50) predictions[item].shift();
    saveAll();
}

function getModelAccuracy(item) {
    var preds = predictions[item] || [];
    var withActual = preds.filter(function(p) { return p.actual !== undefined; });
    if (withActual.length === 0) return 50;
    var correct = withActual.filter(function(p) { return (p.predicted > 0.5 && p.actual === 1) || (p.predicted <= 0.5 && p.actual === 0); }).length;
    return Math.round((correct / withActual.length) * 100);
}

function getGlobalAccuracy() {
    var total = 0, correct = 0;
    items.forEach(function(item) {
        var preds = predictions[item.name] || [];
        var withActual = preds.filter(function(p) { return p.actual !== undefined; });
        total += withActual.length;
        correct += withActual.filter(function(p) { return (p.predicted > 0.5 && p.actual === 1) || (p.predicted <= 0.5 && p.actual === 0); }).length;
    });
    return total > 0 ? Math.round((correct / total) * 100) : 0;
}

// События
function addEvent() {
    var date = document.getElementById('eventDate').value;
    var type = document.getElementById('eventType').value;
    var desc = document.getElementById('eventDesc').value.trim();
    if (!date) return;
    events.push({ date: date, type: type, desc: desc });
    events.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    saveAll();
    renderEvents();
}

function deleteEvent(index) {
    events.splice(index, 1);
    saveAll();
    renderEvents();
}

function renderEvents() {
    var list = document.getElementById('eventsList');
    if (events.length === 0) {
        list.innerHTML = '<p style="color:#888;">Нет событий.</p>';
        return;
    }
    var emoji = { factory: '🏭', rating_end: '⚔️', battlepass: '🎫', road: '🛣️', raven: '🐦‍⬛', workshop: '🔧', bounty: '🎯', nerf: '🔻', buff: '🔺', new_item: '🆕', gift: '🎁', bearings: '⚙️' };
    var tagClass = { factory: 'tag-factory', rating_end: 'tag-rating', battlepass: 'tag-battlepass', road: 'tag-road', raven: 'tag-raven', workshop: 'tag-workshop', bounty: 'tag-bounty', nerf: 'tag-nerf', buff: 'tag-buff', gift: 'tag-gift', bearings: 'tag-bearings' };
    list.innerHTML = events.map(function(e, i) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">' +
            '<span><span class="tag ' + (tagClass[e.type] || '') + '">' + (emoji[e.type] || '📌') + '</span> ' + e.date + ' — ' + (e.desc || e.type) + '</span>' +
            '<button class="delete-btn" onclick="deleteEvent(' + i + ')">✕</button></div>';
    }).join('');
}

// Инсайты
function updateInsightSelect() {
    var select = document.getElementById('insightItemSelect');
    select.innerHTML = items.map(function(i) { return '<option value="' + i.name + '">' + i.name + '</option>'; }).join('');
}

function addInsight() {
    var item = document.getElementById('insightItemSelect').value;
    var text = document.getElementById('insightText').value.trim();
    if (!item || !text) { alert('Выбери предмет и напиши наблюдение'); return; }
    insights.push({ item: item, text: text, date: new Date().toISOString() });
    saveAll();
    document.getElementById('insightText').value = '';
    renderInsights();
}

function deleteInsight(index) {
    insights.splice(index, 1);
    saveAll();
    renderInsights();
}

function renderInsights() {
    var list = document.getElementById('insightsList');
    if (insights.length === 0) {
        list.innerHTML = '<p style="color:#888;">Нет инсайтов.</p>';
        return;
    }
    list.innerHTML = insights.map(function(ins, i) {
        return '<div class="insight-box">' +
            '<div style="font-size:0.8em;color:var(--accent);margin-bottom:4px;">📦 ' + ins.item + ' — ' + new Date(ins.date).toLocaleDateString('ru-RU') + '</div>' +
            '<div>' + ins.text + '</div>' +
            '<button class="delete-btn" onclick="deleteInsight(' + i + ')" style="margin-top:4px;">✕</button></div>';
    }).join('');
}

// Инициализация
renderItems();
renderEvents();
updateTradeSelect();
updateInsightSelect();
if (items.length > 0) selectItem(items[0].name);
