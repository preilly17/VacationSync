# TripSync - Vacation Group Calendar App

## Overview
TripSync is a collaborative vacation calendar application enabling groups to plan trips together. It allows members to create activities, accept or decline proposals, and maintain personalized schedules of confirmed activities. The app aims to be a comprehensive planning tool, blending features of calendar and event management for vacation groups, streamlining coordination and enhancing the group travel experience.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **UI Framework**: shadcn/ui on Radix UI
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Form Handling**: React Hook Form with Zod

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js (REST API endpoints)
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL store
- **Real-time**: WebSocket server
- **Validation**: Zod schemas

### Database Design
- **Primary Database**: PostgreSQL via Neon serverless
- **Key Tables**: `users`, `trip_calendars`, `trip_members`, `activities`, `activity_acceptances`, `activity_comments`, `sessions`.

### Key Features
- **Authentication**: Replit Auth, PostgreSQL-backed sessions, user management, route protection.
- **Trip Management**: Creation, unique share codes, multi-organizer support, dynamic membership.
- **Activity System**: Proposal model, rich details (name, description, location, cost, capacity, categories), response tracking, comments.
- **Calendar Views**: Shared trip calendar and personalized schedules.
- **UI/UX**: Travel-themed interface with animations, vertical sidebar navigation, mobile responsiveness, playful loading animations, and smart location autofill.
- **Notifications**: Real-time notifications for new members, activity postings, and payment obligations.
- **Expense Splitting**: Checkbox-based member selection, real-time split calculation, and payment app integration (CashApp, Venmo).
- **Onboarding**: Interactive tutorial system for new users and trip creators.
- **Flight Management**: Comprehensive flight coordination with manual entry forms, edit/delete functionality, smart location auto-population, and flight search interface.
- **Booking Integration**: Search and booking integration for hotels, activities, and restaurants with multi-platform support.
- **Trip Deletion**: Creator-only trip deletion with comprehensive data cleanup.
- **Packing List**: Collaborative and categorized packing list.

## External Dependencies
### Authentication
- Replit Auth
- connect-pg-simple
- passport

### Database
- @neondatabase/serverless
- drizzle-orm
- drizzle-kit

### UI Framework
- @radix-ui/
- shadcn/ui
- tailwindcss
- lucide-react

### Development Tools
- vite
- typescript
- eslint/prettier

### Third-party APIs/Services
- Amadeus (Flights, Hotels, Activities, Location Database)
- Duffel NDC API
- Foursquare Places API v3 (Restaurants)
- Booking.com (Scraping for Hotels)
- Hotels.com (Scraping for Hotels)
- Kayak (Scraping for Flights)
- Expedia (Scraping for Flights)
- Google Flights (Scraping for Flights)
- Skyscanner (Booking Platform)
- Momondo (Booking Platform)
- Priceline (Booking Platform)
- CheapOair (Booking Platform)
- GetYourGuide (Activities)
- Viator (Activities)