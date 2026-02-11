# Finance Tracker

## What This Is

A personal finance tracking webapp that captures purchases via receipt OCR and manual entry, tracks credit card bills and bank account transactions, and intelligently detects overlapping payments to show where money actually goes. Built as a local-first, privacy-focused PWA with a modern dark-themed UI.

## Core Value

Accurate, duplicate-free expense tracking with zero data leaving the device — every rupee accounted for, smart enough to know that the credit card bill contains purchases already logged.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Receipt capture via mobile camera with OCR extraction (PaddleOCR/EasyOCR)
- [ ] Manual expense entry for purchases, bills, and transactions
- [ ] Credit card bill tracking with line-item breakdown
- [ ] Bank account transaction logging
- [ ] Duplicate detection (same purchase on receipt AND bank statement)
- [ ] Smart overlap handling (CC bill containing already-logged purchases)
- [ ] Auto-categorization of expenses (groceries, utilities, entertainment, etc.)
- [ ] Spending trends and pattern analysis
- [ ] Budget setting per category with approaching-limit warnings
- [ ] Dark-themed, modern UI with great UX (Shadcn components)
- [ ] Mobile-responsive PWA for on-the-go receipt capture
- [ ] All processing and storage local (no cloud services)

### Out of Scope

- Multi-user/family accounts — single user only for v1
- Investment tracking (stocks, mutual funds) — focus on expenses
- Automatic bank sync via APIs — manual entry/upload only

## Context

This is a personal tool to gain clarity on spending. The key pain point is understanding where money actually goes when the same expense can appear in multiple places (receipt, bank statement, credit card bill). The "smart" aspect is crucial — the app needs to understand that a Rs. 500 grocery purchase logged from a receipt is the same Rs. 500 that appears in the credit card statement, which is part of the Rs. 15,000 credit card bill paid from the bank account.

Indian context: dealing with UPI payments, credit cards, multiple bank accounts, and cash — all flowing in ways that can be confusing without proper tracking.

## Constraints

- **Privacy**: All data stays local — no cloud services, no external API calls for core functionality
- **Tech Stack**: Next.js + TypeScript + Shadcn UI
- **Database**: SQLite for local storage
- **OCR**: PaddleOCR or EasyOCR (user's choice during setup) — must run locally
- **UI**: Dark theme, modern aesthetic, mobile-first responsive design

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js + TypeScript | Full-stack framework with good PWA support, works well with Shadcn | — Pending |
| SQLite for storage | Simple file-based DB, keeps everything local, easy backup | — Pending |
| PaddleOCR/EasyOCR | Open source, runs locally, good accuracy for receipts | — Pending |
| No bank API sync | Privacy-first approach, manual entry gives user control | — Pending |

---
*Last updated: 2026-01-09 after initialization*
