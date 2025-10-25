# TravelMint Design Guidelines

## Design Approach

**Selected Approach**: Reference-Based inspired by premium NFT marketplaces (Foundation, Zora) combined with travel-focused visual storytelling (Airbnb aesthetics meets Web3)

**Core Principles**:
- Dark luxury: Premium feel through restrained dark UI with strategic accent usage
- Photography-first: Travel imagery drives the experience
- Web3 trust: Clear, confident blockchain interactions
- Minimal friction: Seamless Farcaster authentication experience

---

## Typography System

**Font Stack**:
- Primary: Inter (via Google Fonts CDN) - clean, modern sans-serif for UI
- Accent/Display: Space Grotesk - technical yet approachable for headlines

**Hierarchy**:
- Hero Headline: Space Grotesk, 56px (desktop) / 36px (mobile), font-weight-700
- Section Titles: Space Grotesk, 40px / 28px, font-weight-600
- Card Titles: Inter, 20px, font-weight-600
- Body Text: Inter, 16px, font-weight-400
- Small/Meta: Inter, 14px, font-weight-500
- Button Text: Inter, 15px, font-weight-600, letter-spacing 0.3px

---

## Layout & Spacing

**Spacing Primitives**: Tailwind units of 3, 4, 6, 8, 12, 16, 20, 24 for consistency

**Container Strategy**:
- Full-bleed sections: w-full with max-w-7xl inner containers
- Content sections: max-w-6xl with px-6 (mobile) / px-8 (desktop)
- Cards: p-6 standard, p-8 for featured content

**Vertical Rhythm**:
- Section padding: py-16 (mobile) / py-24 (desktop)
- Component spacing: gap-8 for grids, gap-6 for lists
- Element spacing: mb-3 for tight groups, mb-6 for section breaks

---

## Hero Section Design

**Structure**: Full-viewport immersive hero (h-screen) with layered travel photography

**Layout**:
- Background: Full-bleed hero image showcasing stunning travel destination (mountain vista, coastal scene, or exotic cityscape at golden hour)
- Overlay: Dark gradient (from transparent to rgba(0,0,0,0.6)) for text legibility
- Content: Centered vertical alignment with max-w-4xl container

**Content Elements**:
1. Platform Badge: Small pill component "Powered by Base ⬧ Farcaster" (top-center, mb-8)
2. Hero Headline: "Collect Extraordinary Travel Moments" (mb-4)
3. Subheadline: "Mint, trade, and own authenticated travel photography as NFTs on Base blockchain" (mb-12, max-w-2xl, text-lg, opacity-90)
4. CTA Group (flex gap-4):
   - Primary: "Sign in With Farcaster" button (see button specs below)
   - Secondary: "Explore Gallery" button (outlined variant)
5. Trust Indicators (below buttons, mt-8): "12.5K Photos Minted • 4.2K Collectors • Built on Base"

**Image Treatment**: Apply subtle blur to background edge areas, sharp focus in center third where hero content doesn't overlay

---

## Sign in With Farcaster Button Styling

**Primary Button Specs** (for use on hero image):
- Background: rgba(139, 92, 246, 0.15) with backdrop-blur-md for glass effect
- Border: 1.5px solid rgba(139, 92, 246, 0.4)
- Text: White (#FFFFFF)
- Padding: px-8 py-4
- Border-radius: 12px (rounded-xl)
- Font: Inter, 15px, font-weight-600, letter-spacing 0.3px
- Icon placement: Farcaster logo icon (20px) with mr-3 spacing
- Shadow: 0 4px 24px rgba(139, 92, 246, 0.2)

**Standard Button Specs** (for use on dark backgrounds without image):
- Background: Linear gradient from purple (#8B5CF6) to blue (#3B82F6) at 135deg
- Text: White (#FFFFFF)
- Same padding, radius, typography as primary
- Shadow: 0 4px 16px rgba(139, 92, 246, 0.3)

**Button States** (DO NOT implement in custom CSS - AuthKit handles these):
- AuthKit manages hover/active/focus states internally
- Your styling should provide the base appearance only
- Trust the component's built-in interaction design

---

## Core Sections Structure

**1. Featured Collections Grid** (after hero, py-24):
- 3-column grid (lg:grid-cols-3, md:grid-cols-2, grid-cols-1, gap-6)
- Each card: Travel photo with overlay gradient, location tag, mint count, price in ETH
- Cards use aspect-ratio-square with overflow-hidden, rounded-2xl

**2. How It Works** (py-24, bg-zinc-900/50):
- 4-column process flow (stack on mobile)
- Icon-based steps: Connect Wallet → Upload Photo → Mint NFT → Trade/Collect
- Each step: Gradient icon (64px), title, short description
- Use Heroicons for iconography (CDN)

**3. Top Photographers Showcase** (py-24):
- Horizontal scroll carousel (hide scrollbar)
- Photographer cards: Avatar (80px rounded-full), name, bio snippet, photo count, total sales
- Cards with backdrop-blur glass effect on dark background

**4. Recent Mints Live Feed** (py-20):
- 2-column masonry grid showcasing latest minted photos
- Real-time feel: Include "Minted 2 mins ago" timestamps
- Mix of portrait and landscape aspect ratios for visual interest

**5. Join Community CTA** (py-24, bg-gradient-to-br from purple to blue):
- Centered content with max-w-3xl
- Headline: "Start Your Collection Today"
- Dual CTAs: "Sign in With Farcaster" + "View Documentation"
- Farcaster and Base logos as trust badges below

---

## Component Library

**Navigation Bar**:
- Fixed top, backdrop-blur-lg, border-b border-white/10
- Logo left, nav links center, "Sign in With Farcaster" button right
- Height: 80px with px-8 padding

**Photo Cards**:
- Container: Rounded-2xl, overflow-hidden, shadow-xl
- Image: Object-cover with hover scale effect (scale-105 on hover)
- Overlay: Gradient from transparent to dark at bottom
- Metadata: Absolute bottom positioning with p-6, includes location, photographer, price

**Input Fields** (for search/filters):
- Dark: bg-zinc-800/50, border border-zinc-700, rounded-lg
- Placeholder: text-zinc-400
- Focus: border-purple-500, ring-2 ring-purple-500/20

**Footer**:
- 4-column grid (stack on mobile): About, Marketplace, Resources, Social
- Newsletter signup: Input + gradient button
- Bottom bar: Copyright, Terms, Privacy links with social icons right-aligned
- Padding: pt-20 pb-12

---

## Images Specification

**Hero Image**: 
- Placement: Full-viewport background (h-screen, object-cover)
- Description: Breathtaking travel destination - aerial view of Santorini at sunset (white buildings, blue domes, aegean sea) OR Patagonian mountain range with turquoise lake OR Japanese temple in autumn with maple trees
- Requirements: High resolution (2400px+ width), professional travel photography, vibrant yet natural colors

**Collection Grid Images** (9 placeholder images):
- Varied travel scenes: Architecture, landscapes, street scenes, cultural moments
- Mix of aspect ratios but standardized to square for grid
- Professional quality with strong composition

**Photographer Avatars**: 
- Circular profile photos, 80px diameter
- Diverse representation of creators

---

## Accessibility Notes

- Maintain WCAG AA contrast ratios: White text on dark backgrounds exceeds requirements
- Focus states: 2px purple outline with offset for keyboard navigation
- Button tap targets: Minimum 44px height maintained across all interactive elements
- Alt text: Descriptive for all travel photography, include location and subject