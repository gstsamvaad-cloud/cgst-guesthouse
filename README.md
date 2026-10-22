# CGST & Customs Guest House — Vercel Deployment

Full-stack serverless portal. **Vercel** (Node.js serverless functions) + **Neon** (serverless Postgres).

---

## Deploy in 5 steps

### 1. Create a Neon database (free)
1. Go to **https://neon.tech** → Sign up → New Project
2. Copy the **Connection string** (starts with `postgresql://...`)

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create cgst-guesthouse --public --push
# or push to your existing GitHub repo
```

### 3. Deploy to Vercel
1. Go to **https://vercel.com** → New Project → Import your GitHub repo
2. Vercel auto-detects the config from `vercel.json` — no build settings needed
3. Add these **Environment Variables** in the Vercel dashboard:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SMTP_HOST` | `smtp.gmail.com` (or your SMTP host) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Your Gmail **App Password** (16 chars) |
| `EMAIL_FROM` | `"CGST Guest House <your@email.com>"` |

4. Click **Deploy**

### 4. Run migrations + seed (one time only)
After deployment, run locally with your Neon DATABASE_URL in `.env`:
```bash
cp .env.example .env
# Paste your DATABASE_URL into .env

npm install
npm run db:migrate
npm run db:seed
```

### 5. Open your site
Your portal is live at `https://your-project.vercel.app`

Default officer login: `officer@cgst.gov.in` / `Officer@123#Change`  
**Change the password immediately after first login.**

---

## Gmail App Password setup
1. Go to Google Account → Security → 2-Step Verification (enable it)
2. Search "App passwords" → Create one for "Mail"
3. Use the 16-character code as `SMTP_PASS`

---

## Project structure
```
vercel-guesthouse/
├── api/                    ← Serverless functions (one file = one endpoint)
│   ├── auth/
│   │   ├── login.js        POST /api/auth/login
│   │   ├── logout.js       POST /api/auth/logout
│   │   ├── me.js           GET  /api/auth/me
│   │   └── register.js     POST /api/auth/register
│   ├── bookings/
│   │   ├── index.js        GET/POST /api/bookings
│   │   ├── availability.js GET  /api/bookings/availability
│   │   ├── pending.js      GET  /api/bookings/pending
│   │   └── [id]/
│   │       ├── approve.js  POST /api/bookings/:id/approve
│   │       └── reject.js   POST /api/bookings/:id/reject
│   ├── rooms/
│   │   ├── index.js        GET/POST /api/rooms
│   │   └── [id].js         DELETE   /api/rooms/:id
│   ├── notifications/
│   │   └── index.js        GET/PATCH /api/notifications
│   └── health.js           GET /api/health
├── lib/                    ← Shared utilities
│   ├── auth.js             JWT sign/verify/authenticate
│   ├── db.js               Neon serverless DB client
│   ├── domain.js           Rates, room types, helpers
│   ├── helpers.js          Response helpers, CORS, cookie
│   └── mailer.js           Nodemailer email templates
├── public/                 ← Static frontend (SPA)
│   ├── index.html
│   ├── css/app.css
│   └── js/app.js
├── scripts/
│   ├── migrate.js          npm run db:migrate
│   └── seed.js             npm run db:seed
├── vercel.json             Vercel routing config
└── package.json
```

---

## Security notes
- Passwords hashed with **bcrypt** (12 rounds)
- JWT in **HttpOnly cookie** — never accessible to JS
- Officer-only routes double-checked server-side
- Neon uses **SSL** by default — connection is encrypted
- Room overlap checked at approve time — no double bookings
