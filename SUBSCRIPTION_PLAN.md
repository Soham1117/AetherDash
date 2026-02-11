# Subscriptions Module Implementation Plan

## 1. Objective

Create a dedicated Subscriptions Hub that automatically tracks recurring expenses, calculates total projected spend, and identifies when subscriptions have been cancelled or discontinued.

## 2. Core Features

- **Smart Detection:** Automatically identifying recurring payments from transaction history.
- **Status Tracking:** Distinguishing between `Active`, `Overdue`, and `Discontinued` subscriptions.
- **Financial Projection:** Calculating "Monthly Burn Rate" and "Yearly Cost".
- **Billing Calendar:** Visual timeline of upcoming payments.
- **Manual Overrides:** Allow users to manually add, edit, or mark subscriptions as cancelled.

## 3. Intelligence & Logic

### A. Subscription Detection Algorithm

We will use a **Frequency Analysis** approach on the existing transaction ledger:

1.  **Grouping:** Group transactions by `merchant_name` or similar `description`.
2.  **Interval Analysis:** Calculate the time difference (delta) between consecutive transactions.
    - ~30 days (±5 days) = **Monthly**
    - ~365 days (±10 days) = **Yearly**
    - ~7 days = **Weekly**
3.  **Consistency Check:** If 3+ transactions exist with consistent intervals and similar amounts (allowing for ~10% variance for tax/fx fluctuations), mark as a **Subscription Candidate**.

### B. Status Detection (Active vs. Discontinued)

We will determine status dynamically based on the `last_payment_date` and `frequency`:

- **Active (🟢):**
  - `last_payment_date` is within the expected cycle window.
  - _Example:_ Monthly sub paid 15 days ago.

- **Discontinued / Missed (🔴):**
  - The `next_due_date` has passed by a "Grace Period" (e.g., 10 days) with no matching transaction found.
  - _Logic:_ `today > (last_payment_date + frequency + grace_period)`
  - _Action:_ System automatically flags as "Potentially Discontinued". User confirms if it was cancelled.

- **Cancelled (⚫):**
  - User manually marks the subscription as cancelled. We keep it in history but stop projecting future dates.

## 4. Technical Implementation

### Backend (`backend/transactions/`)

We will utilize and enhance the existing `RecurringTransaction` model.

**Model Updates:**

- Ensure `RecurringTransaction` has fields for:
  - `status`: Enum (active, discontinued, cancelled)
  - `detected_by_system`: Boolean (to distinguish manual entries)
  - `average_amount`: Decimal (since amounts can fluctuate slightly)

**New Services:**

- `SubscriptionService.detect_subscriptions(user)`: Runs the analysis algorithm.
- `SubscriptionService.update_statuses(user)`: Checks all active subscriptions to see if they missed their due date.

### Frontend (`frontend/src/app/subscriptions/`)

**Componenets:**

1.  **Stats Cards:** "Monthly Fixed Costs", "Yearly Savings (from cancelled subs)".
2.  **Subscription List:**
    - Columns: Service Name (Logo), Amount, Frequency, Status, Next Bill Date.
    - Actions: "Mark Cancelled", "Edit", "Not a Subscription".
3.  **Upcoming Bills Widget:** A simple list of what's due in the next 7 days.

## 5. Implementation Steps

1.  **Backend Logic:** Implement detection & status update logic in `services.py`.
2.  **API Endpoints:** Create `GET /subscriptions`, `POST /subscriptions/scan`, `PATCH /subscriptions/{id}`.
3.  **Frontend Page:** Build the UI to display the data.
4.  **Automation:** Hook the scan logic into the standard Plaid sync process (so it updates every time you sync).
