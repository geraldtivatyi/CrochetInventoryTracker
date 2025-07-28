# Crochet Business Inventory Management App

A comprehensive fullstack application for managing a crochet business. Built with React frontend and Express backend, featuring persistent PostgreSQL database storage.

## Overview
This app helps crochet businesses track yarn inventory, project templates, calculate pricing with labor costs, and monitor business activity. All pricing is displayed in South African Rands (ZAR).

## Features
- **Dashboard**: Business overview with stats, low stock alerts, and recent activity
- **Inventory Management**: Track yarn types, colors, costs, and stock levels
- **Project Templates**: Store project requirements and estimated completion times
- **Price Calculator**: Automatic pricing calculations including materials, labor, markup, and optional rounding
- **Activity Logging**: Track all business operations and changes

## Tech Stack
- Frontend: React, TypeScript, Tailwind CSS, shadcn/ui components
- Backend: Express.js, TypeScript
- Database: PostgreSQL with Drizzle ORM
- State Management: TanStack Query
- Forms: React Hook Form with Zod validation

## Recent Changes
- Successfully migrated from in-memory storage to PostgreSQL database
- All data now persists between app restarts
- **Updated all pricing to South African Rands (ZAR)**:
  - Currency formatting changed from USD to ZAR
  - Sample yarn prices converted to realistic Rand amounts (R81-R149 per ball)
  - Default hourly rate updated to R225 
  - Form validation messages updated to reference Rands
  - Database re-seeded with ZAR pricing
- App deployed and functional with persistent storage
- **Enhanced Projects page with yarn color integration**:
  - Project cards now display actual yarn colors with color circles
  - Project forms show yarn colors in selection dropdown
  - Added "Add New Yarn" functionality directly from project forms
  - Smart matching between projects and inventory yarns
- **Updated Calculator with project integration**:
  - Default markup changed from 40% to 5% for all calculations
  - Added "Update Project Pricing" button to save calculations back to projects
  - Calculator updates project time/materials and stores calculated price in notes