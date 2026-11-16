const QUESTIONS_LIMIT = 20;
let currentQuestions = [];
let currentIndex = 0;
let score = 0;

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
  try {
    const res = await fetch('data/manifest.json');
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
        btn.onclick = () => startQuiz(sub.file);
        container.appendChild(btn);
      });
    });
  } catch (e) {
    document.getElementById('categories-list').textContent = 'Ошибка загрузки manifest.json';
  }
}

// Старт теста
async function startQuiz(filePath) {
  const res = await fetch(filePath);
  const data = await res.json();

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
    quizScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    document.getElementById('score-text').textContent = `Правильных ответов: ${score} из ${currentQuestions.length}`;
  }
};

const goHome = () => {
  quizScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  menuScreen.classList.remove('hidden');
};

document.getElementById('back-btn').onclick = goHome;
document.getElementById('restart-btn').onclick = goHome;

initMenu();
