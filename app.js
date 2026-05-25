const tg = window.Telegram.WebApp;
tg.expand();

console.log('TaskTamer v12 - фикс загрузки');

const CLOUD_KEY = 'tasktamer_sync';

function syncToCloud() {
    const data = JSON.stringify({ tasks, achievements: earnedAchievements });
    tg.CloudStorage.setItem(CLOUD_KEY, data, (err, ok) => {
        console.log(err ? 'Ошибка облака' : '☁️ Сохранено');
    });
    localStorage.setItem('tasktamer_tasks', JSON.stringify(tasks));
    localStorage.setItem('tasktamer_achievements', JSON.stringify(earnedAchievements));
}

function loadStateFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    if (!startParam) {
        console.log('Нет параметра start');
        updateUI();
        updateAchievements();
        return;
    }
    try {
        const binaryStr = atob(startParam.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const jsonStr = new TextDecoder('utf-8').decode(bytes);
        const state = JSON.parse(jsonStr);
        if (state.tasks) {
            tasks = state.tasks;
            localStorage.setItem('taskTamer_tasks', JSON.stringify(tasks));
        }
        if (state.achievements) {
            earnedAchievements = state.achievements;
            localStorage.setItem('taskTamer_achievements', JSON.stringify(earnedAchievements));
        }
        console.log('📦 Загружено из URL:', tasks.length, 'задач');
    } catch(e) {
        console.error('Ошибка URL:', e);
    }
    updateUI();
    updateAchievements();
    checkAndAwardAchievements();
}

function loadFromCloud() {
    tg.CloudStorage.getItem(CLOUD_KEY, (err, val) => {
        if (!err && val) {
            try {
                const data = JSON.parse(val);
                tasks = data.tasks || [];
                earnedAchievements = data.achievements || [];
                console.log('☁️ Загружено из облака:', tasks.length, 'задач');
                updateUI();
                updateAchievements();
                checkAndAwardAchievements();
            } catch(e) {
                console.error(e);
                loadStateFromURL();
            }
        } else {
            console.log('Облако пустое, пробую URL...');
            loadStateFromURL();
        }
    });
}

const ACHIEVEMENTS = [
    { key: "first_task", name: "Первый шаг", icon: "👶", check: () => tasks.length >= 1 },
    { key: "first_complete", name: "Покоритель", icon: "✅", check: () => tasks.filter(t => t.completed).length >= 1 },
    { key: "ten_tasks", name: "Десятка", icon: "🔟", check: () => tasks.length >= 10 },
    { key: "high_rating", name: "Отлично", icon: "🌟", check: () => tasks.some(t => t.rating === 10) },
    { key: "night_owl", name: "Ночная сова", icon: "🦉", check: () => tasks.some(t => { const h = new Date(t.created).getHours(); return h >= 23 || h < 5; }) },
    { key: "speedy", name: "Спринтер", icon: "⚡", check: () => tasks.some(t => t.completed && t.created && t.completed_at && (new Date(t.completed_at) - new Date(t.created)) < 3600000) },
];
let earnedAchievements = [];

function checkAndAwardAchievements() {
    let changed = false;
    ACHIEVEMENTS.forEach(a => {
        if (!earnedAchievements.includes(a.key) && a.check()) {
            earnedAchievements.push(a.key);
            changed = true;
            toast(`🏆 ${a.icon} ${a.name}!`);
        }
    });
    if (changed) { syncToCloud(); updateAchievements(); }
}

function updateAchievements() {
    const grid = document.getElementById('achievementsList');
    if (!grid) return;
    const earnedList = ACHIEVEMENTS.filter(a => earnedAchievements.includes(a.key));
    if (earnedList.length === 0) {
        grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🔒</span><p>Пока нет достижений</p></div>';
        return;
    }
    grid.innerHTML = earnedList.map(a => `
        <div class="achievement-item earned">
            <span class="achievement-icon">${a.icon}</span>
            <span class="achievement-name">${a.name}</span>
        </div>
    `).join('');
}

const RATING_COMMENTS = {
    1: ["Серьёзно? 😂", "Даже бот расстроен...", "Это вообще задача была?", "Ну хоть что-то сделал...", "Позор джунглям 🦥"],
    2: ["Лучше бы Netflix смотрел", "Кот справился бы лучше", "Минус карма", "Ты хоть пытался?", "Пальцем шевельнул?"],
    3: ["Троечка, слабенько", "Ну такое себе...", "Бабушка быстрее делает", "Проснись и пой!", "Даже лень оценивать"],
    4: ["Почти провал, но ок", "На троечку с плюсом", "Старайся... или нет", "Ты можешь хуже!", "Скоро пятница, расслабься"],
    5: ["Серединка на половинку", "Ни рыба ни мясо", "Средний результат", "Ок, но не вау", "Пойдёт для сельской местности"],
    6: ["Уже теплее!", "Почти молодец", "Шестёрочка, неплохо", "Ты на верном пути!", "Продолжай в том же духе"],
    7: ["Хорошо, но не гений", "Крепкий середнячок", "Семёрка! Уважаю", "Лучше, чем вчера", "Ты точно не робот?"],
    8: ["Ого, да ты зверь!", "Восемь из десяти!", "Почти идеально", "Ты меня впечатляешь", "Так держать, чемпион!"],
    9: ["Девяточка! Красава", "Ты реально крут", "Ещё чуть-чуть до идеала", "Моё уважение", "Ты машина!"],
    10: ["ИДЕАЛЬНО! 🏆", "Ты превзошёл себя!", "Бот плачет от счастья", "Лучший результат!", "Достоин отдельной ачивки!"]
};

let tasks = [];
let selectedPeriod = 'day';
let ratingTaskId = null;

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPeriod = btn.dataset.period;
    });
});

document.getElementById('createTaskBtn').addEventListener('click', () => {
    const text = document.getElementById('taskText').value.trim();
    if (!text) { toast('Введи текст задачи!'); return; }
    tasks.unshift({ id: Date.now().toString(), text, period: selectedPeriod, created: new Date().toISOString(), completed: false });
    syncToCloud();
    checkAndAwardAchievements();
    toast('Задача создана ✅');
    document.getElementById('taskText').value = '';
    updateUI();
});

window.toggleTask = function(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (!task.completed) {
        task.completed = true;
        task.completed_at = new Date().toISOString();
        syncToCloud();
        showRating(id);
    } else {
        task.completed = false;
        syncToCloud();
    }
    checkAndAwardAchievements();
    updateUI();
};

function showRating(id) {
    ratingTaskId = id;
    const old = document.querySelector('.rating-modal');
    if (old) old.remove();
    const modal = document.createElement('div');
    modal.className = 'rating-modal';
    modal.innerHTML = `
        <div class="rating-content glass-card">
            <h3>Оцени выполнение</h3>
            <div class="rating-stars">
                ${[1,2,3,4,5,6,7,8,9,10].map(i => `<button class="star-btn" onclick="submitRating(${i})">${i}</button>`).join('')}
            </div>
            <button class="cancel-btn" onclick="closeRating()">Позже</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function submitRating(r) {
    if (!ratingTaskId) return;
    const task = tasks.find(t => t.id === ratingTaskId);
    if (task) {
        task.rating = r;
        task.rated_at = new Date().toISOString();
        const comments = RATING_COMMENTS[r];
        const randomComment = comments[Math.floor(Math.random() * comments.length)];
        syncToCloud();
        toast(`${randomComment} ⭐ ${r}/10`);
        checkAndAwardAchievements();
    }
    closeRating();
    updateUI();
}

function closeRating() {
    const modal = document.querySelector('.rating-modal');
    if (modal) modal.remove();
    ratingTaskId = null;
}

function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
}

function getRatingStars(rating) {
    if (!rating) return '';
    const count = Math.ceil(rating / 2);
    const color = rating >= 9 ? '#ff6b6b' : rating >= 7 ? '#ffd93d' : rating >= 5 ? '#6bcf7f' : '#6b7fcf';
    return `<span style="color:${color}">${'⭐'.repeat(count)}</span> <span style="font-size:12px;color:${color}">${rating}/10</span>`;
}

function getPeriodIcon(period) {
    return period === 'day' ? '☀️' : period === 'week' ? '📅' : '🌙';
}

function updateUI() {
    const list = document.getElementById('tasksList');
    if (!list) return;
    if (!tasks.length) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">🎈</span><p>Пока задач нет.</p></div>';
    } else {
        list.innerHTML = tasks.map((t,i) => `
            <div class="task-item ${t.completed ? 'completed' : ''}" style="animation-delay:${i*0.05}s">
                <div class="task-checkbox ${t.completed ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
                <div style="flex:1">
                    <div style="font-weight:500">
                        <span style="margin-right:6px">${getPeriodIcon(t.period)}</span>
                        ${t.text}
                    </div>
                    ${t.rating ? `<div style="margin-top:4px">${getRatingStars(t.rating)}</div>` : ''}
                </div>
            </div>
        `).join('');
    }
    document.getElementById('totalTasks').innerHTML = `📋 ${tasks.length}`;
    document.getElementById('completedTasks').innerHTML = `✅ ${tasks.filter(t => t.completed).length}`;
    const rated = tasks.filter(t => t.rating);
    document.getElementById('avgRating').innerHTML = `⭐ ${rated.length ? (rated.reduce((s,t) => s + t.rating, 0) / rated.length).toFixed(1) : '0'}`;
}

const style = document.createElement('style');
style.textContent = `
    .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(168,85,247,0.9);color:white;padding:12px 24px;border-radius:12px;font-size:14px;z-index:9999;transition:opacity 0.3s;pointer-events:none}
    .rating-modal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9998}
    .rating-content{text-align:center;padding:24px;max-width:300px;width:90%}
    .rating-content h3{margin-bottom:16px;color:#fff}
    .rating-stars{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:16px}
    .star-btn{width:40px;height:40px;border:1px solid rgba(255,255,255,0.2);border-radius:50%;background:rgba(255,255,255,0.1);color:white;font-size:16px;cursor:pointer}
    .star-btn:active{background:rgba(168,85,247,0.5)}
    .cancel-btn{padding:8px 16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;cursor:pointer}
`;
document.head.appendChild(style);

loadFromCloud();
