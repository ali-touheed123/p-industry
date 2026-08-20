---
name: Industrial Spectrum
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#23005c'
  on-tertiary-container: '#9466ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  table-data:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 260px
  container-max: 1440px
  gutter: 1.5rem
  stack-sm: 0.5rem
  stack-md: 1rem
  table-cell-padding: 12px 16px
---

## Brand & Style

The brand personality is **Industrial, Reliable, and Precise**. As an ERP/POS system for the paint industry, it must bridge the gap between heavy-duty inventory management and the vibrant, creative nature of the product (paint). The UI should evoke a sense of "Enterprise-Grade Stability" while remaining modern and responsive.

The design style is **Corporate / Modern** with a focus on **Information Density**. It utilizes high-contrast functional areas to separate navigation, data entry, and reporting. While the foundation is grounded in professional blues, the "paint" aspect is introduced through purposeful, high-chroma accents that serve both as brand markers and semantic signals.

**Key visual principles:**
- **Clarity over Decoration:** Every element must serve a functional purpose for high-speed data entry.
- **Trusted Authority:** Use deep navy tones to signify security and financial accuracy.
- **Functional Color:** Use the "paint" palette to highlight statuses and critical actions, making the interface intuitive for users transitioning from legacy systems.

## Colors

The palette is anchored by **Deep Navy (#0F172A)**, providing a sophisticated, stable foundation for an enterprise ERP. **Professional Blue (#2563EB)** is used for primary actions and active states.

The "Paint" industry is represented through a diverse set of vibrant accents:
- **Emerald Green:** Used for "Paid" statuses and successful stock additions.
- **Royal Purple:** Used for "Partial" payments or specialized "Tinting" processes.
- **Bright Orange:** Reserved for "Credit" alerts and urgent stock warnings.

The background uses a tiered grayscale to separate the sidebar, header, and main content area, ensuring that complex data tables remain the focal point.

## Typography

This design system utilizes **Inter** for all primary UI elements to ensure maximum legibility across various monitor qualities found in retail environments. A specialized **table-data** size is defined to balance density with readability in complex ERP grids.

**JetBrains Mono** is introduced as a secondary functional font for numeric data, SKUs, and invoice numbers. The monospaced nature ensures that columns of numbers (prices, quantities) align perfectly, allowing for faster visual scanning of financial documents.

**Hierarchical Rules:**
- Use `headline-lg` for Page Titles (e.g., "Sales Invoice").
- Use `label-caps` for table headers and form input labels.
- Use `mono-data` for all currency values and inventory codes.

## Layout & Spacing

The layout follows a **Fixed Sidebar + Fluid Content** model. The sidebar remains persistent for rapid navigation between POS, Inventory, and Reports.

**Grid Philosophy:**
- **Desktop (1280px+):** 12-column grid. POS entry forms should span 8 columns, while the summary/calculation card spans 4 columns on the right.
- **Tablet (768px - 1279px):** Sidebar collapses to icons-only. Content area becomes a single column with stacked modules.
- **Mobile:** Not the primary use case, but layouts reflow to a single vertical stack.

**Density:**
The system uses a "Medium-High" density. Tables should minimize vertical whitespace to show as many rows as possible without sacrificing touch-target size for POS interactions.

## Elevation & Depth

Visual hierarchy is primarily established through **Tonal Layering** rather than heavy shadows. This keeps the interface feeling "fast" and modern.

- **Level 0 (Background):** Light gray (#F8FAFC) for the main application canvas.
- **Level 1 (Cards/Tables):** Pure white surfaces with a subtle, 1px neutral border (#E2E8F0).
- **Level 2 (Active Modals/Dropdowns):** Pure white with a soft, diffused shadow (0 10px 15px -3px rgba(0,0,0,0.1)).
- **Navigation:** The sidebar uses the Primary Navy color, creating a clear vertical anchor that feels "underneath" the content cards.

Active form fields should utilize a 2px blue ring (Primary Color) to provide clear focus during rapid keyboard-driven data entry.

## Shapes

The design system uses a **Soft (1)** shape language. The 0.25rem (4px) base radius provides a professional, "tailored" appearance that feels modern without being overly casual or "bubbly."

- **Buttons & Inputs:** 4px radius.
- **Status Badges:** 4px radius for a blocky, industrial feel.
- **Content Cards:** 8px (rounded-lg) to subtly frame large data sets.
- **Search Bars:** 20px (rounded-xl) to distinguish global navigation from form-specific inputs.

## Components

### Data Tables (The Core)
Tables are the heart of this system. They must feature:
- Sticky headers.
- Zebra striping (very subtle) for row tracking.
- Inline status badges (e.g., "Partial" in Purple, "Credit" in Orange).
- Right-aligned numeric columns using the Monospace font.

### Form Fields
Inputs must have clear, persistent labels. For the POS entry, use "Dense" variants of inputs with a height of 36px to allow for more fields above the fold. 

### Action Buttons
- **Primary:** Solid Blue with white text.
- **Secondary:** White background with Navy border and text.
- **Destructive:** Solid Red (only for Delete/Void actions).
- **POS Shortcuts:** Large, high-contrast buttons for F-key shortcuts (e.g., [F1] New, [F2] Save) to accommodate legacy user habits.

### Status Badges
Small, high-contrast pills.
- `Paid`: Emerald Green background, Dark Green text.
- `Credit`: Orange background, Dark Orange text.
- `Partial`: Purple background, Dark Purple text.

### Sidebar Navigation
The sidebar should use the Primary Navy background with low-opacity white text. The active menu item should be highlighted with the Secondary Blue as a vertical "indicator" on the left edge.