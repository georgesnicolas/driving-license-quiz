# Driving License Quiz

A simple Arabic (RTL) driving-license theory quiz web app. Pure HTML/CSS/JS — open `index.html` in a browser.

## Features

- 342 multiple-choice questions loaded from `questions.js` / `questions.json`.
- Click a question title to briefly reveal the correct answer for 2 seconds.
- Rate each question سهل / متوسط / صعب.
- Finish the exam to see your score and a smart re-ordering of cards:
  wrong-easy → wrong-medium → wrong-hard → wrong-unrated → correct-hard → correct-medium → correct-unrated → unanswered.
- Questions answered correctly and rated easy are marked as **mastered** and hidden on subsequent sessions (persisted in `localStorage`).
- Use the **تحميل كل الأسئلة** button to bring all questions back.

## Run locally

Just open `index.html` in any modern browser. No build step or server required.
