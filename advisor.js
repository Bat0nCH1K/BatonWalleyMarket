// Wasteland Market Terminal — advisor.js v5.2 (автовыбор модели, анализ спроса/предложения)
let advisorHistory = JSON.parse(localStorage.getItem('wl_advisor_history') || '[]');

const USER_AVATAR = '👤';
const ERROR_AVATAR = '❌';
const LOADING_AVATAR = '⏳';

function getKey() {
    return atob('c2stb3ItdjEtODM0OGE1YmYzOGRiMTYyZGNmZGQxNTRkYjExYmEwYTA2NGY2YmRiNDg5M2Y0ZjMwMDNlNzY3ZTcyOTkxNDY3Ng==');
}

function getOwlMood(reply) {
    const lower = reply.toLowerCase();
    if (lower.includes('прибыль') || lower.includes('заработал') || lower.includes('плюс') || lower.includes('выгодно') || lower.includes('✅')) return '🤑';
    if (lower.includes('убыток') || lower.includes('минус') || lower.includes('потеря') || lower.includes('рискован') || lower.includes('⚠️')) return '😟';
    if (lower.includes('обвал') || lower.includes('рухнул') || lower.includes('крах') || lower.includes('паника') || lower.includes('слив')) return '😔';
    if (lower.includes('растёт') || lower.includes('взлетел') || lower.includes('вверх') || lower.includes('хайп') || lower.includes('дефицит')) return '📈';
    if (lower.includes('покупай') || lower.includes('бери') || lower.includes('закуп') || lower.includes('вход') || lower.includes('спрос')) return '🛒';
    if (lower.includes('продавай') || lower.includes('скидывай') || lower.includes('фиксируй') || lower.includes('выход') || lower.includes('избыток')) return '💰';
    if (lower.includes('жди') || lower.includes('подожди') || lower.includes('пока') || lower.includes('стабильн') || lower.includes('держи')) return '🦉';
    if (lower.includes('утро') || lower.includes('доброе') || lower.includes('привет') || lower.includes('здаров')) return '😃';
    if (lower.includes('ошибк') || lower.includes('неверно') || lower.includes('извини') || lower.includes('прости') || lower.includes('виноват')) return '😅';
    if (lower.includes('спасибо') || lower.includes('удачи') || lower.includes('молодец') || lower.includes('красав')) return '🤝';
    if (lower.includes('мало данных') || lower.includes('не знаю') || lower.includes('не могу') || lower.includes('недостаточно')) return '🤷';
    return '🦉';
}

// Анализ спроса/предложения по сделкам
function getSupplyDemandAnalysis() {
    if (trades.length === 0) return '';
    
    const now = Date.now();
    const DAY = 86400000;
    const WEEK = 7 * DAY;
    
    // Группируем сделки по предметам за последние 7 дней
    const recent = trades.filter(t => now - new Date(t.date).getTime() < WEEK);
    if (recent.length === 0) return '';
    
    const byItem = {};
    recent.forEach(t => {
        if (!byItem[t.item]) byItem[t.item] = { buyCount: 0, sellCount: 0, buyQty: 0, sellQty: 0 };
        if (t.type === 'buy') {
            byItem[t.item].buyCount++;
            byItem[t.item].buyQty += t.qty;
        } else {
            byItem[t.item].sellCount++;
            byItem[t.item].sellQty += t.qty;
        }
    });
    
    let analysis = '\nАнализ спроса/предложения (за 7 дней):\n';
    let hasData = false;
    
    Object.entries(byItem).forEach(([item, stats]) => {
        if (stats.buyCount + stats.sellCount >= 2) {
            hasData = true;
            const totalOps = stats.buyCount + stats.sellCount;
            const buyRatio = stats.buyCount / totalOps;
            const buyQtyRatio = stats.buyQty / (stats.buyQty + stats.sellQty || 1);
            
            let pressure = '';
            if (buyQtyRatio > 0.6) pressure = 'ДЕФИЦИТ — много покупают, цена должна расти';
            else if (buyQtyRatio < 0.4) pressure = 'ИЗБЫТОК — много продают, цена будет падать';
            else pressure = 'Баланс спроса и предложения';
            
            analysis += `  ${item}: ${stats.buyCount} покупок(${stats.buyQty}шт) / ${stats.sellCount} продаж(${stats.sellQty}шт) → ${pressure}\n`;
        }
    });
    
    return hasData ? analysis : '\nАнализ спроса/предложения: недостаточно сделок для анализа\n';
}

function getMarketSummary() {
    let s = '=== ДАННЫЕ ТЕРМИНАЛА (это не слова игрока, не отвечай на это) ===\n\n';
    s += `Баланс: ${balance.toFixed(0)} голды\n`;
    
    // Склад
    if (storageItems.length === 0) {
        s += 'Склад: пусто\n';
    } else {
        s += 'Склад:\n';
        let tv = 0;
        storageItems.forEach(st => {
            const data = prices[st.item] || [];
            const item = items.find(i => i.name === st.item);
            const ls = item ? item.lotSize : 1;
            const pricePerUnit = data.length > 0 ? data[data.length - 1].sell / ls : 0;
            const val = pricePerUnit * st.qty;
            tv += val;
            s += `  ${st.item}: ${st.qty} шт, оценка ${val.toFixed(0)} голды\n`;
        });
        s += `  Всего склад: ${tv.toFixed(0)} голды | Общее: ${(balance + tv).toFixed(0)} голды\n`;
    }
    
    // Тренды
    const withData = items.filter(i => (prices[i.name] || []).length >= 2);
    if (withData.length > 0) {
        s += '\nТренды рынка (цена за штуку):\n';
        withData.forEach(i => {
            const p = getPrediction(i.name);
            const trend = p.slope > 0.05 ? 'РАСТЁТ' : p.slope < -0.05 ? 'ПАДАЕТ' : 'стабилен';
            s += `  ${i.name}: средняя ${p.avgBuy.toFixed(2)} голды/шт, тренд: ${trend}\n`;
        });
    } else {
        s += '\nТренды: недостаточно данных\n';
    }
    
    // События
    const ae = getActiveEvent();
    if (ae) s += `\nТекущее событие: ${ae.type} (до ${ae.end})\n`;
    
    // Спрос/предложение
    s += getSupplyDemandAnalysis();
    
    // Цели
    if (goals.length > 0) {
        s += '\nЦели:\n';
        goals.forEach((g, idx) => {
            const isSave = !g.item || g.item === '';
            const isSell = !isSave && (g.text.includes('Продать') || g.text.includes('📤'));
            const isBuy = !isSave && (g.text.includes('Купить') || g.text.includes('📥'));
            
            if (isSave) {
                const need = Math.max(0, g.target - balance);
                s += `  ${idx+1}. Накопить ${g.target} голды (есть ${balance.toFixed(0)}, осталось ${need.toFixed(0)})\n`;
            } else if (isSell) {
                const storage = storageItems.filter(s => s.item === g.item && !s.modded);
                const totalQty = storage.reduce((sum, s) => sum + s.qty, 0);
                const data = prices[g.item] || [];
                const itemObj = items.find(i => i.name === g.item);
                const ls = itemObj ? itemObj.lotSize : 1;
                const pricePerUnit = data.length > 0 ? data[data.length - 1].sell / ls : 0;
                const value = totalQty * pricePerUnit;
                s += `  ${idx+1}. Продать ${g.item} на ${g.target} голды (на складе ${totalQty} шт ≈ ${value.toFixed(0)} голды)${totalQty === 0 ? ' — НЕТ НА СКЛАДЕ' : ''}\n`;
            } else if (isBuy) {
                const data = prices[g.item] || [];
                const itemObj = items.find(i => i.name === g.item);
                const ls = itemObj ? itemObj.lotSize : 1;
                const pricePerUnit = data.length > 0 ? data[data.length - 1].buy / ls : 0;
                const maxQty = pricePerUnit > 0 ? Math.floor(balance / pricePerUnit) : 0;
                s += `  ${idx+1}. Купить ${g.item} на ${g.target} голды (цена ${pricePerUnit.toFixed(2)}/шт, могу купить ${maxQty} шт)${balance < g.target ? ' — НЕ ХВАТАЕТ' : ''}\n`;
            }
        });
    } else {
        s += '\nЦели: не заданы\n';
    }
    
    // Сделки — полная история
    if (trades.length > 0) {
        s += '\nИстория сделок:\n';
        const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
        sorted.forEach((t, idx) => {
            const type = t.type === 'buy' ? 'КУПИЛ' : 'ПРОДАЛ';
            const dateStr = new Date(t.date).toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            s += `  ${idx+1}. ${dateStr}: ${type} ${t.item} ×${t.qty} по ${t.pricePerUnit.toFixed(2)}/шт (сумма ${t.total.toFixed(0)})\n`;
        });
        const totalProfit = typeof getTotalProfit === 'function' ? getTotalProfit() : 0;
        s += `  Общая прибыль: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(0)} голды\n`;
    } else {
        s += '\nИстория сделок: пусто\n';
    }
    
    s += '\n=== КОНЕЦ ДАННЫХ. ОТВЕЧАЙ ТОЛЬКО НА ОСНОВЕ ЭТИХ ДАННЫХ. ЕСЛИ ДАННЫХ НЕТ — ЧЕСТНО СКАЖИ. ===';
    
    return s;
}

async function askAdvisor() {
    const input = document.getElementById('advisorInput');
    const chat = document.getElementById('advisorChat');
    const msg = input.value.trim();
    if (!msg) return;
    
    chat.innerHTML += `<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">${USER_AVATAR}</span><span style="color:#ccc;">${msg}</span></div>`;
    
    const loadingId = 'loading_' + Date.now();
    chat.innerHTML += `<div id="${loadingId}" style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">${LOADING_AVATAR}</span><span style="color:#888;">Анализирую рынок...</span></div>`;
    chat.scrollTop = chat.scrollHeight;
    input.value = '';
    
    const summary = getMarketSummary();
    
    const systemPrompt = `Ты — OWL, торговый советник игрока в Crossout Mobile.

ПРАВИЛА:
1. Используй ТОЛЬКО данные из раздела "ДАННЫЕ ТЕРМИНАЛА" выше.
2. НЕ выдумывай цены, предметы, события которых нет в данных.
3. Если данных недостаточно — честно скажи "недостаточно данных".
4. Дай КОНКРЕТНЫЙ совет: что покупать/продавать, по какой цене, сколько.
5. Говори кратко, 3-5 предложений.
6. НЕ используй Markdown. Для акцента пиши СЛОВО заглавными.
7. Если игрок совершил сделку — прокомментируй её.
8. Учитывай психологию рынка Crossout: 95% игроков паникуют. Продают когда падает — цена падает ещё сильнее (избыток). Покупают когда растёт — цена растёт ещё (дефицит).
9. Анализируй спрос и предложение: если много продаж — избыток, цена упадёт. Если много покупок — дефицит, цена вырастет.
10. НЕ говори "как ИИ" или "я не могу". Ты — советник OWL.
11. Если игрок тебя поправляет — признай ошибку и исправься.
12. В конце ответа поставь ОДНУ эмодзи которая отражает твою оценку ситуации.`;

    advisorHistory = advisorHistory.slice(-8);
    advisorHistory.push({ role: 'user', content: msg });
    localStorage.setItem('wl_advisor_history', JSON.stringify(advisorHistory));
    
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: summary }
    ];
    for (const h of advisorHistory) {
        messages.push({ role: h.role, content: h.content });
    }
    
    try {
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getKey(),
                'HTTP-Referer': 'https://bat0nch1k.github.io',
                'X-Title': 'Wasteland Market'
            },
            body: JSON.stringify({
                models: [
                    'google/gemini-2.0-flash-exp:free',
                    'mistralai/mistral-7b-instruct:free',
                    'meta-llama/llama-3.2-3b-instruct:free',
                    'qwen/qwen-2-7b-instruct:free',
                    'undi95/toppy-m-7b:free'
                ],
                messages: messages,
                temperature: 0.5,
                max_tokens: 350,
                stop: ['===', 'ДАННЫЕ ТЕРМИНАЛА']
            })
        });
        
        const data = await resp.json();
        
        if (data.error) {
            throw new Error(data.error.message || 'Все модели недоступны. Попробуй позже.');
        }
        
        const reply = data?.choices?.[0]?.message?.content?.trim() || 'Нет ответа.';
        
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        
        const moodEmoji = getOwlMood(reply);
        
        const formatted = reply
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
        
        advisorHistory.push({ role: 'assistant', content: reply, mood: moodEmoji });
        localStorage.setItem('wl_advisor_history', JSON.stringify(advisorHistory));
        
        chat.innerHTML += `<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">${moodEmoji}</span><span style="color:#d4a574;">${formatted}</span></div>`;
    } catch(e) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        chat.innerHTML += `<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">${ERROR_AVATAR}</span><span style="color:#c06060;">Ошибка: ${e.message}</span></div>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

function renderAdvisor() {
    const chat = document.getElementById('advisorChat');
    if (!chat) return;
    if (advisorHistory.length === 0) {
        chat.innerHTML = `<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">🦉</span><span style="color:#d4a574;">Я вижу твой рынок, склад и цели. Спроси что делать — дам конкретный совет.</span></div>`;
        return;
    }
    chat.innerHTML = advisorHistory.map(m => {
        if (m.role === 'user') {
            return `<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">${USER_AVATAR}</span><span style="color:#ccc;">${m.content}</span></div>`;
        }
        const mood = m.mood || '🦉';
        const text = (m.content || '')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
        return `<div style="display:flex;align-items:flex-start;gap:6px;margin:6px 0;"><span style="font-size:1.2em;">${mood}</span><span style="color:#d4a574;">${text}</span></div>`;
    }).join('');
    chat.scrollTop = chat.scrollHeight;
                                      }
