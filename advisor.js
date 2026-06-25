// Wasteland Market Terminal — advisor.js v2 (сохранение истории)
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
            const data = prices[st.item] || [], price = data.length>0?data[data.length-1].sell:0;
            const item = items.find(i=>i.name===st.item), ls = item?item.lotSize:1;
            const val = price * st.qty; tv += val;
            const inv = (st.buyPrice||0) * st.qty;
            const prof = val - inv;
            s += `${st.item} ×${st.qty}: вложено ${inv.toFixed(0)}, сейчас ${val.toFixed(0)} (${prof>=0?'+':''}${prof.toFixed(0)})${st.modded?' [МОД]':''}\n`;
        });
        s += `Оценка склада: ${tv.toFixed(0)} голды\n`;
    } else s += '\nСклад пуст\n';
    
    const ae = getActiveEvent();
    if (ae) s += `\nТекущее событие: ${ae.type} (до ${ae.end})\n`;
    
    if (goals.length > 0) {
        s += '\nЦЕЛИ:\n';
        goals.forEach(g => s += `${g.text} (${balance.toFixed(0)}/${g.target.toFixed(0)})\n`);
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
    const systemPrompt = `Ты — OWL, торговый советник в Crossout Mobile. Стиль: деловой, краткий (2-5 предложений). Видишь рынок, склад, цели, события. Даёшь конкретные советы с цифрами. Напоминаешь что моды мешают продаже. Для целей предлагаешь план. Не пишешь "как ИИ".`;
    
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
