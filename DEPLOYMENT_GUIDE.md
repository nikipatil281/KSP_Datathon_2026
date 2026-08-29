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
   - `POST /search/assistant` → crime-api function
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
VITE_USE_MOCKS=true
VITE_USE_CATALYST_SEARCH=true
VITE_CRIME_API_URL=https://crime-api-YOUR_PROJECT_ID.catalystserverless.com/server/crime-api
VITE_ANALYTICS_API_URL=https://analytics-api-YOUR_PROJECT_ID.catalystserverless.com/server/analytics-api
```

For the Search tab chatbot, keep `VITE_USE_CATALYST_SEARCH=true`. This allows the deployed web client to call the Catalyst `crime-api` function for natural-language search while the rest of the demo can continue using stable mock data. The browser does not call the LLM directly.

The chatbot route is:

```text
POST /search/assistant
```

It accepts:

```json
{ "message": "criminals with a history of theft and associated with a gang" }
```

It returns the Zoho LLM-generated ZCQL query, the schema metadata used to generate it, filter chips, and result rows.

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

## Step 13 — Search Chatbot / LLM Options

The Search tab now includes a deployable natural-language database assistant. The browser sends normal English to the `crime-api` function. The function sends the question plus database metadata to a Zoho QuickML Generative AI / LLM endpoint, validates the returned ZCQL, then executes it through Catalyst Data Store.

```text
offenders
crimes
crime_offenders
associations
```

The generated ZCQL is displayed in the UI before the result table so officers can see exactly how the data was filtered.

### Option A: Current Implementation With The GLM Chat API

Use the built-in `POST /search/assistant` route in `functions/crime-api-fn/index.js`.

1. Catalyst Console -> QuickML -> Generative AI -> LLM Serving.
2. Pick the available text model for your data center. GLM-4.7 Flash is the best fit when available because Catalyst documents tool calling support for it.
3. Open GLM-4.7-Flash -> Sample Request and Response.
4. Copy the Endpoint URL, Model ID, `CATALYST-ORG` header value, and OAuth scope.
5. In the LLM playground, test prompts that ask for JSON only:

```text
Return only JSON:
{"intent":"...","target":"offenders","sql":"SELECT ... LIMIT 100","filters":[]}
```

6. Add these environment variables to the `crime-api` function:

```bash
ZOHO_QUICKML_LLM_ENDPOINT=https://api.catalyst.zoho.in/quickml/v1/project/47006000000078001/glm/chat
ZOHO_QUICKML_MODEL=crm-di-glm47b_30b_it
ZOHO_CATALYST_ORG_ID=60075190019
ZOHO_LLM_ENDPOINT_TYPE=glm_chat
```

7. Add one auth option. Preferred: create a Catalyst Connection/OAuth credential with `QuickML.deployment.READ`, then set:

```bash
ZOHO_QUICKML_CONNECTOR_NAME=your_connector_name
```

For a short-lived manual test only, set the access token directly:

```bash
ZOHO_QUICKML_ACCESS_TOKEN=access token with QuickML.deployment.READ
```

The docs panel may show either `Authorization: Zoho-oauthtoken <access-token>` or a sample with `Bearer YOUR_TOKEN`. The function defaults to `Zoho-oauthtoken`. If your test call only works with Bearer, add:

```bash
ZOHO_LLM_AUTH_SCHEME=Bearer
```

The code sends the GLM chat payload like this:

```js
{
  model: process.env.ZOHO_QUICKML_MODEL,
  messages: [
    { role: 'system', content: 'Return only valid JSON.' },
    { role: 'user', content: promptWithDatabaseSchema }
  ],
  max_tokens: 1200,
  temperature: 0.1,
  stream: false
}
```

8. Deploy the updated `crime-api` Advanced I/O function.
9. Add the API Gateway route `POST /search/assistant`.
10. Set `VITE_USE_CATALYST_SEARCH=true`.
11. Set `VITE_CRIME_API_URL` to the deployed `crime-api` function URL.
12. Rebuild and deploy the web client.

This is the safest demo path because the function keeps the LLM credentials server-side, gives the LLM database metadata, and refuses to execute anything except single-statement read-only ZCQL against supported tables.

### Option B: ConvoKraft Frontend Bot

Zoho Catalyst ConvoKraft can be embedded in Catalyst solutions and can call backend logic through Catalyst Integration Functions, Deluge, or webhooks. To convert this into a full ConvoKraft widget:

1. Console → ConvoKraft → Create bot.
2. Add an action such as `search_database`.
3. Configure the action backend to call the same `POST /search/assistant` logic or wrap it in an Integration Function.
4. Train utterances like:
   - `criminals with a history of theft`
   - `show high risk offenders in a gang`
   - `theft cases in 2024`
5. Deploy the bot.
6. Embed the ConvoKraft JavaScript Client SDK widget in the React client if you want the native Zoho chat window.

The current in-app assistant is still recommended for this project because it shows the generated ZCQL and the result table directly inside the Search page.

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
