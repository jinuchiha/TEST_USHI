# RecoVantage — Intelligent Debt Recovery CRM

A comprehensive CRM platform for managing debt recovery operations, built with React, TypeScript, and Vite. Features role-based dashboards for officers, managers, CEOs, and finance teams with built-in AI-powered analytics, case prioritization, and workflow automation.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Recharts
- **Backend:** NestJS, TypeORM, PostgreSQL, Socket.io
- **AI Engine:** Custom algorithmic scoring and analytics (no external APIs)
- **Deployment:** Docker, Kubernetes, Nginx

## Getting Started

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## Production Build

```bash
npm run build
npm run preview
```

## Docker

```bash
docker-compose up --build
```

## Features

- Multi-role dashboards (Officer, Manager, CEO, Finance, HR)
- Case management with full audit trail
- Team allocation and workload balancing
- Payment tracking and verification
- AI-powered recovery scoring and case prioritization
- Real-time notifications and collaboration
- Kanban board and work queue
- Custom report builder
- Debtor portal
- HR attendance and productivity tracking
- Workflow automation engine
- Bank draft and liability email management
