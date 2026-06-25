// Wasteland Market Terminal — core.js (данные и логика)
const STORAGE_ITEMS = 'wl_items_v3';
const STORAGE_PRICES = 'wl_prices_v3';
const STORAGE_TRADES = 'wl_trades_v3';
const STORAGE_EVENTS = 'wl_events_v3';
const STORAGE_PREDICTIONS = 'wl_predictions_v3';
const STORAGE_INSIGHTS = 'wl_insights_v3';
const STORAGE_BALANCE = 'wl_balance_v3';

let items = JSON.parse(localStorage.getItem(STORAGE_ITEMS) || '[]');
let prices = JSON.parse(localStorage.getItem(STORAGE_PRICES) || '{}');
let trades = JSON.parse(localStorage.getItem(STORAGE_TRADES) || '[]');
let events = JSON.parse(localStorage.getItem(STORAGE_EVENTS) || '[]');
let predictions = JSON.parse(localStorage.getItem(STORAGE_PREDICTIONS) || '{}');
let insights = JSON.parse(localStorage.getItem(STORAGE_INSIGHTS) || '[]');
let balance = parseFloat(localStorage.getItem(STORAGE_BALANCE) || '1000');
let selectedItem = null;

function saveAll() {
    localStorage.setItem(STORAGE_ITEMS, JSON.stringify(items));
    localStorage.setItem(STORAGE_PRICES, JSON.stringify(prices));
    localStorage.setItem(STORAGE_TRADES, JSON.stringify(trades));
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(events));
    localStorage.setItem(STORAGE_PREDICTIONS, JSON.stringify(predictions));
    localStorage.setItem(STORAGE_INSIGHTS, JSON.stringify(insights));
    localStorage.setItem(STORAGE_BALANCE, balance);
}

function updateBalance() {
    balance = parseFloat(document.getElementById('balanceInput').value) || 0;
    document.getElementById('balanceDisplay').textContent = balance.toFixed(2);
    localStorage.setItem(STORAGE_BALANCE, balance);
}

// Предметы
function addItem(name, type) {
    if (!name) return;
    if (items.find(i => i.name === name)) { alert('Уже есть'); return; }
    items.push({ name, type });
    prices[name] = [];
    predictions[name] = [];
    saveAll();
}

function deleteSelectedItem() {
    if (!selectedItem) return;
    if (confirm('Удалить "' + selectedItem + '" и все данные?')) {
        items = items.filter(i => i.name !== selectedItem);
        delete prices[selectedItem];
        delete predictions[selectedItem];
        selectedItem = null;
        saveAll();
    }
}

function addPriceEntry(time, buy, sell, event, nerf, buff) {
    if (!selectedItem || isNaN(buy) || isNaN(sell)) return;
    if (!prices[selectedItem]) prices[selectedItem] = [];
    prices[selectedItem].push({ time, buy, sell, event, nerf, buff });
    prices[selectedItem].sort((a, b) => new Date(a.time) - new Date(b.time));
    saveAll();
    updatePredictions(selectedItem);
}

// Сделки
function addTrade(item, buyPrice, sellPrice) {
    if (!item || isNaN(buyPrice) || isNaN(sellPrice)) return;
    const profit = sellPrice - buyPrice;
    const profitPct = (profit / buyPrice) * 100;
    const pred = getPrediction(item);
    trades.push({
        item, buyPrice, sellPrice,
        buyDate: new Date().toISOString(), sellDate: new Date().toISOString(),
        profit, profitPct, confidence: pred.confidence
    });
    if (!predictions[item]) predictions[item] = [];
    predictions[item].push({
        date: new Date().toISOString(),
        predicted: pred.signal,
        actual: profit > 0 ? 1 : 0,
        confidence: pred.confidence
    });
    balance += profit;
    document.getElementById('balanceInput').value = balance.toFixed(2);
    document.getElementById('balanceDisplay').textContent = balance.toFixed(2);
    saveAll();
}

// События
function addEvent(date, type, desc) {
    if (!date) return;
    events.push({ date, type, desc });
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    saveAll();
}

function deleteEvent(index) {
    events.splice(index, 1);
    saveAll();
}

// Инсайты
function addInsight(item, text) {
    if (!item || !text) return;
    insights.push({ item, text, date: new Date().toISOString() });
    saveAll();
}

function deleteInsight(index) {
    insights.splice(index, 1);
    saveAll();
}

// Предсказание
function getPrediction(item) {
    const data = prices[item] || [];
    if (data.length < 3) return { signal: 0, confidence: 0, trend: 0, volatility: 0, text: '📊 НЕДОСТАТОЧНО ДАННЫХ', class: 'stable' };
    const buys = data.map(p => p.buy);
    const sells = data.map(p => p.sell);
    const avgBuy = buys.reduce((a,b) => a+b, 0) / buys.length;
    const avgSell = sells.reduce((a,b) => a+b, 0) / sells.length;
    const recent = data.slice(-5);
    const recentAvgBuy = recent.reduce((a,b) => a+b.buy, 0) / recent.length;
    const trend = ((recentAvgBuy - avgBuy) / avgBuy) * 100;
    const variance = buys.map(b => (b - avgBuy) ** 2).reduce((a,b) => a+b, 0) / buys.length;
    const volatility = Math.sqrt(variance);
    let signal = 0, confidence = 0.5, text = '', cls = 'stable';
    if (trend > 1.5) { signal = 0; text = '📈 ЦЕНА РАСТЁТ — продавать или ждать'; cls = 'up'; }
    else if (trend < -1.5) { signal = 1; text = '📉 ЦЕНА ПАДАЕТ — хороший момент для покупки'; cls = 'down'; }
    else { signal = 0.1; text = '📊 ЦЕНА СТАБИЛЬНА — можно торговать в коридоре'; cls = 'stable'; }
    const lastBuy = buys[buys.length - 1];
    const lastSell = sells[buys.length - 1];
    if (lastBuy < avgBuy * 0.95) { text += '\n💡 ЦЕНА НИЖЕ СРЕДНЕГО — покупать!'; signal = 1; cls = 'down'; }
    if (lastSell > avgSell * 1.05) { text += '\n💰 ЦЕНА ВЫШЕ СРЕДНЕГО — продавать!'; signal = 0; cls = 'up'; }
    confidence = Math.min(0.9, 0.5 + Math.abs(trend) / 20 + (data.length > 10 ? 0.2 : 0));
    const accuracy = getModelAccuracy(item);
    if (accuracy < 40) confidence *= 0.5;
    return { signal, confidence, trend, volatility, text, class: cls };
}

function updatePredictions(item) {
    if (!item) return;
    const pred = getPrediction(item);
    if (!predictions[item]) predictions[item] = [];
    predictions[item].push({ date: new Date().toISOString(), predicted: pred.signal, confidence: pred.confidence });
    if (predictions[item].length > 50) predictions[item].shift();
    saveAll();
}

function getModelAccuracy(item) {
    const preds = predictions[item] || [];
    const withActual = preds.filter(p => p.actual !== undefined);
    if (withActual.length === 0) return 50;
    const correct = withActual.filter(p => (p.predicted > 0.5 && p.actual === 1) || (p.predicted <= 0.5 && p.actual === 0)).length;
    return Math.round((correct / withActual.length) * 100);
}

function getGlobalAccuracy() {
    let total = 0, correct = 0;
    items.forEach(item => {
        const preds = predictions[item.name] || [];
        const withActual = preds.filter(p => p.actual !== undefined);
        total += withActual.length;
        correct += withActual.filter(p => (p.predicted > 0.5 && p.actual === 1) || (p.predicted <= 0.5 && p.actual === 0)).length;
    });
    return total > 0 ? Math.round((correct / total) * 100) : 0;
}
