# Traces

Traces is a multi-platform trail and outdoor activity app for discovering trails, tracking hikes, sharing adventures, and supporting safer outdoor experiences. The repo includes a mobile app, a web app, a backend API, shared TypeScript packages, and a wildlife inference service.

## What’s inside

- `apps/mobile` — Expo React Native app for trail discovery, activity tracking, sharing, and location-aware features
- `apps/web` — Vite web app for the browser experience
- `apps/api` — Node.js / Express API with authentication, trails, activities, safety, messaging, and notifications
- `apps/wildlife-inference` — wildlife inference service used by the platform
- `packages/shared-types` — shared TypeScript contracts used across apps
- `packages/ui` — reusable UI primitives and shared components

## Key features

- Trail discovery and recommendations
- Activity tracking and trail completion flows
- Safety-aware trail and access tools
- Social sharing, comments, likes, and feeds
- Push notifications and realtime messaging
- Map-based and location-aware experiences
- English and Arabic support in the mobile app

## Tech stack

- **Mobile:** Expo, React Native, TypeScript
- **Web:** React, Vite
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL
- **Maps and location:** Mapbox, Expo Location
- **Realtime:** Socket.IO
- **Notifications:** Expo Notifications, Firebase

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL
- Expo CLI / Expo dev client for mobile development
