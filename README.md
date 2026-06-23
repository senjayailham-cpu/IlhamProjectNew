# Austin Batam Portal - Manufacturing Projects Management

A fully featured manufacturing project management system for Austin Batam.

## Setup & Configuration

1. Copy `firebase-applet-config.example.json` under the root directory and rename it to `firebase-applet-config.json`.
2. Open `firebase-applet-config.json` and replace the placeholder fields with your actual Firebase Web app configuration values (API Key, Project ID, App ID, etc.).
3. To setup your environment variables, copy `.env.example` to `.env` and fill in necessary fields.
4. Run `npm install` to install dependencies.
5. Launch the live developer environment using `npm run dev`.

## Features
- Real-time Firestore synchronization and robust rule protections.
- Daily Timesheet logging and employee presence checks.
- Sub-assembly planning with Gantt visualisations.
- Quality Control inspections (RFI, fits, visual checks).
- Wire Consumable tracking.
- Interactive Dashboard reports and Excel data exporting.
- Custom inline Toast notification indicators.
