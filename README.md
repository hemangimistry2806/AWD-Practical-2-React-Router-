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

### Email notifications

Email notifications use Nodemailer with React Email templates. Configure these backend-only variables in `.env`:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
MAIL_TO=
MAIL_CC=
MAIL_BCC=
```

`MAIL_TO`, `MAIL_CC`, and `MAIL_BCC` accept comma-separated additional recipients for task and logout notifications. Login confirmations are sent only to the authenticated account's email address from MongoDB. Keep `.env` private; SMTP credentials are never exposed to the React frontend. If SMTP variables are missing or sending fails, the server logs the email problem and the authentication/task API operation still succeeds.

Run the project with:

```bash
npm install
npm run dev
```

The API runs on port `5000` and Vite runs on port `5173`. Task-created, task-completed, task-pending transition, login, and logout notifications are sent asynchronously. Pending notifications are sent only when a task changes into `pending`, avoiding duplicate notifications for repeated pending updates.

### Administrator activity reports

The `/admin/reports` page and its report APIs require a signed-in user with the `admin` role. New registrations receive the `user` role; promote trusted accounts manually from the MongoDB shell:

```javascript
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin" } }
);
```

The activity report filters the existing `activity_logs` collection by its `createdAt` field. Start and end dates are UTC calendar days and both days are included. The report provides paginated records, date-range totals, and a streaming CSV export. Export columns omit email addresses, IP addresses, and browser details. Both the report and CSV endpoint enforce administrator authorization on the server.

## Practical 8: Performance Optimization and Lazy Loading

### Objective

Implement route-based code splitting in the existing React Task Management application using `React.lazy()` and `Suspense`, without changing existing functionality, backend APIs, database logic, or UI design.

### What Was Changed

* `Projects` route is lazy-loaded.
* `Contact` route is lazy-loaded.
* `Tasks` route is lazy-loaded as one additional heavier component because it contains authentication flow, API requests, SweetAlert dialogs, filtering, CSV/PDF actions, and activity log rendering.
* The existing `<Routes>` section is wrapped in `<Suspense>`.
* A simple `Loading page...` fallback UI is displayed while a lazy route chunk is loading.

### React.lazy()

`React.lazy()` lets React load a component only when it is needed. Instead of importing all route components in the first JavaScript bundle, the route component is imported dynamically:

```jsx
const Projects = lazy(() => import("./pages/Projects"));
```

This allows Vite to create a separate JavaScript chunk for that route.

### Suspense

`Suspense` shows fallback UI while the lazy-loaded component is being downloaded and prepared:

```jsx
<Suspense fallback={<div className="page-loading">Loading page...</div>}>
  <Routes>
    ...
  </Routes>
</Suspense>
```

### Why Lazy Loading Improves Performance

Lazy loading reduces the amount of JavaScript needed during the first page load. The browser can load the initial page sooner, and route code for pages like Projects, Contact, and Tasks is downloaded only when the user visits those routes. This improves initial load performance and perceived speed, especially on slower networks.

### Initial Bundle vs Lazy-Loaded Chunks

Before lazy loading, route components imported normally in `App.jsx` are included in the initial application bundle. After lazy loading, Vite can generate separate chunk files for lazy routes. The initial bundle should not contain the complete Projects, Contact, or Tasks route code.

### Before/After Metrics

No baseline measurements were already present in the repository, so the table below is provided for manual measurement instead of using fabricated numbers.

| Metric                 | Before | After |
| ---------------------- | -----: | ----: |
| Initial JS transferred |        |       |
| Main bundle size       |        |       |
| Projects chunk         |        |       |
| Contact chunk          |        |       |
| Tasks chunk            |        |       |
| Initial page load time |        |       |
| Projects route load    |        |       |
| Contact route load     |        |       |
| Tasks route load       |        |       |

### How to Get Metrics

1. Run `npm run build` and note the JavaScript files listed in the build output.
2. Open the app in the browser and open DevTools.
3. Go to the Network tab and filter by JS.
4. Reload the home page and record the initial JavaScript transferred.
5. Navigate to `/projects`, `/contact`, and `/tasks`.
6. Record the lazy chunk downloaded for each route.
7. Use DevTools throttling such as Slow 3G to observe the `Loading page...` fallback.

### DevTools Verification

To verify lazy loading:

* Open Browser DevTools.
* Go to Network.
* Enable Disable cache while DevTools is open.
* Load `/` first and confirm that Projects, Contact, and Tasks chunks are not loaded initially.
* Navigate to `/projects` and confirm that the Projects chunk loads.
* Navigate to `/contact` and confirm that the Contact chunk loads.
* Navigate to `/tasks` and confirm that the Tasks chunk loads.
* Refresh each route directly to confirm the existing Vite/React Router setup still serves the app correctly.

### Slow 3G Fallback Testing

In DevTools Network throttling, select Slow 3G and navigate to a lazy route. The fallback text `Loading page...` should appear briefly while the route chunk downloads.

### Additional Lazy-Loaded Component

The additional lazy-loaded component is `Tasks`. It is a suitable candidate because it is larger than the portfolio pages and includes task authentication, API communication, task list rendering, filtering, export actions, and activity log UI. No artificial heavy dependency was added.

### React DevTools Profiler Observation

Actual React DevTools profiling was not performed in this environment, so no runtime profiler result is claimed. By code inspection, `Tasks` has a realistic unnecessary re-render risk: the status tab counts call `tasks.filter(...)` during render for every status tab. When unrelated local state changes, such as typing in the task editor or toggling the input form, these counts are recalculated even though the `tasks` array may not have changed.

A possible optimization is to use `useMemo` to derive status counts from `tasks`, or split the tab list into a memoized child component. Memoization was not added blindly because the assignment asks to identify the issue without changing unrelated behavior unnecessarily.

### Errors or Issues Encountered

No code issue required backend, database, authentication, or API changes. Baseline performance numbers were not available, so placeholders are documented for manual measurement.

### Conclusion

Practical 8 was implemented by adding route-based code splitting with `React.lazy()` and `Suspense`. The Projects, Contact, and Tasks route code can now be loaded separately, reducing initial bundle work while preserving the existing application behavior.

## Screenshots

<img width="959" height="475" alt="image" src="https://github.com/user-attachments/assets/d2d5b822-308b-45df-9bfd-0231d080cc37" />


<img width="956" height="449" alt="image" src="https://github.com/user-attachments/assets/517c4a8a-12fe-4940-ad33-ab94c2edb576" />


<img width="959" height="440" alt="Screenshot 2026-07-27 193922" src="https://github.com/user-attachments/assets/f953d20a-2c2c-4c08-bab2-5c9a3d230270" />



<img width="957" height="411" alt="Screenshot 2026-08-03 213921" src="https://github.com/user-attachments/assets/eba6ffaf-ebac-4ad3-a8ac-184519fca14f" />


<img width="959" height="477" alt="Screenshot 2026-08-03 213827" src="https://github.com/user-attachments/assets/b639f265-0075-4cbd-99b0-69ac948b2b90" />

<img width="959" height="442" alt="Screenshot 2026-08-03 213811" src="https://github.com/user-attachments/assets/3ccdcdcc-de3d-4bc5-a3a0-22caf38d363d" />
