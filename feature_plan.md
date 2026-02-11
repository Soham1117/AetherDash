# AetherDash Feature Expansion Plan

## Overview

This plan covers 10 new features to enhance the Finance Tracker with automation, insights, and better data management.

---

## ✅ 1. Recurring Transaction Detection - COMPLETED

**Goal**: Automatically identify subscriptions and recurring bills.

### Backend

- [x] Add `RecurringTransaction` model with fields: `name`, `amount`, `frequency`, `next_date`, `category_ref`, `is_active`
- [x] API endpoint: `GET /transactions/recurring/detect/` to scan and detect patterns
- [x] API endpoint: `GET /transactions/recurring/upcoming/` for next 30 days

### Frontend

- [x] New "Subscriptions" page showing detected recurring payments
- [x] Card on Dashboard showing upcoming recurring charges

---

## ✅ 2. Cash Flow Forecasting - COMPLETED

**Goal**: Project future balances based on spending history.

### Backend

- [x] Endpoint: `GET /predictions/cashflow/?days=30|60|90`
- [x] Logic: Current balance + avg daily income - avg daily expenses
- [x] Factor in recurring transactions for accuracy
- [x] Warning if balance projected to go negative

### Frontend

- [x] Line chart on Dashboard showing projected balance over time
- [x] Warning indicator if balance is projected to go negative

---

## ✅ 3. Spending Trends Over Time - COMPLETED

**Goal**: Compare current spending to previous months.

### Backend

- [x] Endpoint: `GET /transactions/trends/?months=6` returning monthly totals by category

### Frontend

- [x] Multi-line chart comparing monthly spending per category
- [x] Add to existing Dashboard or new "Reports" page

---

## ✅ 4. Category Budgets - COMPLETED

**Goal**: Set monthly spending limits per category.

### Backend

- [x] Updated `Budget` model with `category_group` FK to hierarchical categories
- [x] Endpoint: `GET/POST /budgets/` for CRUD
- [x] Endpoint: `GET /budgets/progress/` returning current spending vs budget

### Frontend

- [x] BudgetCard component with progress bars
- [x] AddBudgetSheet for creating new budgets

---

## ✅ 5. Savings Goals - COMPLETED

**Goal**: Track progress toward financial targets.

### Backend

- [x] Add `SavingsGoal` model: `name`, `target_amount`, `current_amount`, `deadline`, `icon`, `color`
- [x] Endpoints: CRUD at `/transactions/goals/`
- [x] Actions: `add_funds` and `withdraw` endpoints

### Frontend

- [x] Goals list page with progress bars
- [x] Quick "Add Funds" action

---

## ✅ 7. Rule-Based Categorization - COMPLETED

**Goal**: Let users define auto-categorization rules.

### Backend

- [x] Add `CategorizationRule` model: `match_type`, `match_value`, `category_ref`
- [x] Apply rules on transaction creation (in Transaction.save())
- [x] Endpoints: CRUD at `/transactions/rules/`

### Frontend

- [x] Rules management page (`/rules`)
- [x] AddRuleSheet component with match type dropdown

---

## ✅ 8. Automated Reminders - COMPLETED

**Goal**: Alert users about bills, low balances, or unusual spending.

### Backend

- [x] Add `Alert` model: `type` (bill_due/low_balance/unusual_spending), `threshold`, `enabled`, `user`
- [x] Scheduled task to check conditions and create notifications
- [x] Add `Notification` model or integrate with existing alerts app

### Frontend

- [x] Notifications bell icon in header
- [x] Settings page to configure alert thresholds

---

## ✅ 9. Smart Payee Suggestions - COMPLETED

**Goal**: Auto-complete merchant/payee based on history.

### Backend

- [x] Endpoint: `GET /transactions/payee_suggestions/?q=<query>` returning distinct payee names

### Frontend

- [x] Add autocomplete to "Description" field in Add Transaction sheet
- [x] Debounced search as user types

---

## ✅ 10. Bank Statement Import (CSV/OFX) - COMPLETED

**Goal**: Import transactions from downloaded bank files.

### Backend

- [x] Endpoint: `POST /transactions/import/` accepting CSV or OFX file
- [x] Parse common CSV formats (date, description, amount columns)
- [x] Parse OFX/QFX using `ofxparse` library
- [x] Return preview before committing; second call to confirm import

### Frontend

- [x] Import button on Transactions page
- [x] Upload dialog with file picker
- [x] Preview table with column mapping for CSV
- [x] Confirmation step before saving

---

## ✅ 13. Tags - COMPLETED

**Goal**: Flexible labeling system alongside categories.

### Backend

- [x] Add `Tag` model: `name`, `color`, `user`
- [x] Add `tags` ManyToMany field to `Transaction`
- [x] Endpoints: CRUD at `/transactions/tags/`, update via `tag_ids`

### Frontend

- [x] TagSelect component (multi-select with create)
- [x] Tag selector in Add/Edit transaction sheets
- [x] Filter transactions by tag
- [x] Tag management page

---

## Summary

| #   | Feature                   | Backend | Frontend |
| --- | ------------------------- | ------- | -------- |
| 1   | Recurring Detection       | ✅      | ✅       |
| 2   | Cash Flow Forecast        | ✅      | ✅       |
| 3   | Spending Trends           | ✅      | ✅       |
| 4   | Category Budgets          | ✅      | ✅       |
| 5   | Savings Goals             | ✅      | ✅       |
| 7   | Rule-Based Categorization | ✅      | ✅       |
| 8   | Automated Reminders       | ✅      | ✅       |
| 9   | Payee Suggestions         | ✅      | ✅       |
| 10  | Bank Import               | ✅      | ✅       |
| 13  | Tags                      | ✅      | ✅       |

**10 of 10 backend features complete. 10 of 10 frontend features complete.**