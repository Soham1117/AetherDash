# AetherDash

AetherDash is a full-stack personal finance platform.

## Active architecture (source of truth)

- `backend/` → Django REST API (auth, transactions, budgets, alerts, predictions, reports, imports)
- `frontend/` → Next.js web app (active UI)

## Legacy note

`financeTracker/` was removed from active development and should not be used.

## Quick start

### 1) Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt  # if present
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend defaults to `http://localhost:3000`.

## API surface (high-level)

- `/auth/`
- `/accounts/`
- `/transactions/`
- `/recurring_transactions/`
- `/budgets/`
- `/predictions/`
- `/alerts/`
- `/receipts/`
- `/plaid_integration/`
- `/categories/`
- `/import/`
- `/reports/`

## Current cleanup status

- ✅ Canonical frontend: `frontend/`
- ✅ Legacy `financeTracker/` removed
- 🔜 Next: add one-command dev workflow + env template + CI checks
