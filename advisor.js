// Wasteland Market Terminal — advisor.js (советник OWL)
let advisorHistory = [];

function getKey() {
    return atob('c2stb3ItdjEtODM0OGE1YmYzOGRiMTYyZGNmZGQxNTRkYjExYmEwYTA2NGY2YmRiNDg5M2Y0ZjMwMDNlNzY3ZTcyOTkxNDY3Ng==');
}

function getMarketSummary() {
    let s = 'ТЕРМИНАЛ WASTELAND MARKET — ПОЛНЫЙ ОТЧЁТ\n\n';
    s += `💰 Баланс: ${balance.toFixed(0)} голды\n📦 Предметов на рынке: ${items.length}\n`;
    const withData = items.filter(i => (prices[i.name]||[]).length >= 3);
    if (withData.length > 0) {
        s += '\n📊 ТРЕНДЫ:\n';
        withData.forEach(i => {
            const p = getPrediction(i.name);
            s += `${i.name} (×${i.lotSize}): ср.${p.avgBuy.toFixed(1)}/шт, ${p.slope>0.1?'↗':p.slope<-0.1?'↘':'→'} ${p.slope.toFixed(2)}/ч, vol:${p.volatility.toFixed(2)}, увер:${(p.confidence*100).toFixed(0)}%\n`;
        });
    }
    if (storageItems.length > 0) {
        s += '\n🏭 СКЛАД:\n';
        let tv = 0, ti = 0;
        storageItems.forEach(st => {
            const data = prices[st.item] || [], price = data.length>0?data[data.length-1].sell:0;
            const item = items.find(i=>i.name===st.item), ls = item?item.lotSize:1;
            const val = price*st.qty/ls; tv += val; ti += st.buyPrice*st.qty;
            s += `${st.item} ×${st.qty} (куп:${st.buyPrice}, тек:${val.toFixed(0)})${st.modded?' [мод]':''}\n`;
        });
        s += `Оценка: ${tv.toFixed(0)} (${ti>0?((tv-ti)/ti*100).toFixed(1):0}%)\n`;
    } else s += '\n🏭 СКЛАД: пуст\n';
    const ae = getActiveEvent();
    if (ae) s += `\n📅 Текущее событие: ${ae.type} (до ${ae.end})\n`;
    if (goals.length > 0) { s += '\n🎯 ЦЕЛИ:\n'; goals.forEach(g => s += `${g.text}: ${g.current.toFixed(0)}/${g.target.toFixed(0)} (${(g.current/g.target*100).toFixed(0)}%)\n`); }
    if (trades.length > 0) { const tp = trades.reduce((a,b)=>a+b.profit,0), wr = trades.filter(t=>t.profit>0).length/trades.length*100; s += `\n💰 Сделок: ${trades.length}, успех: ${wr.toFixed(0)}%, прибыль: ${tp.toFixed(0)}\n`; }
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
    const systemPrompt = `Ты — OWL, торговый советник в игре Crossout Mobile. Твой стиль: деловой, краткий, конкретный. Ты видишь полный отчёт о рынке игрока.

ПРАВИЛА:
- Отвечай 2-5 предложениями
- Давай конкретные цифры и рекомендации
- Учитывай события (фабрика, рейтинг, БП) и их влияние на цены
- Если предмет с модом — напоминай что продажа невыгодна (нужно снять мод)
- Если есть цель — предлагай план её достижения
- Если тренд падает — говори что покупать
- Если тренд растёт — говори что продавать
- Не пиши "как ИИ" или "я думаю" — просто давай совет
- Если данных мало — скажи об этом и предложи записывать цены чаще`;
    
    advisorHistory = advisorHistory.slice(-5);
    advisorHistory.push({ role: 'user', content: msg });
    
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
        loadingEl.remove();
        chat.innerHTML += `<p style="color:var(--accent);margin:4px 0;">🦉 ${reply}</p>`;
    } catch(e) {
        loadingEl.remove();
        chat.innerHTML += `<p style="color:var(--danger);margin:4px 0;">❌ Ошибка связи. Попробуй позже.</p>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

function renderAdvisor() {
    const chat = document.getElementById('advisorChat');
    if (chat && chat.children.length === 0) {
        chat.innerHTML = '<p style="color:var(--accent);">🦉 Я вижу твой рынок, склад и цели. Спроси что делать.</p>';
    }
}
