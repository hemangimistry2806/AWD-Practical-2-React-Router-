# React Router Portfolio - 24AIML076

A React-based student portfolio website developed for **Practical 2** demonstrating **React Router** and **State Management using useState**.

## Technologies Used

* React
* Vite
* React Router DOM
* JavaScript
* CSS

## Components

* NavBar
* Home
* Projects
* Contact
* NotFound
* Header
* About
* Skills
* Footer

## Features

* Client-side routing with React Router
* Navigation without page reload
* Home, Projects, Contact, and 404 pages
* Controlled contact form using `useState`
* Dark/Light mode toggle
* Live input updates
* Component-based architecture
* Reusable React components

## Run Project

```bash
npm install

npm run dev
```

## MongoDB Tasks

The `/tasks` page stores tasks in the local MongoDB database `taskdb`, collection `tasks`.
The default connection is `mongodb://127.0.0.1:27017/taskdb`, so start the MongoDB service before running the project. `npm run dev` starts both the Express API on port `5000` and the React app on port `5173`.

Deleted task audit entries are appended to `logs/task-audit.txt`.
Authentication creates the MongoDB collections `users` and `activity_logs`. The task API requires a valid signed-in session, and the Activity button shows login, logout, create, update, and delete history.
The Excel button downloads an Excel-compatible CSV file. The PDF button opens the browser print dialog, where you can choose Save as PDF.

To use another MongoDB instance, copy `.env.example` to `.env` and change `MONGO_URI`.

## Screenshots

<img width="959" height="475" alt="image" src="https://github.com/user-attachments/assets/d2d5b822-308b-45df-9bfd-0231d080cc37" />


<img width="956" height="449" alt="image" src="https://github.com/user-attachments/assets/517c4a8a-12fe-4940-ad33-ab94c2edb576" />


<img width="959" height="440" alt="Screenshot 2026-07-27 193922" src="https://github.com/user-attachments/assets/f953d20a-2c2c-4c08-bab2-5c9a3d230270" />



<img width="957" height="411" alt="Screenshot 2026-08-03 213921" src="https://github.com/user-attachments/assets/eba6ffaf-ebac-4ad3-a8ac-184519fca14f" />


<img width="959" height="477" alt="Screenshot 2026-08-03 213827" src="https://github.com/user-attachments/assets/b639f265-0075-4cbd-99b0-69ac948b2b90" />

<img width="959" height="442" alt="Screenshot 2026-08-03 213811" src="https://github.com/user-attachments/assets/3ccdcdcc-de3d-4bc5-a3a0-22caf38d363d" />

