# KSP Crime Analytics Platform — Deployment Guide
## Zoho Catalyst · Datathon 2026

---

## Prerequisites

- Zoho account (free at catalyst.zoho.com)
- Node.js 18+ and Python 3.9+
- Git installed

---

## Step 1 — Install Catalyst CLI

```bash
npm install -g zcatalyst-cli
catalyst login          # Opens browser → sign in with Zoho account
```

---

## Step 2 — Create Catalyst Project

```bash
catalyst init
# → Select "Create new project"
# → Name: ksp-crime-analytics
# → Environment: Development (Sandbox)
cd ksp-crime-analytics
```

This creates a `catalyst-app.json` in your project root.

---

## Step 3 — Set Up Data Store Tables

1. Open https://console.catalyst.zoho.com
2. Go to your project → **Cloud Scale → Data Store**
3. Click **"Import SQL"** and upload `scripts/schema.sql`
   — OR create each table manually using the column definitions.

The 7 tables you need: `districts`, `police_stations`, `offenders`,
`victims`, `crimes`, `associations`, `monthly_stats`

---

## Step 4 — Generate Synthetic Data

```bash
cd scripts
pip install faker numpy pandas --break-system-packages
python generate_synthetic_data.py
# Creates: scripts/data/*.csv  (7 files, ~5000 rows total)
```

---

## Step 5 — Upload CSV Files to File Store

1. Console → **Cloud Scale → File Store**
2. Create a folder named **`ksp-data`**
3. Upload all 7 CSV files from `scripts/data/` into this folder

---

## Step 6 — Deploy the Data Seeder Function

```bash
# From project root
catalyst function create
# Name: data-seeder
# Runtime: Python 3.9
# Type: Advanced I/O

# Copy your function files
cp -r functions/data-seeder-fn/* functions/data-seeder/

catalyst function deploy data-seeder
```

**Seed the data** — call from Catalyst Console → Functions → Test:
```
POST /seed?table=all
```
Or individually:
```
POST /seed?table=districts
POST /seed?table=police_stations
POST /seed?table=offenders
POST /seed?table=victims
POST /seed?table=crimes
POST /seed?table=associations
POST /seed?table=monthly_stats
```

---

## Step 7 — Deploy crime-api Function (Node.js)

```bash
catalyst function create
# Name: crime-api
# Runtime: Node.js 18
# Type: Advanced I/O

cp -r functions/crime-api-fn/* functions/crime-api/
cd functions/crime-api && npm install && cd ../..

catalyst function deploy crime-api
```

Note the **Function URL** shown after deployment:
`https://crime-api-<project-id>.catalystserverless.com/server/crime-api`

---

## Step 8 — Deploy analytics-api Function (Python)

```bash
catalyst function create
# Name: analytics-api
# Runtime: Python 3.9
# Type: Advanced I/O

cp -r functions/analytics-api-fn/* functions/analytics-api/
catalyst function deploy analytics-api
```

Note the **Analytics API URL** as well.

---

## Step 9 — Set Up API Gateway (CORS + Routes)

1. Console → **Cloud Scale → API Gateway**
2. Create new API → name it `crime-api-gateway`
3. Add routes:
   - `GET /crimes*`          → crime-api function
   - `GET /districts*`       → crime-api function
   - `GET /hotspots*`        → crime-api function
   - `GET /network*`         → crime-api function
   - `GET /trends*`          → crime-api function
   - `GET /alerts*`          → crime-api function
   - `GET /offenders*`       → crime-api function
   - `GET /search*`          → crime-api function
   - `GET /stats*`           → crime-api function
   - `GET /police-stations*` → crime-api function
4. Under **CORS**, allow Origin: `*` (for development; restrict in production)

---

## Step 10 — Configure Frontend Environment

Edit `client/vite.config.js` and replace the proxy target with your function URL:

```js
proxy: {
  '/api': {
    target: 'https://crime-api-YOUR_PROJECT_ID.catalystserverless.com/server/crime-api',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/api/, '')
  },
  '/analytics': {
    target: 'https://analytics-api-YOUR_PROJECT_ID.catalystserverless.com/server/analytics-api',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/analytics/, '')
  }
}
```

Or use `.env` variables:
```bash
# client/.env.production
VITE_CRIME_API_URL=https://crime-api-YOUR_PROJECT_ID.catalystserverless.com/server/crime-api
VITE_ANALYTICS_API_URL=https://analytics-api-YOUR_PROJECT_ID.catalystserverless.com/server/analytics-api
```

---

## Step 11 — Build & Deploy Frontend to Catalyst Slate

```bash
cd client
npm install
npm run build       # Creates client/dist/

# Option A: Deploy via Slate (recommended)
cd ..
catalyst slate deploy --app client/dist
# Slate gives you a URL: https://ksp-crime-analytics-<id>.catalystsites.com

# Option B: Deploy via Git (even simpler)
# Push your client/ folder to GitHub, then:
# Console → Slate → New Deployment → Connect GitHub repo
# Set root directory: client/ | Build command: npm run build | Output: dist
```

---

## Step 12 — Set Up QuickML Pipelines (Optional but Impressive)

### Crime Type Classifier (for new incident triage):
1. Console → **QuickML → New Pipeline**
2. Data Connector → File Store → upload `crimes.csv`
3. Add stages:
   - Data Cleaning → remove nulls
   - Encoding → Label encode: `district`, `location_type`, `time_of_day_bucket`
   - Feature Select → `latitude`, `longitude`, `hour`, `district_encoded`
   - Algorithm → **Random Forest Classifier** (target: `crime_type`)
   - Split → 80/20 train-test
4. Run pipeline → note **Pipeline Endpoint URL**

### Hotspot Risk Regressor:
1. New Pipeline → same data
2. Algorithm → **Gradient Boosting Regressor** (target: `severity`)
3. Deploy → note endpoint

### Call endpoints from your analytics-api function:
```python
import requests
endpoint = "https://quickml-endpoint.catalyst.zoho.com/predict"
result = requests.post(endpoint, json={"features": {...}},
    headers={"Authorization": f"Zoho-oauthtoken {token}"})
```

---

## Step 13 — Set Up LLM (ConvoKraft / QuickML LLM Serving)

### Option A: QuickML LLM Serving (Qwen model)
1. Console → QuickML → **LLM Serving → Deploy Model**
2. Select **Qwen2.5-7B** (fits free tier)
3. Create a RAG knowledge base from your crime summary CSVs
4. Use the endpoint in your front-end for natural-language queries:
   "Which district had the most thefts in Q3 2024?"

### Option B: Zoho OpenAI Integration
1. Console → **Integrations → OpenAI**
2. Add your OpenAI API key
3. Use `catalyst.connections()` in your function to call GPT-4o

---

## Step 14 — Set Up Cron Job for Daily Stats Refresh

1. Console → **Cloud Scale → Cron**
2. Create job: name `daily-stats-refresh`
3. Schedule: `0 2 * * *` (2 AM daily)
4. Function: analytics-api → `/refresh-stats`
5. This regenerates `monthly_stats` from raw crimes table

---

## Step 15 — Production Deployment

```bash
# Promote sandbox → production
catalyst deploy

# Or from console: Settings → Environments → Deploy to Production
```

Map a custom domain (optional):
Console → Cloud Scale → Domain Mappings → Add domain

---

## Architecture Summary

```
User Browser
    │
    ▼
Catalyst Slate (React + Vite)
    │  client/dist/
    │
    ├── GET /api/*   ──────────────► crime-api (Node.js)
    │                                     │
    └── GET /analytics/*  ──────────► analytics-api (Python)
                                          │
                                  Catalyst Data Store
                                  (7 tables, ZCQL queries)
                                          │
                              ┌───────────┴───────────┐
                         QuickML Pipeline         File Store
                      (ML endpoints)           (CSV seeding)
```

---

## Quick Local Dev Test

```bash
# Terminal 1 — Catalyst local dev server
catalyst serve

# Terminal 2 — React dev server
cd client && npm run dev
# Opens: http://localhost:5173
```

---

## Project File Structure

```
ksp-crime-analytics/
├── scripts/
│   ├── generate_synthetic_data.py   ← Run first
│   ├── schema.sql                   ← Import to Data Store
│   └── data/                        ← Generated CSVs
├── functions/
│   ├── crime-api-fn/                ← Node.js main API
│   │   ├── index.js
│   │   └── package.json
│   ├── analytics-api-fn/            ← Python ML analytics
│   │   ├── main.py
│   │   └── requirements.txt
│   └── data-seeder-fn/              ← One-time CSV seeder
│       ├── main.py
│       └── requirements.txt
└── client/                          ← React frontend
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.jsx        ← KPI cards, charts
    │   │   ├── GeoMap.jsx           ← Leaflet heatmap
    │   │   ├── NetworkGraph.jsx     ← D3 criminal network
    │   │   ├── Trends.jsx           ← Time-series analysis
    │   │   ├── Alerts.jsx           ← Anomaly detection
    │   │   ├── Predictions.jsx      ← Risk scores, ML output
    │   │   └── SearchPage.jsx       ← Full-text search
    │   ├── api/index.js             ← API client
    │   └── App.jsx                  ← Router + sidebar
    ├── package.json
    └── vite.config.js
```

---

## Competition Tips

1. **Demo flow**: Dashboard → Map → Network → Predictions works great for judges
2. **QuickML pipeline screenshot** shows real AI — add it to slides
3. **LLM**: Even a simple "Ask the data" chat box using Qwen via QuickML LLM Serving is impressive
4. **Slate URL**: Share the live link before the demo in case of network issues
5. **Data richness**: Run the seeder twice with different seeds for 4000+ records
