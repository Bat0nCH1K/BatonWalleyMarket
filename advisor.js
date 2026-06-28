// Wasteland Market Terminal — advisor.js v5.3 (Llama 3.2, анализ спроса/предложения)
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

function getSupplyDemandAnalysis() {
    if (trades.length === 0) return '';
    
    const now = Date.now();
    const DAY = 86400000;
    const WEEK = 7 * DAY;
    
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
    
    let analysis = '\nСпрос/предложение (7 дней):\n';
    let hasData = false;
    
    Object.entries(byItem).forEach(([item, stats]) => {
        if (stats.buyCount + stats.sellCount >= 2) {
            hasData = true;
            const buyQtyRatio = stats.buyQty / (stats.buyQty + stats.sellQty || 1);
            let pressure = '';
            if (buyQtyRatio > 0.6) pressure = 'ДЕФИЦИТ — цена растёт';
            else if (buyQtyRatio < 0.4) pressure = 'ИЗБЫТОК — цена падает';
            else pressure = 'Баланс';
            analysis += `  ${item}: покупок ${stats.buyQty}шт / продаж ${stats.sellQty}шт → ${pressure}\n`;
        }
    });
    
    return hasData ? analysis : '\nСпрос/предложение: мало данных\n';
}

function getMarketSummary() {
    let s = '=== ДАННЫЕ ТЕРМИНАЛА ===\n\n';
    s += `Баланс: ${balance.toFixed(0)} голды\n`;
    
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
        s += `  Склад: ${tv.toFixed(0)} | Общее: ${(balance + tv).toFixed(0)} голды\n`;
    }
    
    const withData = items.filter(i => (prices[i.name] || []).length >= 2);
    if (withData.length > 0) {
        s += '\nТренды:\n';
        withData.forEach(i => {
            const p = getPrediction(i.name);
            const trend = p.slope > 0.05 ? 'РАСТЁТ' : p.slope < -0.05 ? 'ПАДАЕТ' : 'стабилен';
            s += `  ${i.name}: ср.${p.avgBuy.toFixed(2)}/шт, ${trend}\n`;
        });
    }
    
    const ae = getActiveEvent();
    if (ae) s += `\nСобытие: ${ae.type} (до ${ae.end})\n`;
    
    s += getSupplyDemandAnalysis();
    
    if (goals.length > 0) {
        s += '\nЦели:\n';
        goals.forEach((g, idx) => {
            const isSave = !g.item || g.item === '';
            const isSell = !isSave && (g.text.includes('Продать') || g.text.includes('📤'));
            const isBuy = !isSave && (g.text.includes('Купить') || g.text.includes('📥'));
            
            if (isSave) {
                const need = Math.max(0, g.target - balance);
                s += `  ${idx+1}. Накопить ${g.target}г (есть ${balance.toFixed(0)}, ещё ${need.toFixed(0)})\n`;
            } else if (isSell) {
                const storage = storageItems.filter(s => s.item === g.item && !s.modded);
                const totalQty = storage.reduce((sum, s) => sum + s.qty, 0);
                const data = prices[g.item] || [];
                const itemObj = items.find(i => i.name === g.item);
                const ls = itemObj ? itemObj.lotSize : 1;
                const pricePerUnit = data.length > 0 ? data[data.length - 1].sell / ls : 0;
                const value = totalQty * pricePerUnit;
                s += `  ${idx+1}. Продать ${g.item} на ${g.target}г (склад: ${totalQty}шт ≈ ${value.toFixed(0)}г)${totalQty === 0 ? ' НЕТ' : ''}\n`;
            } else if (isBuy) {
                const data = prices[g.item] || [];
                const itemObj = items.find(i => i.name === g.item);
                const ls = itemObj ? itemObj.lotSize : 1;
                const pricePerUnit = data.length > 0 ? data[data.length - 1].buy / ls : 0;
                const maxQty = pricePerUnit > 0 ? Math.floor(balance / pricePerUnit) : 0;
                s += `  ${idx+1}. Купить ${g.item} на ${g.target}г (цена ${pricePerUnit.toFixed(2)}/шт, могу ${maxQty}шт)${balance < g.target ? ' МАЛО' : ''}\n`;
            }
        });
    }
    
    if (trades.length > 0) {
        s += '\nСделки:\n';
        const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
        sorted.forEach((t, idx) => {
            const type = t.type === 'buy' ? 'КУПИЛ' : 'ПРОДАЛ';
            const dateStr = new Date(t.date).toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            s += `  ${idx+1}. ${dateStr}: ${type} ${t.item} x${t.qty} по ${t.pricePerUnit.toFixed(2)} (${t.total.toFixed(0)}г)\n`;
        });
        const totalProfit = typeof getTotalProfit === 'function' ? getTotalProfit() : 0;
        s += `  Прибыль: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(0)}г\n`;
    }
    
    s += '\n=== КОНЕЦ ДАННЫХ. ОТВЕЧАЙ СТРОГО ПО НИМ. ===';
    
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
    
    const systemPrompt = `Ты — OWL, торговый советник в Crossout Mobile.

ПРАВИЛА:
1. Только данные из раздела ДАННЫЕ ТЕРМИНАЛА. Не выдумывай.
2. Мало данных — честно скажи.
3. Конкретный совет: что, почём, сколько.
4. Кратко, 3-5 предложений. Без Markdown.
5. Для акцента — СЛОВО заглавными.
6. Комментируй сделки игрока: выгодно или нет.
7. 95% игроков — паникёры. Продают на падении (избыток → цена вниз), покупают на росте (дефицит → цена вверх).
8. Анализируй спрос/предложение из данных.
9. Не говори "как ИИ". Ты — OWL.
10. Поправляют — признай ошибку.
11. В конце — ОДНА эмодзи по настроению.`;

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
                model: 'meta-llama/llama-3.2-3b-instruct:free',
                messages: messages,
                temperature: 0.5,
                max_tokens: 350,
                stop: ['===', 'ДАННЫЕ ТЕРМИНАЛА']
            })
        });
        
        const data = await resp.json();
        
        if (data.error) {
            throw new Error(data.error.message || 'Ошибка API');
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
