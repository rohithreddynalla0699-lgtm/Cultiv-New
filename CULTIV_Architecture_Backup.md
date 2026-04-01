# CULTIV App Architecture & Code Backup

This document serves as a detailed snapshot and technical breakdown of the CULTIV web application in its current state.

## 1. Brand & Theme Configuration
The application uses a minimal, earthy design system rooted in Tailwind CSS v4, utilizing CSS variables defined in `/src/styles/theme.css`.

**Core Colors:**
- **Primary:** Deep Forest Green (`#2D5016`)
- **Background:** Warm Off-White (`#FAFAF8`)
- **Foreground:** Soft Black (`#1A1A1A`)
- **Muted/Accent:** Soft Grey (`#E8E8E5`)

**Typography:**
- Uses clean, sans-serif fonts with very tight tracking on headings (`tracking-[-0.02em]` or tighter).
- Base font size: 16px.

## 2. File Structure Overview
```
/src
 ├── styles/
 │    └── theme.css          # Global CSS variables and base layer overrides
 ├── app/
 │    ├── App.tsx            # Main entry point and page layout
 │    └── components/
 │         ├── Header.tsx    # Navigation and Order button
 │         ├── Hero.tsx      # Main landing section with bowl counter
 │         ├── About.tsx     # Brand philosophy section
 │         ├── Menu.tsx      # Core bowl offerings
 │         ├── Location.tsx  # Siddipet location details
 │         ├── Ecosystem.tsx # Phased brand rollout cards
 │         ├── Footer.tsx    # Bottom navigation and links
 │         ├── OrderModal.tsx# Dynamic bowl builder and checkout
 │         └── Logo.tsx      # Flexible logo component (wordmark, emblem, subBrand)
```

## 3. Core Components Details

### `Logo.tsx`
Handles the CULTIV brand architecture with three variants:
1. **Wordmark:** Standard text with a subtle underline graphic beneath the 'V'.
2. **Emblem:** Circular bordered badge containing the wordmark, used for minimal contexts.
3. **SubBrand:** Wordmark with a highly tracked, uppercase sub-brand name below (e.g., used for "BOWLS", "MORNING").

### `Hero.tsx`
- **Visuals:** Full-screen background image of a healthy grain bowl with a gentle gradient fade and an SVG noise/grain overlay (`opacity: 0.06`).
- **Counter:** Uses a `useEffect` hook to animate a counter up to "2,184+ Bowls Served in Siddipet" over 2 seconds.
- **Messaging:** Features the massive "CULTIVATE BETTER HABITS" heading and the specific copy: *"Clean food. Simple prep. Daily ritual."* and *"Protein-forward bowls built with honest ingredients."*

### `OrderModal.tsx` (The Bowl Builder)
A complex interactive form overlay that manages the ordering flow.
- **State Management:** Tracks `orderType` (Pickup/Delivery), `base` (Rice), `protein` (Included), `extraProteins` (Paid), `veggies`, `addOns` (Paid), and `sauces`.
- **Pricing Logic:**
  - Base price: ₹149 (Includes Base, 1 Primary Protein, Veggies, Sauces)
  - Extra Chicken: +₹20
  - Egg: +₹10
  - Avocado: +₹30
  - Sour Cream: +₹20
  - Nachos: +₹10
- **Flow:** If `Delivery` is selected, it dynamically reveals inputs for Full Name, Phone, and Address. If `Pickup` is selected, it asks for Pickup Time.

### `Ecosystem.tsx`
A vertical layout showcasing the lifestyle architecture and roadmap of CULTIV.
- **Current Messaging:** *"Built step by step. Each phase launches only when the previous one is stable."*
- **Phases:**
  1. **CULTIV BOWLS** (Now Open)
  2. **CULTIV MORNING** (Juices + Breakfast Bowls)
  3. **CULTIV HARVEST** (Fresh-grown vegetables, greens, sourcing)
  4. **CULTIV LABS** (Nutrition blends, prebiotic powders)
  5. **CULTIV PERFORMANCE** (Fitness centers)
- **UI:** Features glassmorphism (`backdrop-blur-md`), active glow states for the "Now Open" phase, and Lucide React icons.

## 4. Business Logic Summary
The site operates strictly as a pure frontend prototype for a premium food brand. 
- It does not currently persist data to a backend database (like Supabase).
- Orders trigger a simulated 3-second success state timeout before clearing the form.
- The base offering is fixed at ₹149 with dynamic JavaScript calculating the final total based on user toggle selections in the modal.