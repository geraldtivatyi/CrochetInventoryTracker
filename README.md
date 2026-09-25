# Crochet Inventory Tracker

A full-stack inventory and pricing management application for a crochet business. The project helps track yarn stock, estimate project costs, manage business activity, and calculate profitable pricing in South African Rand (ZAR).

## Why this project
This application was built to solve a real operational problem: running a handmade craft business requires fast, accurate inventory visibility and reliable pricing decisions. I wanted a tool that could centralize inventory, project planning, and pricing calculations while keeping the workflow simple enough to use in a busy business setting.

## Core features
- Dashboard with business overview and low-stock alerts
- Inventory management for yarn records, colors, costs, and stock quantity
- Project templates with yarn requirements and estimated completion times
- Pricing calculator with labor, materials, and markup logic
- Activity tracking for operational visibility
- Persistent PostgreSQL storage via Drizzle ORM

## Tech stack
- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Backend: Express.js, TypeScript
- Database: PostgreSQL with Drizzle ORM
- State management: TanStack Query
- Validation: React Hook Form + Zod

## AI-assisted development note
This project was developed with AI as an efficiency amplifier rather than a replacement for engineering judgment. AI was especially useful for:
- scaffolding and project setup
- accelerating debugging and error diagnosis
- improving development speed around TypeScript, build configuration, and backend integration
- suggesting refactors and clarifying implementation options

I used AI to speed up infrastructure setup and debugging workflows, but I made the final product decisions and manually implemented the features, data model changes, UI updates, validation logic, and business rules. The project reflects my own engineering work, not a purely generated result.

## Manual implementation and ownership
The features in this app were not simply accepted from generated output. I manually built and refined:
- the inventory CRUD flows
- the pricing and markup calculations
- dashboard logic and activity tracking
- project-related workflows and navigation
- validation and UX improvements
- persistence and database integration

## Project highlights
- Migrated from in-memory storage to PostgreSQL for real persistence
- Updated pricing logic to South African Rand formatting and business assumptions
- Added project-specific yarn color integration and improved calculation workflows
- Improved the app’s UX through validation and UI refinement

## Local development
```bash
npm install
npm run dev
```

## Notes for interview use
This project demonstrates a practical full-stack workflow: translating a business need into a working product, connecting frontend and backend systems, handling data persistence, and iterating quickly through debugging and feature refinement. It also highlights a mature mindset around AI usage: using it to increase velocity while still taking ownership of architecture, implementation, and product quality.

For additional context on how AI was used in this project, see [AI_DEVELOPMENT_NOTES.md](AI_DEVELOPMENT_NOTES.md).