# FinTracker — Deployment Guide

## Architecture

```
┌─────────────────────┐     HTTPS      ┌────────────────────┐     gRPC      ┌──────────────────────┐
│   Mobile App        │ ──────────────► │   Cloud Run        │ ────────────► │  Existing Firestore  │
│   (Expo)            │                 │   (Node.js API)    │               │  (2 Firebase projects)│
│   iOS + Android     │                 │   asia-southeast1  │               │  Same data as web app│
└─────────────────────┘                 └────────────────────┘               └──────────────────────┘
```

Data is shared with your existing Streamlit app — both apps read/write the same Firestore.

## Cost: $0/month (free tier)

---

## Step 1: Push to GitHub

```bash
cd financial-tracker-app

git init
git add .
git commit -m "Initial commit: FinTracker mobile app"

# Create private repo
gh repo create fintracker --private --source=. --push
```

---

## Step 2: Create Secrets in GCP (Console GUI)

Generate secrets on your Mac:
```bash
openssl rand -base64 48
```

Go to **https://console.cloud.google.com/security/secret-manager**:
1. **+ Create Secret** → Name: `ft-jwt-secret` → paste the openssl output
2. **+ Create Secret** → Name: `ft-gemini-key` → paste your Gemini API key

---

## Step 3: Deploy Backend to Cloud Run (Console GUI)

1. Go to **https://console.cloud.google.com/run**
2. Click **Create Service**
3. Select **"Continuously deploy from a repository"**
4. Click **Set up with Cloud Build**:
   - Connect your **fintracker** GitHub repo
   - Branch: `^main$`
   - Build Type: **Dockerfile**
   - Source location: `/backend/Dockerfile`
   - Click **Save**
5. Configure:
   - Service name: `fintracker-api`
   - Region: **asia-southeast1 (Singapore)**
   - Authentication: **Allow unauthenticated invocations**
6. Expand **Container, Volumes, Networking, Security**:
   - **Container:**
     - Port: `8080`
     - Memory: `512 MiB`
     - CPU: `1`
     - Min instances: `0`, Max instances: `5`
   - **Environment variables:**
     - `NODE_ENV` = `production`
     - `FAI_PROJECT_ID` = `financialtrackerapp-453413`
     - `SEE_PROJECT_ID` = `see-financialtrackerapp`
     - `USD_MYR_RATE` = `4.42`
   - **Secrets:**
     - `ft-jwt-secret` → env var `JWT_SECRET` → version `latest`
     - `ft-gemini-key` → env var `GEMINI_API_KEY` → version `latest`
7. Click **Create**

### Grant Permissions

The Cloud Run service account needs access to **both** Firebase projects.

Find your service account (shown in Cloud Run service details), then in **each** Firebase project's IAM:
- Go to **https://console.cloud.google.com/iam-admin/iam**
- Switch to project `financialtrackerapp-453413`
- **+ Grant Access** → paste the Cloud Run service account email → Role: **Cloud Datastore User**
- Switch to project `see-financialtrackerapp`
- **+ Grant Access** → same service account → Role: **Cloud Datastore User**

Also grant Secret Manager access (same as SecureNotes setup).

### Verify

```bash
curl https://fintracker-api-XXXXX-as.a.run.app/health
# Expected: {"status":"ok"}
```

---

## Step 4: Configure Mobile App

Update `mobile/src/services/api.js`:
```js
const API_BASE = 'https://fintracker-api-XXXXX-as.a.run.app';
```

---

## Step 5: Build Mobile App

```bash
cd mobile
npm install
eas init
eas build:configure
eas build --platform android --profile production
```

Install the APK on your phone.

---

## Step 6: Future Updates

| What changed | Command |
|---|---|
| Backend code | `git push` → Cloud Run auto-rebuilds |
| Mobile screens/logic | `eas update --branch production --message "description"` |
| New native dependency | `eas build --platform android --profile production` |

---

## App Structure

```
financial-tracker-app/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── config/
│       │   ├── firebase.js       # 2 Firebase projects init
│       │   └── collections.js    # Per-user collection schemas
│       ├── middleware/
│       │   └── auth.js           # JWT auth
│       └── routes/
│           ├── auth.js           # Login (Firebase Auth REST API)
│           ├── data.js           # Generic CRUD for any collection
│           ├── dashboard.js      # Wealth, income, expense aggregation
│           ├── templates.js      # Transaction templates
│           ├── accounts.js       # Credential vault
│           └── ai.js             # Gemini AI chatbot
│
└── mobile/
    ├── App.js                    # Navigation (4 tabs + More stack)
    ├── app.json
    ├── eas.json
    └── src/
        ├── context/AuthContext.js
        ├── services/api.js
        └── screens/
            ├── LoginScreen.js          # Email/password login
            ├── DashboardScreen.js      # Wealth, income, expense charts
            ├── MonthlyExpenseScreen.js  # Budget vs actual
            ├── TransactionScreen.js    # Add/Edit/Delete transactions
            ├── CommitmentScreen.js     # Monthly commitments
            ├── AccountsScreen.js       # Password vault
            ├── TemplatesScreen.js      # Transaction templates
            ├── AIChatScreen.js         # Financial Mate AI
            └── SettingsScreen.js       # Profile, exchange rate, logout
```

## Mobile App Navigation

```
Bottom Tabs:
├── Dashboard        → Wealth, Income, Expense, Card, Investment charts
├── Monthly          → Budget vs actual spending for current month
├── Transactions     → Add / Edit / Delete records in any collection
└── More
    ├── Commitment   → Monthly commitment chart & details
    ├── Accounts     → Password/credential vault
    ├── Templates    → Transaction templates (apply, create, edit)
    ├── Financial Mate → AI chatbot (Gemini)
    └── Settings     → Profile, USD rate, logout
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/login | No | Firebase Auth login |
| POST | /api/auth/refresh | Yes | Refresh JWT |
| GET | /api/auth/me | Yes | Current user info |
| GET | /api/data/:collection | Yes | List collection docs |
| POST | /api/data/:collection | Yes | Add document |
| PUT | /api/data/:collection/:id | Yes | Update document |
| DELETE | /api/data/:collection/:id | Yes | Delete document |
| GET | /api/dashboard/wealth | Yes | Wealth summary |
| GET | /api/dashboard/income-summary | Yes | Monthly income |
| GET | /api/dashboard/expense-summary | Yes | Monthly expenses |
| GET | /api/dashboard/card-summary | Yes | Card usage |
| GET | /api/dashboard/commitment | Yes | Commitments |
| GET | /api/accounts | Yes | List accounts (names only) |
| GET | /api/accounts/:id | Yes | Get account details |
| POST | /api/accounts | Yes | Add account |
| PUT | /api/accounts/:id | Yes | Update account |
| DELETE | /api/accounts/:id | Yes | Delete account |
| GET | /api/templates | Yes | List templates |
| POST | /api/templates | Yes | Create template |
| PUT | /api/templates/:id | Yes | Update template |
| DELETE | /api/templates/:id | Yes | Delete template |
| POST | /api/templates/:id/apply | Yes | Apply template |
| POST | /api/ai/chat | Yes | Chat with AI |
| GET | /api/ai/history | Yes | Get chat history |
| DELETE | /api/ai/history | Yes | Clear chat |
