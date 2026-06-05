# SecureNotes — Deployment Guide (Firebase + Cloud Run)

## Architecture Overview

```
┌─────────────────────┐     HTTPS      ┌────────────────────┐     gRPC      ┌──────────────┐
│   Mobile App        │ ──────────────► │   Cloud Run        │ ────────────► │  Firestore   │
│   (React Native /   │                 │   (Backend API)    │               │  (NoSQL)     │
│    Expo)            │                 │   Port 8080        │               │  Free tier   │
│   iOS + Android     │                 │   Node.js/Express  │               │              │
└─────────────────────┘                 └────────────────────┘               └──────────────┘
```

## Cost Breakdown

| Service             | Tier / Free Allowance        | Monthly Cost   |
|---------------------|------------------------------|----------------|
| Cloud Run           | 2M requests, 360K vCPU-sec   | **$0**         |
| Firestore           | 1 GB storage, 50K reads/day, 20K writes/day | **$0** |
| Secret Manager      | 10K access operations        | **$0**         |
| **Total**           |                              | **$0/month**   |

For a single-user personal app, you will stay well within free tier limits.

## Security Features
- Password hashing with bcrypt (12 rounds)
- JWT access + refresh token rotation
- TOTP-based MFA (Google Authenticator / Authy compatible)
- Biometric authentication (fingerprint / Face ID) on mobile
- AES-256-CBC encryption for stored credentials (unique IV per field)
- Rate limiting on all endpoints
- Helmet security headers
- Per-user data isolation via Firestore queries

---

## Step 1: Push Code to GitHub

First, push the project to a **private** GitHub repo.

```bash
cd secure-notes-app

git init
git add .
git commit -m "Initial commit: SecureNotes app"

# Option A: Using GitHub CLI
gh repo create securenotes --private --source=. --push

# Option B: Manual — create repo at github.com first, then:
# git remote add origin git@github.com:YOUR_USERNAME/securenotes.git
# git push -u origin main
```

---

## Step 2: Create Firestore Database (GCP Console GUI)

1. Go to **https://console.cloud.google.com**
2. Select your project (or create a new one)
3. In the search bar, type **Firestore** and click on it
4. Click **Create Database**
5. Select **Native mode**
6. Location: select **asia-southeast1 (Singapore)**
7. Click **Create Database**

That's it — Firestore is ready. No tables or schemas to define.

---

## Step 3: Create Secrets (GCP Console GUI)

You need to store 2 secrets. First generate them on your Mac terminal:

```bash
# Run these on your Mac terminal to generate values — copy the output
openssl rand -base64 48
openssl rand -hex 32
```

Then store them in GCP:

1. Go to **https://console.cloud.google.com/security/secret-manager**
2. Click **Enable API** if prompted
3. Click **+ Create Secret**
   - Name: `jwt-secret`
   - Secret value: paste the output of the first `openssl` command
   - Click **Create Secret**
4. Click **+ Create Secret** again
   - Name: `credential-encryption-key`
   - Secret value: paste the output of the second `openssl` command
   - Click **Create Secret**

---

## Step 4: Deploy to Cloud Run (GCP Console GUI)

This is the key step — Cloud Run will connect directly to your GitHub repo,
build the Docker image, and deploy it automatically.

1. Go to **https://console.cloud.google.com/run**
2. Click **Create Service**
3. Select **"Continuously deploy from a repository"**
4. Click **Set up with Cloud Build**
   - Click **Connect Repository**
   - Select **GitHub** as the provider
   - Authenticate and select your **securenotes** repo
   - Branch: `^main$`
   - Build Type: **Dockerfile**
   - Source location: `/backend/Dockerfile`
   - Click **Save**
5. Configure the service:
   - Service name: `securenotes-api`
   - Region: **asia-southeast1 (Singapore)**
   - Authentication: **Allow unauthenticated invocations**
6. Expand **Container, Volumes, Networking, Security**:
   - **Container tab:**
     - Container port: `8080`
     - Memory: `256 MiB`
     - CPU: `1`
     - Min instances: `0`
     - Max instances: `5`
   - **Environment variables** — click **+ Add Variable**:
     - `NODE_ENV` = `production`
     - `GCP_PROJECT_ID` = your project ID
   - **Secrets** — click **+ Reference a Secret**:
     - Select `jwt-secret` → Exposed as **Environment variable** → Name: `JWT_SECRET` → Version: `latest`
     - Select `credential-encryption-key` → Exposed as **Environment variable** → Name: `CREDENTIAL_ENCRYPTION_KEY` → Version: `latest`
7. Click **Create**

Cloud Run will now:
- Pull your code from GitHub
- Build the Docker image using `backend/Dockerfile`
- Deploy it

After a few minutes, you'll see a URL like:
```
https://securenotes-api-XXXXXX-as.a.run.app
```

### Automatic redeployment

Because you chose **"Continuously deploy from a repository"**, every time you
`git push` to `main`, Cloud Run will automatically rebuild and redeploy.
You don't need GitHub Actions — Cloud Build handles it natively.

---

## Step 5: Verify Deployment

Open the URL from Step 4 in your browser and add `/health`:
```
https://securenotes-api-XXXXXX-as.a.run.app/health
```

You should see:
```json
{"status":"ok"}
```

Test registration from your Mac terminal:
```bash
curl -X POST https://securenotes-api-XXXXXX-as.a.run.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"SecurePass123"}'
```

---

## Step 6: Create Firestore Indexes

When you first use the notes, tasks, or credentials endpoints, you may see
errors about missing indexes. The easiest way to fix this:

1. Go to **https://console.cloud.google.com/run** → click your service → **Logs**
2. Look for error messages that say "The query requires an index"
3. Each error includes a **clickable link** — click it
4. It opens the Firestore index creation page — just click **Create**
5. Wait 1-2 minutes for the index to build

You'll need to do this 3-4 times (once for notes, tasks, tasks with filter, credentials).
After that, everything works permanently.

---

## Step 7: Configure the Mobile App

1. Open `mobile/src/services/api.js`
2. Replace `YOUR-CLOUD-RUN-URL` with your actual Cloud Run URL:
   ```js
   const API_BASE = 'https://securenotes-api-XXXXXX-as.a.run.app';
   ```

---

## Step 8: Build the Mobile App

```bash
cd mobile

# Install dependencies
npm install

# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS Build
eas build:configure

# Build for Android (APK)
eas build --platform android --profile production

# Build for iOS (requires Apple Developer account)
eas build --platform ios --profile production
```

### For local development testing:
```bash
npx expo start
# Scan QR code with Expo Go app on your phone
```

---

## How to Update the App Going Forward

```bash
# 1. Edit any file in the backend/ folder
# 2. Commit and push
git add .
git commit -m "Update notes endpoint"
git push

# 3. Cloud Run automatically rebuilds and deploys (2-3 minutes)
# 4. Your app is updated — no manual steps needed
```

---

## Firestore Data Structure

```
users/
  {userId}/
    username: "john"
    email: "john@example.com"
    password: "$2a$12$..."        (bcrypt hash)
    mfaSecret: "BASE32SECRET"     (TOTP secret, null if not set up)
    mfaEnabled: false
    refreshToken: "jwt..."
    createdAt: "2026-05-26T..."

notes/
  {noteId}/
    userId: "abc123"
    title: "My Note"
    content: "Note body text..."
    color: "#ffffff"
    pinned: false
    createdAt: "2026-05-26T..."
    updatedAt: "2026-05-26T..."

tasks/
  {taskId}/
    userId: "abc123"
    title: "Buy groceries"
    description: "Milk, eggs, bread"
    completed: false
    dueDate: "2026-05-27"
    priority: "medium"             (low | medium | high)
    createdAt: "2026-05-26T..."
    updatedAt: "2026-05-26T..."

credentials/
  {credentialId}/
    userId: "abc123"
    serviceName: "Gmail"
    serviceUrl: "https://gmail.com"
    username: "a1b2c3..."          (AES-256-CBC encrypted)
    iv: "d4e5f6..."               (IV for username)
    password: "f7e8d9..."         (AES-256-CBC encrypted)
    passwordIv: "c3b2a1..."       (IV for password)
    notes: "Work account"
    createdAt: "2026-05-26T..."
    updatedAt: "2026-05-26T..."
```

## Project Structure

```
secure-notes-app/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── server.js               # Express entry point
│       ├── models/index.js          # Firebase Admin + Firestore init
│       ├── middleware/auth.js        # JWT authentication
│       ├── routes/
│       │   ├── auth.js              # Register, Login, MFA, Refresh, Logout
│       │   ├── notes.js             # Notes CRUD
│       │   ├── tasks.js             # Tasks CRUD
│       │   └── credentials.js       # Encrypted credential vault
│       └── utils/crypto.js          # AES-256 encrypt/decrypt
│
└── mobile/
    ├── App.js
    ├── app.json
    ├── package.json
    └── src/
        ├── context/AuthContext.js
        ├── services/api.js
        └── screens/
            ├── LoginScreen.js
            ├── RegisterScreen.js
            ├── NotesScreen.js
            ├── TasksScreen.js
            ├── CredentialsScreen.js
            └── SettingsScreen.js
```

## API Endpoints

| Method | Endpoint                | Auth | Description                    |
|--------|-------------------------|------|--------------------------------|
| POST   | /api/auth/register      | No   | Create account                 |
| POST   | /api/auth/login         | No   | Login (supports MFA)           |
| POST   | /api/auth/refresh       | No   | Refresh JWT tokens             |
| POST   | /api/auth/logout        | Yes  | Invalidate refresh token       |
| GET    | /api/auth/me            | Yes  | Get current user profile       |
| POST   | /api/auth/mfa/setup     | Yes  | Generate MFA secret            |
| POST   | /api/auth/mfa/verify    | Yes  | Verify & enable MFA            |
| POST   | /api/auth/mfa/disable   | Yes  | Disable MFA                    |
| GET    | /api/notes              | Yes  | List all notes                 |
| POST   | /api/notes              | Yes  | Create note                    |
| PUT    | /api/notes/:id          | Yes  | Update note                    |
| DELETE | /api/notes/:id          | Yes  | Delete note                    |
| GET    | /api/tasks              | Yes  | List tasks (filter by date)    |
| POST   | /api/tasks              | Yes  | Create task                    |
| PUT    | /api/tasks/:id          | Yes  | Update task                    |
| PATCH  | /api/tasks/:id/toggle   | Yes  | Toggle task completion         |
| DELETE | /api/tasks/:id          | Yes  | Delete task                    |
| GET    | /api/credentials        | Yes  | List credentials (no secrets)  |
| GET    | /api/credentials/:id    | Yes  | Get decrypted credential       |
| POST   | /api/credentials        | Yes  | Store encrypted credential     |
| PUT    | /api/credentials/:id    | Yes  | Update credential              |
| DELETE | /api/credentials/:id    | Yes  | Delete credential              |
| GET    | /health                 | No   | Health check                   |
