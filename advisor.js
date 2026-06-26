// Wasteland Market Terminal — advisor.js v3 (улучшенный контекст: план достижения целей)
let advisorHistory = JSON.parse(localStorage.getItem('wl_advisor_history') || '[]');

function getKey() {
    return atob('c2stb3ItdjEtODM0OGE1YmYzOGRiMTYyZGNmZGQxNTRkYjExYmEwYTA2NGY2YmRiNDg5M2Y0ZjMwMDNlNzY3ZTcyOTkxNDY3Ng==');
}

function getMarketSummary() {
    let s = 'ТЕРМИНАЛ WASTELAND MARKET\n\n';
    s += `Баланс: ${balance.toFixed(0)} голды | Предметов: ${items.length}\n`;
    
    const withData = items.filter(i => (prices[i.name]||[]).length >= 3);
    if (withData.length > 0) {
        s += '\nТРЕНДЫ:\n';
        withData.forEach(i => {
            const p = getPrediction(i.name);
            s += `${i.name}: ср.${p.avgBuy.toFixed(1)}/шт, ${p.slope>0.1?'растёт':p.slope<-0.1?'падает':'стабилен'} (${p.slope.toFixed(2)}/ч)\n`;
        });
    }
    
    if (storageItems.length > 0) {
        s += '\nСКЛАД:\n';
        let tv = 0;
        storageItems.forEach(st => {
            const data = prices[st.item] || [];
            const item = items.find(i=>i.name===st.item);
            const ls = item ? item.lotSize : 1;
            const pricePerUnit = data.length>0 ? data[data.length-1].sell / ls : 0;
            const val = pricePerUnit * st.qty; tv += val;
            const inv = (st.buyPrice||0) * st.qty;
            const prof = val - inv;
            s += `${st.item} ×${st.qty}: вложено ${inv.toFixed(0)}, сейчас ${val.toFixed(0)} (${prof>=0?'+':''}${prof.toFixed(0)})${st.modded?' [МОД]':''}\n`;
        });
        s += `Оценка склада: ${tv.toFixed(0)} голды\n`;
    } else s += '\nСклад пуст\n';
    
    const ae = getActiveEvent();
    if (ae) s += `\nТекущее событие: ${ae.type} (до ${ae.end})\n`;
    
    // ЦЕЛИ С ПЛАНОМ
    if (goals.length > 0) {
        s += '\nЦЕЛИ И ПЛАН:\n';
        goals.forEach(g => {
            if (g.text.startsWith('💰')) {
                // Накопить
                const need = g.target - balance;
                s += `${g.text} (есть ${balance.toFixed(0)}, осталось ${need>0?need.toFixed(0):0})\n`;
                if (need > 0 && storageItems.length > 0) {
                    // Предложить что продать
                    const candidates = storageItems.filter(st => !st.modded && (prices[st.item]||[]).length > 0);
                    if (candidates.length > 0) {
                        s += `  💡 Чтобы накопить: продай что-то со склада (без модов). `;
                        candidates.forEach(st => {
                            const data = prices[st.item] || [];
                            const item = items.find(i=>i.name===st.item);
                            const ls = item ? item.lotSize : 1;
                            const price = data.length>0 ? data[data.length-1].sell/ls : 0;
                            s += `${st.item} (${(price*st.qty).toFixed(0)} голды за ${st.qty} шт), `;
                        });
                        s += '\n';
                    }
                }
            } else if (g.text.startsWith('📤')) {
                // Продать предмет
                const itemName = g.item || '';
                const storage = storageItems.filter(s => s.item === itemName && !s.modded);
                const totalQty = storage.reduce((sum, s) => sum + s.qty, 0);
                const data = prices[itemName] || [];
                const item = items.find(i=>i.name===itemName);
                const ls = item ? item.lotSize : 1;
                const pricePerUnit = data.length>0 ? data[data.length-1].sell/ls : 0;
                const value = totalQty * pricePerUnit;
                s += `${g.text}: на складе ${totalQty} шт на ${value.toFixed(0)} голды`;
                if (value >= g.target) s += ' ✅ ГОТОВО К ПРОДАЖЕ';
                else s += ` (не хватает ${(g.target-value).toFixed(0)})`;
                s += '\n';
            } else if (g.text.startsWith('📥')) {
                // Купить предмет
                const itemName = g.item || '';
                const data = prices[itemName] || [];
                const item = items.find(i=>i.name===itemName);
                const ls = item ? item.lotSize : 1;
                const pricePerUnit = data.length>0 ? data[data.length-1].buy/ls : 0;
                const maxQty = pricePerUnit > 0 ? Math.floor(balance / pricePerUnit) : 0;
                s += `${g.text}: цена ${pricePerUnit.toFixed(2)}/шт, можешь купить ${maxQty} шт на ${balance.toFixed(0)} голды`;
                if (balance >= g.target) s += ' ✅ ХВАТАЕТ';
                else s += ` (не хватает ${(g.target-balance).toFixed(0)})`;
                s += '\n';
            }
        });
    }
    
    if (trades.length > 0) {
        const tp = trades.reduce((a,b)=>a+b.profit,0);
        s += `\nСделок: ${trades.length}, прибыль: ${tp.toFixed(0)}\n`;
    }
    
    return s;
}

async function askAdvisor() {
    const input = document.getElementById('advisorInput');
    const chat = document.getElementById('advisorChat');
    const msg = input.value.trim();
    if (!msg) return;
    
    chat.innerHTML += `<p style="color:#888;margin:4px 0;">👤 ${msg}</p>`;
    const loadingEl = document.createElement('p');
    loadingEl.style.cssText = 'color:#888;margin:4px 0;';
    loadingEl.textContent = '⏳ Анализирую...';
    chat.appendChild(loadingEl);
    chat.scrollTop = chat.scrollHeight;
    input.value = '';
    
    const summary = getMarketSummary();
    const systemPrompt = `Ты — OWL, торговый советник в Crossout Mobile. Стиль: деловой, краткий (2-5 предложений). Видишь рынок, склад, цели, события. Для каждой цели предлагаешь КОНКРЕТНЫЙ ПЛАН действий. Напоминаешь что моды мешают продаже. Не пишешь "как ИИ".`;
    
    advisorHistory = advisorHistory.slice(-10);
    advisorHistory.push({ role: 'user', content: msg });
    localStorage.setItem('wl_advisor_history', JSON.stringify(advisorHistory));
    
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
                model: 'openrouter/owl-alpha',
                messages: [{ role: 'system', content: systemPrompt + '\n\n' + summary }, ...advisorHistory],
                temperature: 0.5,
                max_tokens: 250
            })
        });
        const data = await resp.json();
        const reply = data?.choices?.[0]?.message?.content?.trim() || 'Нет ответа.';
        advisorHistory.push({ role: 'assistant', content: reply });
        localStorage.setItem('wl_advisor_history', JSON.stringify(advisorHistory));
        loadingEl.remove();
        chat.innerHTML += `<p style="color:var(--accent);margin:4px 0;">🦉 ${reply}</p>`;
    } catch(e) {
        loadingEl.remove();
        chat.innerHTML += `<p style="color:var(--danger);margin:4px 0;">❌ Ошибка связи</p>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

function renderAdvisor() {
    const chat = document.getElementById('advisorChat');
    if (!chat) return;
    if (advisorHistory.length === 0) {
        chat.innerHTML = '<p style="color:var(--accent);">🦉 Я вижу твой рынок, склад и цели. Спроси что делать.</p>';
        return;
    }
    chat.innerHTML = advisorHistory.map(m => {
        if (m.role === 'user') return `<p style="color:#888;margin:4px 0;">👤 ${m.content}</p>`;
        return `<p style="color:var(--accent);margin:4px 0;">🦉 ${m.content}</p>`;
    }).join('');
    chat.scrollTop = chat.scrollHeight;
}
