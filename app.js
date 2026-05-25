const tg = window.Telegram.WebApp;
tg.expand();

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
        alert('Задача отправлена боту!');
    } catch (e) {
        alert('Ошибка отправки: ' + e.message);
    }
    
    document.getElementById('taskText').value = '';
    updateUI();
});

function updateUI() {
    const list = document.getElementById('tasksList');
    if (tasks.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">🎈</span><p>Пока задач нет.</p></div>';
    } else {
        list.innerHTML = tasks.map((t,i) => 
            <div class="task-item " style="animation-delay:s">
                <div class="task-checkbox " onclick="toggleTask('')"></div>
                <div style="flex:1"><div style="font-weight:500"></div></div>
            </div>
        ).join('');
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
    localStorage.setItem('taskTamer_tasks', JSON.stringify(tasks));
    if (task.completed) {
        try {
            tg.sendData(JSON.stringify({ action: 'task_completed', task_id: task.id }));
            alert('Выполнение отмечено!');
        } catch (e) {
            alert('Ошибка отправки: ' + e.message);
        }
    }
    updateUI();
};

updateUI();
