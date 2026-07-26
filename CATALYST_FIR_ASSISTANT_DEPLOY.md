# Catalyst FIR Assistant Deployment

This keeps the working hosted dashboard stable and adds a Zoho-powered FIR Intake story.

OCR and assistant review do not require Data Store tables.

The app only writes to Data Store if an officer clicks **Add to Database**.

## What This Uses

- **Zoho Catalyst Web Client Hosting** for the React app.
- **Zoho Catalyst Functions** for the FIR backend.
- **Zoho Catalyst Zia OCR** for real document OCR through the Catalyst Node SDK.
- **Zoho Catalyst ConvoKraft-ready assistant flow** through the `/assist` function route.
- Optional **Zoho Catalyst Data Store** insertion through the explicit `/commit` route.

## What The FIR Function Does

The `fir-ocr-api` function supports:

```text
POST /ocr
POST /assist
POST /commit
```

`/ocr` accepts a PDF/image and forwards it to Catalyst Zia OCR.

`/assist` reviews OCR fields and prepares officer-review guidance plus draft FIR table mappings.

`/commit` writes the reviewed OCR fields into FIR tables only when the user clicks **Add to Database**.

No database write happens immediately after OCR.

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

## Optional: Enable Add To Database

The **Add to Database** button requires the FIR Data Store tables to exist first.

If you do not create these tables, OCR and the assistant still work. Only **Add to Database** will fail.

The commit route writes to these tables:

```text
CaseMaster
ComplainantDetails
Victim
Accused
ActSectionAssociation
Inv_OccuranceTime
```

The table definitions are in:

```text
scripts/schema.sql
```

You do not need to enter row values manually. Once the tables exist, clicking **Add to Database** inserts the OCR-derived rows.

## Demo Story

You can say:

```text
The app is hosted on Zoho Catalyst Web Client Hosting. FIR Intake uses a Catalyst Function and Zia OCR to extract text from uploaded FIR PDFs/images. After OCR, a ConvoKraft-ready assistant reviews the OCR output and suggests how the extracted FIR should map into official FIR tables. The officer can optionally click Add to Database to insert the reviewed record into Catalyst Data Store.
```
