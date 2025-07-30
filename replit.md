# Husovka Má Talent - Voting Application

## Overview

A modern web application for managing the "Husovka Má Talent" talent show, designed for judges and administrators to vote on contestants. Built with React frontend, Express backend, and PostgreSQL database using Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state
- **UI Components**: Radix UI primitives with shadcn/ui components
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite with TypeScript support

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ESM modules
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Session Management**: PostgreSQL session store
- **API Design**: RESTful API endpoints with middleware-based authentication

### Database Architecture
- **Database**: PostgreSQL (configured for Neon serverless)
- **ORM**: Drizzle ORM with TypeScript schema
- **Migrations**: Drizzle Kit for database schema management
- **Connection**: Serverless connection pooling via Neon

## Key Components

### Authentication System
- **User Roles**: Judge and Admin roles with role-based access control
- **Login Flow**: Email/password authentication with separate judge and admin login modals
- **Session Management**: JWT tokens stored in localStorage with automatic token validation

### Voting System
- **Binary Voting**: Simple positive/negative voting mechanism using circular buttons (green/red)
- **Contestant Navigation**: Carousel-style navigation through contestants with previous/next controls
- **Vote Tracking**: Real-time vote recording with immediate feedback via toast notifications

### User Interface
- **Welcome Page**: Landing page with separate login options for judges and admins
- **Judge Dashboard**: Simple interface with voting and history buttons
- **Admin Dashboard**: Management interface with statistics and administrative controls
- **Voting Interface**: Full-screen contestant display with voting controls
- **Voting History**: Personal voting history with results visualization

### Data Models
- **Users**: Email, password, name, role (judge/admin)
- **Rounds**: Competition rounds with active status tracking
- **Contestants**: Participant information with round assignment
- **Votes**: Binary votes linking users to contestants
- **System Settings**: Configurable application settings

## Data Flow

1. **Authentication Flow**: User logs in → JWT token issued → Token validated on protected routes
2. **Voting Flow**: Judge selects contestant → Votes positive/negative → Vote recorded in database → UI updated
3. **Admin Flow**: Admin manages rounds → Creates/edits contestants → Views real-time statistics
4. **History Flow**: Query user votes → Display voting history with contestant details

## External Dependencies

### Frontend Dependencies
- **UI Framework**: React 18 with TypeScript
- **UI Components**: Radix UI primitives, shadcn/ui component library
- **State Management**: TanStack Query for data fetching and caching
- **Form Handling**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS, class-variance-authority for component variants
- **Icons**: Lucide React icons
- **Date Handling**: date-fns for date manipulation

### Backend Dependencies
- **Server**: Express.js with TypeScript support via tsx
- **Database**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: bcrypt for password hashing, jsonwebtoken for JWT tokens
- **Session Storage**: connect-pg-simple for PostgreSQL session store
- **Database Connection**: Neon serverless PostgreSQL client

### Development Dependencies
- **Build**: Vite for frontend building, esbuild for backend bundling
- **TypeScript**: Full TypeScript support across frontend and backend
- **Development**: Hot module replacement, runtime error overlay for Replit

## Deployment Strategy

### Development Environment
- **Frontend**: Vite dev server with HMR
- **Backend**: tsx for TypeScript execution with auto-restart
- **Database**: Neon serverless PostgreSQL with connection pooling
- **Environment**: Replit-optimized with cartographer plugin for debugging

### Production Build
- **Frontend**: Static build output to `dist/public`
- **Backend**: Bundled with esbuild to `dist/index.js`
- **Database**: Drizzle migrations applied via `db:push` command
- **Serving**: Express serves both API routes and static frontend files

### Configuration
- **Environment Variables**: DATABASE_URL for database connection, JWT_SECRET for authentication
- **Path Aliases**: Shared schema accessible from both frontend and backend
- **TypeScript**: Unified configuration with path mapping for clean imports