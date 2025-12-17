# MonFinTrack Frontend

This is the frontend for the MonFinTrack application, a personal finance tracker. It is built with Angular.

## Technologies Used

- Angular
- TypeScript
- SCSS
- PrimeNG
- ngx-markdown

## 🚀 Deployment

The application is configured for deployment to **Firebase Hosting**.

1.  **Build:**
    ```bash
    npm run build
    ```
    This generates the production artifacts in `dist/frontend/browser`.

2.  **Deploy:**
    From the root directory (where `firebase.json` resides):
    ```bash
    firebase deploy
    ```

## Getting Started

### Prerequisites

- Node.js and npm (or yarn)

### Installation

1.  Navigate to the `frontend` directory.
2.  Install the dependencies:
    ```bash
    npm install --legacy-peer-deps
    ```

### Running the Application

1.  Run the development server:
    ```bash
    ng serve
    ```
2.  Open your browser and navigate to `http://localhost:4200/`.

## Folder Structure

- `src/`: Contains the main application code.
- `src/app/`: Contains the core Angular components, services, and routes.
- `src/assets/`: For static assets like images and fonts.
- `src/environments/`: For environment-specific configuration.
