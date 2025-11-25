# MonFinTrack

MonFinTrack is a personal finance tracking application. This repository contains both the backend (FastAPI) and frontend (Angular) code.

## 🚀 Getting Started with Docker

The easiest way to run the application is using Docker Compose.

### Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/monFinTrack.git
    cd monFinTrack
    ```

2.  **Setup Environment Variables:**
    Ensure you have the `serviceAccountKey.json` from Firebase placed in `backend/app/certs/`.
    
    The `backend/.env` file is automatically configured to use this key within the container.

3.  **Start the application:**
    ```bash
    docker-compose up -d --build
    ```

4.  **Access the application:**
    - **Frontend:** [http://localhost](http://localhost)
    - **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

### Stopping the Application

To stop the containers, run:
```bash
docker-compose down
```

## 📂 Project Structure

- `backend/`: FastAPI application
- `frontend/`: Angular application
- `docker-compose.yml`: Docker orchestration configuration
