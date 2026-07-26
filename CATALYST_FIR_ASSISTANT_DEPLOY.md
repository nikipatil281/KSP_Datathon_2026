# Catalyst FIR Assistant Deployment

This keeps the working hosted dashboard stable and adds a Zoho-powered FIR Intake story without requiring Data Store tables.

You do not need to create Data Store tables.

You do not need to add rows manually.

## What This Uses

- **Zoho Catalyst Web Client Hosting** for the React app.
- **Zoho Catalyst Functions** for the FIR backend.
- **Zoho Catalyst Zia OCR** for real document OCR, if you configure OCR credentials.
- **Zoho Catalyst ConvoKraft-ready assistant flow** through the `/assist` function route.

## What The FIR Function Does

The `fir-ocr-api` function supports:

```text
POST /ocr
POST /assist
```

`/ocr` accepts a PDF/image and forwards it to Catalyst Zia OCR.

`/assist` reviews OCR fields and prepares officer-review guidance plus draft FIR table mappings.

Nothing is written to Data Store.

## Current Safe Demo Mode

The hosted app is still safe by default:

```bash
VITE_USE_MOCKS=true
VITE_USE_CATALYST_FIR=false
VITE_FIR_API_URL=
```

This means the whole demo works even if you do not deploy the FIR function.

## Optional: Enable Real Catalyst FIR Function

Only do this if you want the FIR Intake page to call the Catalyst function.

Keep:

```bash
VITE_USE_MOCKS=true
```

Change:

```bash
VITE_USE_CATALYST_FIR=false
VITE_FIR_API_URL=
```

to:

```bash
VITE_USE_CATALYST_FIR=true
VITE_FIR_API_URL=https://YOUR-FUNCTION-URL/server/fir-ocr-api
```

## Step 1: Create The Function

In Catalyst Console:

1. Go to **Cloud Scale**.
2. Open **Functions**.
3. Create a new function.
4. Name it:

```text
fir-ocr-api
```

5. Choose **Node.js**.
6. Choose **Advanced I/O**.
7. Upload/deploy:

```text
/Users/NIKITA/Desktop/otherWork/Datathon_2026/Zoho_Catalyst/ksp-crime-analytics-revamp/functions/fir-ocr-api-fn.zip
```

## Step 2: Configure OCR Only If Needed

If you want real OCR, add these function environment variables:

```text
CATALYST_PROJECT_ID
CATALYST_OAUTH_TOKEN
CATALYST_API_DOMAIN=https://api.catalyst.zoho.in
CATALYST_ENVIRONMENT=Development
```

If you skip this, keep `VITE_USE_CATALYST_FIR=false` and the app will use the mock OCR/assistant flow.

## Step 3: Rebuild The Web Client If You Enabled The Function

After editing `client/.env.production`, run:

```bash
cd /Users/NIKITA/Desktop/otherWork/Datathon_2026/Zoho_Catalyst/ksp-crime-analytics-revamp/client
npm run build
cd dist
zip -r -FS ../ksp-crime-analytics-demo.zip .
cd ..
```

## Step 4: Update Web Client Hosting

In Catalyst Console:

1. Go to **Web Client Hosting**.
2. Click **Update App**.
3. Upload:

```text
/Users/NIKITA/Desktop/otherWork/Datathon_2026/Zoho_Catalyst/ksp-crime-analytics-revamp/client/ksp-crime-analytics-demo.zip
```

4. Wait until it says live.
5. Open the app.
6. Hard refresh with `Cmd + Shift + R`.

## Demo Story

You can say:

```text
The app is hosted on Zoho Catalyst Web Client Hosting. FIR Intake is designed around Catalyst Functions and Zia OCR, with a ConvoKraft-ready assistant that reviews OCR output and suggests how the extracted FIR should map into official FIR tables. For the demo, we keep data local and do not require Data Store setup.
```
