// Wasteland Market Terminal — core.js v6.0 (новые сделки: buy/sell раздельно)
const STORAGE_ITEMS = 'wl_items_v4';
const STORAGE_PRICES = 'wl_prices_v4';
const STORAGE_TRADES = 'wl_trades_v5'; // Новая версия хранилища
const STORAGE_EVENTS = 'wl_events_v4';
const STORAGE_PREDICTIONS = 'wl_predictions_v4';
const STORAGE_BALANCE = 'wl_balance_v4';
const STORAGE_STORAGE = 'wl_storage_v1';
const STORAGE_GOALS = 'wl_goals_v1';

let items = JSON.parse(localStorage.getItem(STORAGE_ITEMS) || '[]');
let prices = JSON.parse(localStorage.getItem(STORAGE_PRICES) || '{}');
let trades = JSON.parse(localStorage.getItem(STORAGE_TRADES) || '[]');
let events = JSON.parse(localStorage.getItem(STORAGE_EVENTS) || '[]');
let predictions = JSON.parse(localStorage.getItem(STORAGE_PREDICTIONS) || '{}');
let balance = parseFloat(localStorage.getItem(STORAGE_BALANCE) || '1000');
let storageItems = JSON.parse(localStorage.getItem(STORAGE_STORAGE) || '[]');
let goals = JSON.parse(localStorage.getItem(STORAGE_GOALS) || '[]');
let selectedItem = null;

items = items.map(i => ({ lotSize: 1, ...i }));
goals = goals.map(g => ({ item: '', ...g }));

function saveAll() {
    localStorage.setItem(STORAGE_ITEMS, JSON.stringify(items));
    localStorage.setItem(STORAGE_PRICES, JSON.stringify(prices));
    localStorage.setItem(STORAGE_TRADES, JSON.stringify(trades));
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(events));
    localStorage.setItem(STORAGE_PREDICTIONS, JSON.stringify(predictions));
    localStorage.setItem(STORAGE_BALANCE, balance);
    localStorage.setItem(STORAGE_STORAGE, JSON.stringify(storageItems));
    localStorage.setItem(STORAGE_GOALS, JSON.stringify(goals));
}

function updateBalance() {
    balance = parseFloat(document.getElementById('balanceInput').value) || 0;
    localStorage.setItem(STORAGE_BALANCE, balance);
}

function addItem(name, type, lotSize) {
    if (!name) return;
    const existing = items.find(i => i.name === name);
    if (existing) { existing.lotSize = lotSize || existing.lotSize || 1; if (type) existing.type = type; saveAll(); return; }
    items.push({ name, type, lotSize: lotSize || 1 });
    prices[name] = []; predictions[name] = [];
    saveAll();
}

function deleteSelectedItem() {
    if (!selectedItem) return;
    if (confirm('Удалить "' + selectedItem + '"?')) {
        items = items.filter(i => i.name !== selectedItem);
        delete prices[selectedItem]; delete predictions[selectedItem];
        selectedItem = null; saveAll();
    }
}

function addPriceEntry(time, buy, sell, event, nerf, buff) {
    if (!selectedItem || isNaN(buy) || isNaN(sell)) return;
    if (!prices[selectedItem]) prices[selectedItem] = [];
    prices[selectedItem].push({ time, buy, sell, event, nerf, buff });
    prices[selectedItem].sort((a, b) => new Date(a.time) - new Date(b.time));
    saveAll(); updatePredictions(selectedItem);
}

// === НОВАЯ СИСТЕМА СДЕЛОК ===
function addTrade(item, type, qty, pricePerUnit) {
    // type: 'buy' или 'sell'
    // qty: количество штук (не лотов!)
    // pricePerUnit: цена за ОДНУ штуку
    if (!item || !type || isNaN(qty) || isNaN(pricePerUnit)) return;
    if (qty <= 0 || pricePerUnit <= 0) return;
    
    const totalCost = pricePerUnit * qty;
    const now = new Date().toISOString();
    
    const trade = {
        id: Date.now(),
        item: item,
        type: type,          // 'buy' или 'sell'
        qty: qty,            // количество штук
        pricePerUnit: pricePerUnit,
        total: totalCost,
        date: now
    };
    
    if (type === 'buy') {
        // Покупка: минус голда, плюс на склад
        if (balance < totalCost) { alert('Не хватает голды! Нужно ' + totalCost.toFixed(0) + ', есть ' + balance.toFixed(0)); return; }
        balance -= totalCost;
        document.getElementById('balanceInput').value = balance.toFixed(2);
        
        // Добавляем на склад (или увеличиваем существующий)
        const existing = storageItems.find(s => s.item === item && !s.modded);
        if (existing) {
            const totalQty = existing.qty + qty;
            existing.buyPrice = (existing.buyPrice * existing.qty + totalCost) / totalQty;
            existing.qty = totalQty;
        } else {
            storageItems.push({ item, qty: qty, buyPrice: totalCost / qty, modded: false, date: now });
        }
    } else if (type === 'sell') {
        // Продажа: плюс голда, минус со склада
        const onStorage = storageItems.filter(s => s.item === item && !s.modded);
        const totalOnStorage = onStorage.reduce((sum, s) => sum + s.qty, 0);
        
        if (totalOnStorage < qty) { alert('Не хватает на складе! Есть ' + totalOnStorage + ', нужно ' + qty); return; }
        
        balance += totalCost;
        document.getElementById('balanceInput').value = balance.toFixed(2);
        
        // Убираем со склада (FIFO: сначала самые старые)
        let toRemove = qty;
        for (let i = onStorage.length - 1; i >= 0 && toRemove > 0; i--) {
            const s = onStorage[i];
            const idx = storageItems.indexOf(s);
            if (s.qty <= toRemove) {
                toRemove -= s.qty;
                storageItems.splice(idx, 1);
            } else {
                s.qty -= toRemove;
                toRemove = 0;
            }
        }
    }
    
    trades.push(trade);
    
    // Обновляем предсказания
    if (!predictions[item]) predictions[item] = [];
    const pred = getPrediction(item);
    const profit = type === 'buy' ? -totalCost : totalCost;
    predictions[item].push({
        date: now,
        predicted: pred.signal,
        actual: profit > 0 ? 1 : 0,
        confidence: pred.confidence
    });
    if (predictions[item].length > 50) predictions[item].shift();
    
    saveAll();
}

// === СТАРАЯ ФУНКЦИЯ ДЛЯ СОВМЕСТИМОСТИ (вызывает новую) ===
function addTradeOld(item, buyPrice, sellPrice) {
    // Конвертируем старый формат в новый
    // Если buyPrice < sellPrice — это была покупка а потом продажа
    // Но мы не знаем сколько штук... используем lotSize
    const itemObj = items.find(i => i.name === item);
    const lotSize = itemObj ? itemObj.lotSize : 1;
    
    // Записываем как продажу (sellPrice) после покупки (buyPrice)
    addTrade(item, 'buy', lotSize, buyPrice / lotSize);
    addTrade(item, 'sell', lotSize, sellPrice / lotSize);
}

function addToStorage(item, qty, buyPrice, modded) {
    if (!item || isNaN(qty)) return;
    if (buyPrice === undefined || buyPrice === null) buyPrice = 0;
    storageItems.push({ item, qty, buyPrice: Number(buyPrice) || 0, modded, date: new Date().toISOString() });
    saveAll();
}

function removeFromStorage(index) { storageItems.splice(index, 1); saveAll(); }

function addGoal(text, target, current, goalItem) {
    if (!text || isNaN(target)) return;
    goals.push({ text, target, current: current || 0, item: goalItem || '', date: new Date().toISOString() });
    saveAll();
}

function deleteGoal(index) { goals.splice(index, 1); saveAll(); }

function addEvent(start, end, type, desc) {
    if (!start) return;
    events.push({ start, end: end || start, type, desc });
    events.sort((a, b) => new Date(b.start) - new Date(a.start));
    saveAll();
}

function deleteEvent(index) { events.splice(index, 1); saveAll(); }

function getActiveEvent() {
    const today = new Date().toISOString().slice(0, 10);
    return events.find(e => e.start <= today && e.end >= today) || null;
}

// === ПРИБЫЛЬ ПО ПРЕДМЕТУ (сопоставление пар сделок) ===
function getItemProfit(item) {
    const itemTrades = trades.filter(t => t.item === item).sort((a,b) => new Date(a.date) - new Date(b.date));
    let profit = 0;
    let buyStack = []; // [{qty, price}]
    
    for (const t of itemTrades) {
        if (t.type === 'buy') {
            buyStack.push({ qty: t.qty, price: t.pricePerUnit });
        } else {
            let toSell = t.qty;
            while (toSell > 0 && buyStack.length > 0) {
                const first = buyStack[0];
                const match = Math.min(first.qty, toSell);
                profit += match * (t.pricePerUnit - first.price);
                first.qty -= match;
                toSell -= match;
                if (first.qty <= 0) buyStack.shift();
            }
        }
    }
    return profit;
}

function getTotalProfit() {
    const allItems = [...new Set(trades.map(t => t.item))];
    return allItems.reduce((sum, item) => sum + getItemProfit(item), 0);
}

function getPrediction(item) {
    const data = prices[item] || [];
    const itemObj = items.find(i => i.name === item);
    const lotSize = itemObj ? itemObj.lotSize : 1;
    if (data.length < 3) return { signal: 0, confidence: 0, text: '📊 МАЛО ДАННЫХ', class: 'stable', slope: 0, volatility: 0, avgBuy: 0, avgSell: 0 };
    const buys = data.map(p => p.buy / lotSize), sells = data.map(p => p.sell / lotSize), n = buys.length;
    const times = data.map((p, i) => new Date(p.time).getTime());
    const tMean = times.reduce((a, b) => a + b, 0) / n, buyMean = buys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (times[i] - tMean) * (buys[i] - buyMean); den += (times[i] - tMean) ** 2; }
    const slope = den ? num / den : 0, slopePerHour = slope * 3600000;
    const variance = buys.reduce((a, b) => a + (b - buyMean) ** 2, 0) / n, volatility = Math.sqrt(variance);
    const trendStrength = volatility ? Math.abs(slopePerHour) / volatility : 0;
    let signal, text, cls;
    if (slopePerHour < -0.1 || (slopePerHour < 0 && trendStrength > 0.2)) { signal = 1; text = `📉 ПАДАЕТ (${slopePerHour.toFixed(2)}/ч) — покупать`; cls = 'down'; }
    else if (slopePerHour > 0.1 || (slopePerHour > 0 && trendStrength > 0.2)) { signal = 0; text = `📈 РАСТЁТ (${slopePerHour.toFixed(2)}/ч) — продавать`; cls = 'up'; }
    else { signal = 0.5; text = '📊 СТАБИЛЬНО'; cls = 'stable'; }
    const avgBuy = buyMean, avgSell = sells.reduce((a, b) => a + b, 0) / n;
    const lastBuy = buys[buys.length - 1], lastSell = sells[buys.length - 1];
    if (lastBuy < avgBuy * 0.95) { text += '\n💡 Ниже среднего — покупать!'; signal = 1; cls = 'down'; }
    if (lastSell > avgSell * 1.05) { text += '\n💰 Выше среднего — продавать!'; signal = 0; cls = 'up'; }
    const confidence = Math.min(0.9, 0.4 + trendStrength * 2 + (n > 10 ? 0.2 : 0));
    const accuracy = getModelAccuracy(item), finalConfidence = accuracy < 40 ? confidence * 0.5 : confidence;
    return { signal, confidence: finalConfidence, slope: slopePerHour, volatility, avgBuy, avgSell, lastBuy, lastSell, text, class: cls };
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
