# Overview

This is a travel-focused NFT marketplace application where users can mint, buy, and sell location-based travel photo NFTs. The application features an interactive map view for discovering NFTs by location, a marketplace for trading, and a minting system for creating new travel photo NFTs. Built with a modern React frontend and Express backend, it uses PostgreSQL for data persistence and includes a comprehensive UI component library based on shadcn/ui.

## Recent Updates (October 2, 2025)

- **Farcaster Manifest Configuration**: Updated `primaryCategory` from "social" to "productivity" across all 5 manifest locations:
  1. `server/createApp.ts` - Hardcoded manifest route
  2. `client/public/.well-known/farcaster.json` - Primary Farcaster manifest file
  3. `client/public/manifest.json` - PWA manifest
  4. `client/index.html` - HTML meta tag
  5. `server/routes.ts` - Server-rendered /base endpoint
- **Webhook URL**: Configured to `https://api.neynar.com/f/app/968f2785-2da9-451a-a984-d753e739713c/event` across all manifest locations
- **Manifest Consistency**: All manifest files now serve consistent category and webhook configuration for proper Farcaster Mini App discovery

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client is built with React and TypeScript using Vite as the build tool. The application follows a component-based architecture with:

- **UI Framework**: React with TypeScript
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Component Library**: Comprehensive shadcn/ui component system with Radix UI primitives
- **State Management**: TanStack Query for server state and caching
- **Routing**: Wouter for lightweight client-side routing
- **Map Integration**: Leaflet for interactive map functionality

The frontend is organized into pages (home, marketplace, mint), reusable components, and custom hooks. The application is responsive with mobile-first design principles.

## Backend Architecture

The server uses Express.js with TypeScript in ESM format. Key architectural decisions:

- **API Design**: RESTful API structure with routes for NFTs, users, and transactions
- **Data Layer**: Abstracted storage interface allowing for flexible data persistence implementations
- **Development Setup**: Vite integration for development with HMR support
- **Error Handling**: Centralized error handling middleware
- **Logging**: Custom logging system for API request tracking

## Data Storage

The application uses Drizzle ORM with PostgreSQL:

- **Schema Design**: Three main entities - users, nfts, and transactions
- **Database**: PostgreSQL with Drizzle migrations
- **Connection**: Neon Database serverless PostgreSQL
- **Type Safety**: Full TypeScript integration with Drizzle-generated types
- **Validation**: Zod schemas for runtime validation

The schema supports location-based NFTs with latitude/longitude coordinates, user balance tracking, and comprehensive transaction history.

## Country Statistics System

The application features a dynamic country counting system for statistics display:

- **Hybrid Detection**: Uses both location name mapping and coordinate-based detection
- **City Mapping**: Pre-mapped city names to countries (e.g., "Tiflis" → "Georgia", "Dubai" → "UAE")
- **Coordinate Fallback**: Geographic boundary detection for unmapped locations
- **Real-time Updates**: Country count automatically updates as new NFTs are minted
- **Current Count**: Displays unique countries represented in the NFT collection
- **Manual Corrections**: Includes fixes for mislabeled locations from blockchain metadata

## Authentication and Authorization

Currently implements a simplified authentication system without external providers. The application uses session-based authentication with in-memory storage for development purposes.

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Drizzle ORM**: Type-safe database toolkit with PostgreSQL dialect

## UI and Styling
- **Radix UI**: Headless UI components for accessibility
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library

## Maps and Location
- **Leaflet**: Open-source mapping library
- **OpenStreetMap**: Tile layer provider for map data

## Development Tools
- **Vite**: Build tool and development server
- **ESBuild**: JavaScript bundler for production builds
- **TanStack Query**: Data fetching and caching
- **Wouter**: Minimalist routing library

## Utilities
- **Date-fns**: Date manipulation library
- **Class Variance Authority**: Component variant management
- **CLSX**: Conditional className utility
- **Zod**: Runtime type validation

The application is configured for deployment on Replit with development-specific tooling and error handling.