const QUESTIONS_LIMIT = 20;
const HISTORY_KEY = 'quiz_recent_history';

let currentQuestions = [];
let currentIndex = 0;
let score = 0;
let currentTestTitle = '';

const menuScreen = document.getElementById('menu-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

// Перемешивание массива (алгоритм Фишера-Йейтса)
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Загрузка меню из манифеста
async function initMenu() {
  renderHistory();
  try {
    const res = await fetch(`data/manifest.json?t=${Date.now()}`);
    const data = await res.json();
    const container = document.getElementById('categories-list');
    container.innerHTML = '';

    data.categories.forEach(cat => {
      const catTitle = document.createElement('h3');
      catTitle.textContent = cat.title;
      catTitle.style.marginTop = '20px';
      container.appendChild(catTitle);

      cat.subcategories.forEach(sub => {
        const btn = document.createElement('button');
        btn.textContent = `${sub.title} (${sub.count} вопр.)`;
        btn.onclick = () => startQuiz(sub.file, `${cat.title}: ${sub.title}`);
        container.appendChild(btn);
      });
    });
  } catch (e) {
    document.getElementById('categories-list').textContent = 'Ошибка загрузки manifest.json';
  }
}

// Сохранение результата в localStorage
function saveResult(title, score, total) {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) +
                  ' ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  history.unshift({
    title,
    score,
    total,
    date: dateStr
  });

  // Храним только 10 последних результатов
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
}

// Отрисовка колонки недавних тестов
function renderHistory() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const container = document.getElementById('history-list');
  const clearBtn = document.getElementById('clear-history-btn');

  if (history.length === 0) {
    container.innerHTML = '<div class="meta">Пока нет пройденных тестов</div>';
    clearBtn.classList.add('hidden');
    return;
  }

  clearBtn.classList.remove('hidden');
  container.innerHTML = '';

  history.forEach(item => {
    const percent = Math.round((item.score / item.total) * 100);
    let badgeClass = 'badge-bad';
    if (percent >= 80) badgeClass = 'badge-good';
    else if (percent >= 50) badgeClass = 'badge-mid';

    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-title">${item.title}</div>
      <div class="history-meta">
        <span>${item.date}</span>
        <span class="badge ${badgeClass}">${item.score} / ${item.total} (${percent}%)</span>
      </div>
    `;
    container.appendChild(div);
  });
}

document.getElementById('clear-history-btn').onclick = () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
};

// Старт теста
async function startQuiz(filePath, testTitle) {
  const res = await fetch(filePath);
  const data = await res.json();

  currentTestTitle = testTitle || `${data.category}: ${data.subcategory}`;

  // Берем 20 случайных вопросов и перемешиваем варианты ответов внутри каждого
  currentQuestions = shuffle(data.questions)
    .slice(0, QUESTIONS_LIMIT)
    .map(q => {
      const correctText = q.options[q.correctIndex];
      const shuffledOptions = shuffle(q.options);
      return {
        ...q,
        options: shuffledOptions,
        correctIndex: shuffledOptions.indexOf(correctText)
      };
    });

  currentIndex = 0;
  score = 0;

  menuScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');
  renderQuestion();
}

// Отрисовка вопроса
function renderQuestion() {
  const q = currentQuestions[currentIndex];
  document.getElementById('progress-text').textContent = `Вопрос ${currentIndex + 1} из ${currentQuestions.length}`;
  document.getElementById('question-text').textContent = q.question;

  const optionsList = document.getElementById('options-list');
  optionsList.innerHTML = '';

  const expBox = document.getElementById('explanation-box');
  expBox.classList.add('hidden');
  document.getElementById('next-btn').classList.add('hidden');

  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.onclick = () => handleAnswer(idx, btn);
    optionsList.appendChild(btn);
  });
}

// Проверка ответа
function handleAnswer(selectedIndex, selectedBtn) {
  const q = currentQuestions[currentIndex];
  const buttons = document.getElementById('options-list').querySelectorAll('button');

  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === q.correctIndex) btn.classList.add('correct');
  });

  if (selectedIndex === q.correctIndex) {
    score++;
  } else {
    selectedBtn.classList.add('wrong');
  }

  if (q.explanation) {
    const expBox = document.getElementById('explanation-box');
    expBox.textContent = q.explanation;
    expBox.classList.remove('hidden');
  }

  document.getElementById('next-btn').classList.remove('hidden');
}

document.getElementById('next-btn').onclick = () => {
  currentIndex++;
  if (currentIndex < currentQuestions.length) {
    renderQuestion();
  } else {
    saveResult(currentTestTitle, score, currentQuestions.length);
    quizScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    document.getElementById('score-text').textContent = `Правильных ответов: ${score} из ${currentQuestions.length}`;
  }
};

const goHome = () => {
  renderHistory();
  quizScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  menuScreen.classList.remove('hidden');
};

document.getElementById('back-btn').onclick = goHome;
document.getElementById('restart-btn').onclick = goHome;

initMenu();
