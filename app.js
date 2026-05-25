const tg = window.Telegram.WebApp;
tg.expand();

console.log('TaskTamer app.js загружен');

// === Восстановление данных из URL (синхронизация) ===
const urlParams = new URLSearchParams(window.location.search);
const startParam = urlParams.get('start');
if (startParam) {
    try {
        const decoded = atob(startParam.replace(/-/g, '+').replace(/_/g, '/'));
        const state = JSON.parse(decoded);
        if (state.tasks) {
            localStorage.setItem('taskTamer_tasks', JSON.stringify(state.tasks));
            console.log('Задачи восстановлены из URL:', state.tasks.length);
        }
        if (state.achievements) {
            localStorage.setItem('taskTamer_achievements', JSON.stringify(state.achievements));
            console.log('Достижения восстановлены:', state.achievements);
        }
    } catch(e) {
        console.error('Ошибка восстановления состояния:', e);
    }
}

// === Достижения ===
const ACHIEVEMENTS = [
    { key: "first_task", name: "Первый шаг", desc: "Создайте первую задачу", icon: "👶", check: (stats) => stats.total >= 1 },
    { key: "first_complete", name: "Покоритель", desc: "Выполните первую задачу", icon: "✅", check: (stats) => stats.completed >= 1 },
    { key: "ten_tasks", name: "Десятка", desc: "Создайте 10 задач", icon: "🔟", check: (stats) => stats.total >= 10 },
    { key: "fifty_tasks", name: "Полтинник", desc: "Создайте 50 задач", icon: "🪙", check: (stats) => stats.total >= 50 },
    { key: "high_rating", name: "Отлично", desc: "Оцените выполнение на 10 баллов", icon: "🌟", check: (stats) => stats.avgRating == 10 },
    { key: "perfect_week", name: "Идеальная неделя", desc: "Выполните 7 задач подряд", icon: "🔥", check: (stats) => stats.streak >= 7 },
    { key: "night_owl", name: "Ночная сова", desc: "Создайте задачу после 23:00", icon: "🦉", check: (stats) => stats.nightOwl },
    { key: "speedy", name: "Спринтер", desc: "Выполните задачу в течение часа", icon: "⚡", check: (stats) => stats.speedy },
    { key: "collector", name: "Коллекционер", desc: "Получите 5 разных достижений", icon: "🏅", check: (stats, earned) => earned.length >= 5 },
    { key: "comeback", name: "Возвращение", desc: "Вернитесь после 3 дней", icon: "👋", check: (stats) => stats.comeback },
];
let earnedAchievements = JSON.parse(localStorage.getItem('taskTamer_achievements') || '[]');

function updateAchievements() {
    const grid = document.getElementById('achievementsList');
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

function checkAndAwardAchievements() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const ratings = tasks.filter(t => t.rating).map(t => t.rating);
    const avgRating = ratings.length ? ratings.reduce((a,b) => a + b, 0) / ratings.length : 0;
    const streak = parseInt(localStorage.getItem('taskTamer_streak') || '0');
    const nightOwl = tasks.some(t => {
        const hour = new Date(t.created).getHours();
        return hour >= 23 || hour < 5;
    });
    const speedy = tasks.some(t => {
        if (t.completed && t.created && t.completed_at) {
            const created = new Date(t.created);
            const completedAt = new Date(t.completed_at);
            return (completedAt - created) / 1000 < 3600;
        }
        return false;
    });
    const comeback = localStorage.getItem('taskTamer_comeback') === 'true';

    const stats = { total, completed, avgRating, streak, nightOwl, speedy, comeback };

    ACHIEVEMENTS.forEach(a => {
        if (!earnedAchievements.includes(a.key) && a.check(stats, earnedAchievements)) {
            earnedAchievements.push(a.key);
            try {
                tg.sendData(JSON.stringify({ action: 'achievement_unlocked', key: a.key }));
            } catch(e) {}
        }
    });
    localStorage.setItem('taskTamer_achievements', JSON.stringify(earnedAchievements));
    updateAchievements();
}

// === Задачи ===
let tasks = JSON.parse(localStorage.getItem('taskTamer_tasks') || '[]');
let selectedPeriod = 'day';

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPeriod = btn.dataset.period;
    });
});

document.getElementById('createTaskBtn').addEventListener('click', () => {
    const text = document.getElementById('taskText').value.trim();
    if (!text) {
        alert('Введи текст задачи!');
        return;
    }
    const task = {
        id: Date.now().toString(),
        text,
        period: selectedPeriod,
        created: new Date().toISOString(),
        completed: false
    };
    tasks.unshift(task);
    localStorage.setItem('taskTamer_tasks', JSON.stringify(tasks));

    try {
        tg.sendData(JSON.stringify({
            action: 'task_created',
            task_id: task.id,
            task_text: task.text,
            period: task.period
        }));
    } catch (e) {
        alert('Ошибка отправки: ' + e.message);
    }

    document.getElementById('taskText').value = '';
    checkAndAwardAchievements();
    updateUI();
});

function updateUI() {
    const list = document.getElementById('tasksList');
    if (tasks.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">🎈</span><p>Пока задач нет.</p></div>';
    } else {
        list.innerHTML = tasks.map((t,i) => `
            <div class="task-item ${t.completed ? 'completed' : ''}" style="animation-delay:${i*0.05}s">
                <div class="task-checkbox ${t.completed ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
                <div style="flex:1"><div style="font-weight:500">${t.text}</div></div>
            </div>
        `).join('');
    }
    document.getElementById('totalTasks').textContent = tasks.length;
    document.getElementById('completedTasks').textContent = tasks.filter(t => t.completed).length;
    const rated = tasks.filter(t => t.rating);
    const avg = rated.length ? (rated.reduce((s,t) => s + t.rating, 0) / rated.length).toFixed(1) : '0';
    document.getElementById('avgRating').textContent = avg;
}

window.toggleTask = function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    task.completed = !task.completed;
    if (task.completed) {
        task.completed_at = new Date().toISOString();
    }
    localStorage.setItem('taskTamer_tasks', JSON.stringify(tasks));
    if (task.completed) {
        try {
            tg.sendData(JSON.stringify({ action: 'task_completed', task_id: task.id }));
        } catch (e) {}
    }
    checkAndAwardAchievements();
    updateUI();
};

// Первичная проверка достижений и обновление UI
checkAndAwardAchievements();
updateUI();
