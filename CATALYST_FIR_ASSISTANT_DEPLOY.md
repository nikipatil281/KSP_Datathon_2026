# Catalyst FIR Assistant Deployment

This keeps the working hosted dashboard stable and adds a Zoho-powered FIR Intake story without requiring Data Store tables.

You do not need to create Data Store tables.

You do not need to add rows manually.

## What This Uses

- **Zoho Catalyst Web Client Hosting** for the React app.
- **Zoho Catalyst Functions** for the FIR backend.
- **Zoho Catalyst Zia OCR** for real document OCR through the Catalyst Node SDK.
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

## Current Real OCR Mode

The production web build is configured for real OCR in your current Catalyst project:

```bash
VITE_USE_MOCKS=true
VITE_USE_CATALYST_FIR=true
VITE_FIR_API_URL=https://datathon-demo-60075190019.development.catalystserverless.in/server/fir-ocr-api
```

This keeps the dashboard on stable mock data, but sends FIR uploads to the Catalyst function.

If you create a different Catalyst project or use a different function URL, replace `VITE_FIR_API_URL` with the URL Catalyst shows for your `fir-ocr-api` function.

## Required: Deploy The Real OCR Function

The FIR Intake page will show real OCR only after this function exists.

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

## Step 2: Confirm Zia OCR Access

The function uses the Catalyst Node SDK:

```js
app.zia().extractOpticalCharacters(...)
```

You should not need to paste an OAuth token into the function.

If OCR fails after deployment, check that Zia Services/OCR is available in your Catalyst project and that your project plan allows it.

## Step 3: Rebuild The Web Client

Run:

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
The app is hosted on Zoho Catalyst Web Client Hosting. FIR Intake uses a Catalyst Function and Zia OCR to extract text from uploaded FIR PDFs/images. After OCR, a ConvoKraft-ready assistant reviews the OCR output and suggests how the extracted FIR should map into official FIR tables. We intentionally do not require Data Store setup for the demo.
```
