# AetherDash API Documentation

This documentation provides a comprehensive guide for external agents and integrations to interact with the AetherDash backend.

## Base URL

All API endpoints are prefixed with `/api/` (e.g., `https://your-domain.com/api/transactions/`).

## Authentication

All requests (except registration/login) must include the `Authorization` header with a valid JWT token.

**Header Format:**
`Authorization: Bearer <your_access_token>`

### Auth Endpoints

#### Register User

- **POST** `/auth/register/`
- **Payload:**
  ```json
  {
    "username": "newuser",
    "password": "securepassword",
    "email": "user@example.com"
  }
  ```

#### Login (Get Token)

- **POST** `/auth/token/`
- **Payload:**
  ```json
  {
    "username": "existinguser",
    "password": "securepassword"
  }
  ```
- **Response:** Returns `access` and `refresh` tokens.

#### Refresh Token

- **POST** `/auth/token/refresh/`
- **Payload:** `{"refresh": "<refresh_token>"}`

---

## 🤖 AI Agent Interface (The "Brain")

Use these endpoints to interact with the system using natural language or get predictive insights.

#### Chat with Financial Agent (Action-Capable)

This is the primary endpoint for external agents to control the system. The internal agent can read/write data based on instructions.

- **POST** `/predictions/agent/chat/`
- **Payload:**
  ```json
  {
    "query": "Add a transaction of $15.50 for Lunch at Chipotle today"
  }
  ```
- **Capabilities:**
  - **Add Transactions:** "Spent $50 on Gas at Shell"
  - **Check Balance:** "What is my total net worth?"
  - **Set Budgets:** "Set a budget of $500 for Groceries"
  - **Manage Goals:** "Create a savings goal for Vacation with target $2000"
  - **Analyze:** "How much did I spend on dining last month?"

#### Cashflow Forecast

- **GET** `/predictions/cashflow/?days=30`
- **Returns:** Projected daily balance based on historical spending and recurring bills.

---

## 💸 Transactions & Core Finance

#### List/Search Transactions

- **GET** `/transactions/`
- **Query Params:**
  - `start`: `YYYY-MM-DD`
  - `end`: `YYYY-MM-DD`
  - `name`: Filter by name/merchant
  - `type`: `today` | `week` | `month` | `custom`
- **Returns:** List of transaction objects.

#### Create Transaction

- **POST** `/transactions/`
- **Payload:**
  ```json
  {
    "account": 1,
    "date": "2024-03-15",
    "name": "Lunch",
    "amount": "-15.50",
    "category": "Food & Dining",
    "merchant_name": "Chipotle"
  }
  ```
  _Note: Expenses are negative numbers._

#### Update Transaction

- **PATCH** `/transactions/{id}/`
- **Payload:** Any subset of fields (e.g., `{"category": "Adjusted"}`).

#### Delete Transaction

- **DELETE** `/transactions/{id}/`

#### Bulk Delete

- **POST** `/transactions/bulk_delete/`
- **Payload:** `{"transaction_ids": [1, 2, 3]}`

#### Spending Trends

- **GET** `/transactions/trends/?months=6`
- **Returns:** Monthly breakdown by category.

#### Auto-Categorize with AI

- **POST** `/transactions/categorize_with_ai/`
- **Payload:**
  ```json
  {
    "descriptions": ["uber trip", "shell station"],
    "transaction_ids": [101, 102],
    "auto_update": true
  }
  ```

#### Detect Duplicates

- **GET** `/transactions/detect_duplicates/`
- **Returns:** Groups of potential duplicate transactions.

---

## 📊 Budgets & Goals

#### List Budgets

- **GET** `/budgets/`

#### Create/Set Budget

- **POST** `/budgets/`
- **Payload:**
  ```json
  {
    "category_group": 5,
    "amount": "500.00",
    "start_date": "2024-03-01",
    "end_date": "2024-03-31"
  }
  ```

#### Check Budget Progress

- **GET** `/budgets/progress/`
- **Returns:** Real-time status (spent vs limit) for active budgets.

#### Manage Savings Goals

- **GET** `/transactions/goals/`
- **POST** `/transactions/goals/`
- **Payload:**
  ```json
  {
    "name": "New Laptop",
    "target_amount": "2000.00",
    "deadline": "2024-12-31"
  }
  ```

---

## 🔔 Alerts & Notifications

#### List Active Alerts

- **GET** `/alerts/`

#### Create Alert

- **POST** `/alerts/`
- **Payload:**
  ```json
  {
    "alert_type": "low_balance",
    "threshold_value": "100.00"
  }
  # Types: low_balance, unusual_spending, budget_exceeded, large_transaction
  ```

#### Check Notifications

- **GET** `/alerts/notifications/`
- **POST** `/alerts/notifications/mark_all_read/`

---

## 🏦 Accounts & Categories

#### List Accounts

- **GET** `/plaid_integration/accounts/` (Assuming account management is tied here or via general list if exposed)
- Note: Primary account management is currently handled via Plaid sync results, but direct account access is available via relationship lookups in transactions.

#### List Categories

- **GET** `/categories/`
- **Returns:** System and user-defined categories.

#### Create Category

- **POST** `/categories/`
- **Payload:** `{"name": "My Custom Category"}`

---

## 🔌 Integrations

### Plaid (Bank Sync)

- **POST** `/plaid_integration/create_link_token/`
- **POST** `/plaid_integration/exchange_public_token/`
  - Payload: `{"public_token": "...", "institution_id": "...", "institution_name": "..."}`
- **POST** `/plaid_integration/sync_transactions/`
  - Triggers a sync for all connected accounts.

### File Import (CSV/OFX)

- **POST** `/import/upload/`
  - Multipart form data: `file=@statement.csv`, `account_id=1`
- **POST** `/import/{id}/confirm/`
  - Confirm imported transactions to add them to the ledger.
  - Payload: `{"account_id": 1, "transaction_ids": [...]}` (optional IDs to select specific ones)

---

## 📈 Reports

#### Cashflow Sankey Data

- **GET** `/reports/flow/`
- **Query Params:** `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- **Returns:** Nodes and links for visualizing income -> expenses flow.
