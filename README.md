# Traces

Traces is a hiking platform for Palestine with an Expo mobile client, Express API, shared types, and a reusable UI package.

## Apps

- `apps/mobile`: Expo + React Native + Zustand + React Navigation + Mapbox
- `apps/api`: Express + TypeScript + PostgreSQL/PostGIS

## Packages

- `packages/shared-types`: API/domain contracts
- `packages/ui`: shared React components

## Quick Start

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:mobile
```
