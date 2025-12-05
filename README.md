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
- **Authentication**: Firebase Auth

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
