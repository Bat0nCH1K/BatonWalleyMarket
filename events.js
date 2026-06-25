// Wasteland Market Terminal — events.js v2 (события + цели)
let calendarYear, calendarMonth;

function submitEvent() {
    const start = document.getElementById('eventStart').value;
    const end = document.getElementById('eventEnd').value || start;
    const type = document.getElementById('eventType').value;
    if (!start) return;
    addEvent(start, end, type, '');
    renderEvents();
    initCalendar();
}

function renderEvents() {
    const list = document.getElementById('eventsList');
    if (!list) return;
    if (events.length === 0) { list.innerHTML = '<p style="color:#888;">Нет событий</p>'; return; }
    const emoji = { factory: '🏭', rating_end: '⚔️', battlepass: '🎫', road: '🛣️', raven: '🐦‍⬛', workshop: '🔧', bounty: '🎯' };
    const tagClass = { factory: 'tag-factory', rating_end: 'tag-rating', battlepass: 'tag-battlepass', road: 'tag-road', raven: 'tag-raven', workshop: 'tag-workshop', bounty: 'tag-bounty' };
    list.innerHTML = events.map((e, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border);font-size:0.8em;">
            <span><span class="tag ${tagClass[e.type]||''}">${emoji[e.type]||'📌'}</span> ${e.start} → ${e.end}</span>
            <button class="delete-btn" onclick="deleteEvent(${i});renderEvents();initCalendar();">✕</button>
        </div>
    `).join('');
}

function initCalendar() {
    const now = new Date();
    if (!calendarYear) { calendarYear = now.getFullYear(); calendarMonth = now.getMonth(); }
    renderCalendar();
}

function renderCalendar() {
    const container = document.getElementById('calendarWidget');
    if (!container) return;
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay() || 7;
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    let html = '<div class="calendar-header"><button onclick="changeMonth(-1)">←</button><span>' + new Date(calendarYear, calendarMonth).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) + '</span><button onclick="changeMonth(1)">→</button></div><div class="calendar-grid">';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(d => html += `<div class="calendar-day-name">${d}</div>`);
    for (let i = 1; i < firstDay; i++) html += '<div class="calendar-day other-month"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const hasEvent = events.some(e => e.start <= dateStr && e.end >= dateStr);
        const isToday = dateStr === todayStr;
        let cls = 'calendar-day';
        if (isToday) cls += ' today';
        if (hasEvent) cls += ' has-event';
        html += `<div class="${cls}" onclick="document.getElementById('eventStart').value='${dateStr}'">${day}</div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

function changeMonth(delta) {
    calendarMonth += delta;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    renderCalendar();
}

// === ЦЕЛИ ===
function submitGoal() {
    const text = document.getElementById('goalText').value.trim();
    const target = parseFloat(document.getElementById('goalTarget').value);
    const current = parseFloat(document.getElementById('goalCurrent').value) || 0;
    if (!text || isNaN(target)) { alert('Заполни описание и цель'); return; }
    addGoal(text, target, current);
    document.getElementById('goalText').value = '';
    document.getElementById('goalTarget').value = '';
    document.getElementById('goalCurrent').value = '';
    renderGoals();
}

function renderGoals() {
    const list = document.getElementById('goalsList');
    if (!list) return;
    if (goals.length === 0) { list.innerHTML = '<p style="color:#888;">Нет целей</p>'; return; }
    // Сортировка: сначала невыполненные, по приоритету (чем ближе к цели, тем выше)
    goals.sort((a, b) => {
        const pctA = a.target > 0 ? a.current / a.target : 0;
        const pctB = b.target > 0 ? b.current / b.target : 0;
        if (pctA >= 1 && pctB < 1) return 1;
        if (pctB >= 1 && pctA < 1) return -1;
        return pctB - pctA;
    });
    list.innerHTML = goals.map((g, i) => {
        const pct = Math.min(100, g.target > 0 ? (g.current / g.target) * 100 : 0);
        const done = pct >= 100;
        return `<div class="item-card" style="${done ? 'opacity:0.6;' : ''}">
            <div class="name">${done ? '✅' : '🎯'} ${g.text}</div>
            <div style="font-size:0.8em;">${g.current.toFixed(0)} / ${g.target.toFixed(0)} голды</div>
            <div style="height:6px;background:#1a2a2a;border-radius:3px;margin-top:4px;">
                <div style="height:100%;width:${pct}%;background:${done?'var(--profit)':'var(--accent)'};border-radius:3px;"></div>
            </div>
            <button class="delete-btn" onclick="goals.splice(${i},1);saveAll();renderGoals();">✕</button>
        </div>`;
    }).join('');
            }
