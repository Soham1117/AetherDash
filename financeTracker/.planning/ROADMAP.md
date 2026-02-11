# Roadmap: Finance Tracker

## Overview

This roadmap takes the Finance Tracker from empty repository to a fully functional local-first PWA. We start with foundation (Next.js + SQLite), build core expense tracking, add receipt OCR capture, implement the crucial duplicate detection logic, layer in credit card bill handling, add categorization and analytics, implement budgeting features, polish the UI with dark theme and Shadcn components, and finally optimize as a PWA for mobile installation.

## Domain Expertise

None

## Phases

- [x] **Phase 1: Foundation & Setup** - Project scaffolding, Next.js PWA setup, SQLite integration
- [ ] **Phase 2: Core Data Models** - Database schema for transactions, categories, accounts
- [ ] **Phase 3: Manual Entry System** - Basic expense/transaction input forms
- [ ] **Phase 4: Receipt OCR Integration** - PaddleOCR/EasyOCR setup with image capture
- [ ] **Phase 5: Duplicate Detection Engine** - Smart matching algorithm for overlapping expenses
- [ ] **Phase 6: Credit Card Bill Tracking** - Line-item breakdown with purchase linking
- [ ] **Phase 7: Categorization & Analytics** - Auto-categorization, spending patterns, trends
- [ ] **Phase 8: Budget Management** - Per-category budgets with warnings
- [ ] **Phase 9: UI Polish & Dark Theme** - Shadcn components, responsive mobile design
- [ ] **Phase 10: PWA Optimization** - Offline support, installability, performance tuning

## Phase Details

### Phase 1: Foundation & Setup
**Goal**: Working Next.js application with SQLite database integration and basic PWA manifest
**Depends on**: Nothing (first phase)
**Research**: Unlikely (established Next.js patterns, standard SQLite setup)
**Status**: ✅ Complete (2026-01-09)

Plans:
- [x] 01-01: Next.js Foundation (9 min)
- [x] 01-02: SQLite Integration (20 min)
- [x] 01-03: PWA Configuration (52 min)

### Phase 2: Core Data Models
**Goal**: Complete database schema with tables for transactions, categories, accounts, and relationships
**Depends on**: Phase 1
**Research**: Unlikely (standard relational database design)
**Status**: ✅ Complete (2026-01-09)

Plans:
- [x] 02-01: Core Financial Schema (3 min)
- [x] 02-02: Advanced Tracking Schema (1 min)

### Phase 3: Manual Entry System
**Goal**: Functional forms for adding expenses, bank transactions, and credit card bills manually
**Depends on**: Phase 2
**Research**: Unlikely (standard form handling in Next.js)
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 4: Receipt OCR Integration
**Goal**: Camera capture with OCR extraction (PaddleOCR or EasyOCR) that parses merchant, amount, items
**Depends on**: Phase 3
**Research**: Likely (new technology integration, library choice)
**Research topics**: PaddleOCR vs EasyOCR comparison for receipt accuracy, browser MediaDevices API for camera access, image preprocessing techniques, running ML models in browser or via Node backend
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 5: Duplicate Detection Engine
**Goal**: Algorithm that identifies same purchase across receipt, bank statement, credit card statement
**Depends on**: Phase 4
**Research**: Likely (algorithm design, fuzzy matching strategies)
**Research topics**: Transaction matching strategies (amount + date + merchant), fuzzy string matching libraries (fuse.js, string-similarity), confidence scoring thresholds, handling edge cases (split payments, partial refunds)
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 6: Credit Card Bill Tracking
**Goal**: Credit card bill entry with line-item breakdown, automatic linking to existing purchases
**Depends on**: Phase 5
**Research**: Unlikely (uses duplicate detection from Phase 5)
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 7: Categorization & Analytics
**Goal**: Auto-categorization of expenses, spending trends visualization, pattern analysis
**Depends on**: Phase 6
**Research**: Likely (data visualization library choice)
**Research topics**: Chart libraries for Next.js (recharts, chart.js, tremor), auto-categorization rules/heuristics, time-series data aggregation patterns
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 8: Budget Management
**Goal**: Per-category budget setting with spending warnings and limit tracking
**Depends on**: Phase 7
**Research**: Unlikely (builds on categorization from Phase 7)
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 9: UI Polish & Dark Theme
**Goal**: Modern dark-themed UI using Shadcn components, mobile-responsive design
**Depends on**: Phase 8
**Research**: Unlikely (Shadcn is well-documented)
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 10: PWA Optimization
**Goal**: Offline support, installability, service worker for caching, optimized performance
**Depends on**: Phase 9
**Research**: Unlikely (Next.js PWA patterns are established)
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Setup | 3/3 | Complete | 2026-01-09 |
| 2. Core Data Models | 2/2 | Complete | 2026-01-09 |
| 3. Manual Entry System | 0/TBD | Not started | - |
| 4. Receipt OCR Integration | 0/TBD | Not started | - |
| 5. Duplicate Detection Engine | 0/TBD | Not started | - |
| 6. Credit Card Bill Tracking | 0/TBD | Not started | - |
| 7. Categorization & Analytics | 0/TBD | Not started | - |
| 8. Budget Management | 0/TBD | Not started | - |
| 9. UI Polish & Dark Theme | 0/TBD | Not started | - |
| 10. PWA Optimization | 0/TBD | Not started | - |
