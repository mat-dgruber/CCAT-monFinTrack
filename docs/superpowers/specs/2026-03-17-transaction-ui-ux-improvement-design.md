# Design Spec: Transaction UI/UX Improvement (Option A - Polished Evolution)

**Date:** 2026-03-17
**Status:** Approved
**Topic:** UI/UX Refinement for Transaction Management

## 1. Overview

This specification details the "Option A: Polished Evolution" approach for the Transactions screen in CCAT-monFinTrack. The goal is to create a premium, modern experience by leveraging Glassmorphism, improved typography, quick filtering, and contextual financial insights.

## 2. Visual Design (Look & Feel)

### 2.1 Glassmorphism & Depth

- **Page Header & Sidebar:** Implement `bg-surface-card/80 backdrop-blur-md` with a subtle 1px border (`border-surface-border/50`).
- **Shadows:** Use custom `shadow-elegant` for cards and table rows on hover.
- **Color Palette:**
  - **Incomes:** Emerald Green (`#10b981`) with high contrast.
  - **Expenses:** Ruby Red (`#e11d48`) soft yet distinct.
  - **Neutral:** Slate/Zinc tones for secondary information.

### 2.2 Typography

- Increase font weight for titles (`font-bold` to `font-extrabold`).
- Use `tabular-nums` for all currency values to ensure alignment.
- Refine secondary text with `text-xs font-medium tracking-tight`.

## 3. User Experience (UX)

### 3.1 Quick Filter Pills

- Add a horizontally scrollable container below the page header.
- **Pills:** "Todos", "Pendentes ⏳", "Hoje 📅", "Receitas 💰", "Despesas 💸".
- **Interaction:** Single click toggles filter; active state uses primary gradient background.

### 3.2 Table & Timeline Refinement

- **Row Interaction:** Add `transition-all duration-300`, `hover:-translate-y-0.5`, and a subtle glow effect on hover.
- **Timeline Headers:** Make Date headers proeminente with a vertical accent bar using the primary color.
- **Status Badges:** Use minimized pills with micro-icons (check/clock) instead of plain text.

### 3.3 Mobile Experience

- **Cards:** Increase border radius to `rounded-3xl`.
- **Actions:** Implement a bottom-sheet for quick actions (Edit, Delete, Toggle Status) to improve thumb-reachability.
- **Density:** Optimize padding to show more transactions on smaller screens without feeling cluttered.

## 4. Financial Insights (Right Sidebar)

### 4.1 Sparklines (Trend Lines)

- Implement simple SVG sparklines for "Total Income" and "Total Expense" showing the last 7 days trend.
- **Logic:** Upward trend (green) for income, downward trend (green) for expenses.

### 4.2 Health Progress Bar

- **Metric:** Expense/Income ratio for the selected period.
- **Color Logic:**
  - < 70%: Primary Blue
  - 70% - 90%: Amber/Orange
  - > 100%: Red/Danger

### 4.3 Action Shortcuts

- **Report Export:** Elegant button to generate PDF/CSV.
- **AI Insights:** High-visibility button (purple/blue gradient) to trigger AI analysis of the current transaction list.

## 5. Technical Considerations

- **Frameworks:** Continue using Angular Signals, PrimeNG 18+, and TailwindCSS 3.4+.
- **Performance:** Ensure filters are computed efficiently using Angular `computed` signals.
- **Accessibility:** Maintain ARIA labels and keyboard navigation for all new UI elements.

## 6. Testing Strategy

- **Visual Regression:** Verify layout consistency across Chrome, Safari, and Firefox.
- **Mobile Validation:** Test thumb-reachability and touch targets on iOS/Android emulators.
- **Performance:** Measure frame rates during table scroll with 500+ transactions.
