# MonFinTrack

MonFinTrack is a robust personal finance tracking application designed to help you manage your expenses, income, and budgets with ease. It features a modern, responsive user interface and a powerful backend API.

## 🌟 Features

- **Dashboard**: Overview of your financial health with interactive charts and summaries.
- **Transaction Management**: Add, edit, delete, and categorize transactions.
- **Recurring Transactions**: Set up auto-repeating income or expenses.
- **Subscriptions**: Track monthly subscriptions and recurring bills.
- **Budgets**: Set monthly limits for categories and track your progress.
- **Accounts**: Manage multiple bank accounts and credit cards.
- **Advanced Graphics**: Visual analysis of your spending habits over time.
- **Dark Mode**: Fully supported dark theme for comfortable viewing at night.
- **Security**:
  - Secure Authentication with Firebase.
  - Multi-Factor Authentication (MFA) support with TOTP (Google Authenticator, Authy, etc.).
- **Responsive Design**: Works seamlessly on desktop and mobile devices.

## 🛠️ Tech Stack

### Frontend

- **Framework**: Angular v20
- **UI Library**: PrimeNG v20 & Tailwind CSS
- **Charts**: Chart.js
- **Styling**: SCSS

### Backend

- **Framework**: FastAPI (Python 3.13)
- **Database**: Firebase (Firestore)
### Backend

- **Framework**: FastAPI (Python 3.13)
- **Database**: Firebase (Firestore)
- **Authentication**: Firebase Auth

## ⚙️ CI/CD Configuration

The project is configured with **GitHub Actions** for continuous integration and deployment.

### Secrets Required
To enable automated deployment to Firebase Hosting, you must add the following secret to your GitHub Repository:
1. Go to **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret**.
3. Name: `FIREBASE_TOKEN`
4. Value: The output of running `firebase login:ci` locally.

### Security Rules
The project uses `firestore.rules` and `storage.rules` to enforce strict user data isolation.
- **Firestore**: Users can only access documents in `users/{userId}` and related subcollections.
- **Storage**: Users can only access files in `storage/{userId}/`.

Deploy rules with:
```bash
firebase deploy --only firestore:rules,storage
```

## 🚀 Production Deployment

### Frontend (Firebase Hosting)
The frontend is hosted on **Firebase Hosting**.
1. Navigate to the frontend directory: `cd frontend`
2. Build for production: `npm run build`
3. Deploy: `firebase deploy` (or `cd .. && firebase deploy`)

### Backend (Render)
The backend is hosted on **Render** and configured for auto-deploy via Docker.
- **Push to Main:** Simply push your changes to the `main` branch on GitHub. Render will automatically build the Docker image and deploy it.
- **Manual Start (Local Docker):** See the "Getting Started with Docker" section below.

## 🚀 Getting Started with Docker

The easiest way to run the application is using Docker Compose.

### Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Installation & Running

1. **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/monFinTrack.git
    cd monFinTrack
    ```

2. **Setup Environment Variables:**
    - Place your Firebase `serviceAccountKey.json` in `backend/app/certs/`.
    - Ensure `backend/.env` is configured correctly (should point to the certs).

3. **Start the application:**

    ```bash
    docker-compose up -d --build
    ```

4. **Access the application:**
    - **Frontend**: [http://localhost](http://localhost)
    - **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Stopping the Application

To stop the containers, run:

```bash
docker-compose down
```

## 🧪 Development

### Running Frontend Locally

```bash
cd frontend
npm install
ng serve
```

Access at `http://localhost:4200`.

### Running Tests

#### Frontend Unit Tests (Karma)
```bash
cd frontend
npm test
```
Runs tests in Headless Chrome with increased timeouts for stability.

#### Frontend E2E Tests (Playwright)
```bash
cd frontend
# Install browsers (first time only)
npx playwright install
npm run test:e2e
```
Runs end-to-end login and flow tests.

#### Backend Unit Tests (pytest)
```bash
cd backend
python -m pytest
```

### Running Backend Locally

```bash
cd backend
python -m venv .venv
# Activate venv (Windows: .venv\Scripts\activate, Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Access API at `http://localhost:8000`.

## 📝 License

This project is licensed under the MIT License.
