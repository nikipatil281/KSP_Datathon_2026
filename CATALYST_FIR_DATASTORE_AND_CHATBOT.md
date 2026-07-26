# Catalyst FIR Data Store And Chatbot Setup

This guide adds more Zoho Catalyst products to the working demo without replacing the stable mock dashboard.

The dashboard still uses bundled demo data.

The FIR Intake page can additionally use:

- Web Client Hosting
- Catalyst Functions
- Zia OCR
- Data Store
- ConvoKraft-style chatbot flow

## What Was Added In Code

The FIR function now supports:

```text
POST /ocr
POST /assist
POST /drafts
```

`/ocr` sends the uploaded FIR document to Catalyst Zia OCR.

`/assist` reviews OCR fields and prepares draft table mappings like `CaseMaster`, `Victim`, `Accused`, and `ActSectionAssociation`.

`/drafts` saves the reviewed output into a Catalyst Data Store table called `FIRIntakeDrafts`.

## Important Safety Switches

The hosted app still uses mock data by default:

```bash
VITE_USE_MOCKS=true
VITE_USE_CATALYST_FIR=false
VITE_FIR_API_URL=
```

When the FIR function is deployed, change only these two lines:

```bash
VITE_USE_CATALYST_FIR=true
VITE_FIR_API_URL=https://YOUR-FUNCTION-URL/server/fir-ocr-api
```

Keep this line unchanged:

```bash
VITE_USE_MOCKS=true
```

That keeps the dashboard safe while FIR Intake uses Catalyst.

## Step 1: Create The Data Store Table

In Zoho Catalyst Console:

1. Open your project.
2. Go to **Cloud Scale**.
3. Open **Data Store**.
4. Create a new table named:

```text
FIRIntakeDrafts
```

5. Add these columns:

```text
FIRNumber          VARCHAR
SourceFile         VARCHAR
OCRProvider        VARCHAR
OCRConfidence      VARCHAR
District           VARCHAR
PoliceStation      VARCHAR
CrimeType          VARCHAR
IncidentDate       VARCHAR
LegalSections      VARCHAR
ReviewStatus       VARCHAR
ExtractedJson      TEXT
TablePayloadJson   TEXT
AssistantNotes     TEXT
```

If Catalyst asks for max lengths, use:

```text
80 for FIRNumber
255 for SourceFile
80 for OCRProvider
40 for OCRConfidence
120 for District
160 for PoliceStation
160 for CrimeType
40 for IncidentDate
500 for LegalSections
80 for ReviewStatus
Large/Text for the three JSON columns
```

## Step 2: Deploy The FIR Function

In Catalyst Console:

1. Go to **Cloud Scale**.
2. Open **Functions**.
3. Create a new function.
4. Name it exactly:

```text
fir-ocr-api
```

5. Choose **Node.js 18** or the latest supported Node.js runtime.
6. Choose **Advanced I/O**.

Upload or deploy the files from:

```text
functions/fir-ocr-api-fn/
```

The function folder contains:

```text
index.js
package.json
```

## Step 3: Configure OCR Environment Variables

In the `fir-ocr-api` function settings, add:

```text
CATALYST_PROJECT_ID
CATALYST_OAUTH_TOKEN
CATALYST_API_DOMAIN
CATALYST_ENVIRONMENT
```

Use:

```text
CATALYST_API_DOMAIN=https://api.catalyst.zoho.in
CATALYST_ENVIRONMENT=Development
```

`CATALYST_PROJECT_ID` is your Catalyst project ID.

`CATALYST_OAUTH_TOKEN` is needed only for the real Zia OCR forwarding path.

If you do not configure OCR yet, `/assist` and `/drafts` can still work, but `/ocr` will fail.

## Step 4: Copy The Function URL

After deployment, Catalyst will show a function URL.

It should look roughly like:

```text
https://PROJECT-NAME-PROJECTID.development.catalystserverless.in/server/fir-ocr-api
```

Copy that URL.

## Step 5: Enable Catalyst FIR Mode In The Frontend

Open:

```text
client/.env.production
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

Do not change:

```bash
VITE_USE_MOCKS=true
```

## Step 6: Rebuild The Web Client

Run:

```bash
cd /Users/NIKITA/Desktop/otherWork/Datathon_2026/Zoho_Catalyst/ksp-crime-analytics-revamp/client
npm run build
cd dist
zip -r -FS ../ksp-crime-analytics-demo.zip .
cd ..
```

## Step 7: Update Web Client Hosting

In Catalyst Console:

1. Go to **Web Client Hosting**.
2. Click **Update App**.
3. Upload:

```text
/Users/NIKITA/Desktop/otherWork/Datathon_2026/Zoho_Catalyst/ksp-crime-analytics-revamp/client/ksp-crime-analytics-demo.zip
```

4. Wait until it says live.
5. Open the app URL.
6. Hard refresh with `Cmd + Shift + R`.

## Step 8: Test FIR Intake

1. Open **FIR Intake**.
2. Upload a PDF/image.
3. Click **Run OCR Extraction**.
4. The OCR result appears.
5. The FIR Assistant prepares draft table mappings.
6. Click **Mark Reviewed**.
7. Go to **Data Store**.
8. Open `FIRIntakeDrafts`.
9. Confirm a new row was inserted.

## ConvoKraft Chatbot Story

Catalyst ConvoKraft bots can use backend logic through Catalyst Integration Functions or webhooks.

For this demo, the FIR Intake page already includes an assistant panel that calls:

```text
POST /assist
```

You can describe it as:

```text
The FIR assistant is ConvoKraft-ready. After OCR, the assistant reviews the extracted text, recommends field corrections, and prepares Data Store table payloads before the officer saves the draft.
```

If you create a ConvoKraft bot in Catalyst later, configure its action/webhook to call the same `/assist` route. That makes the chatbot and FIR pipeline share the same backend mapping logic.

## Products You Can Claim In The Demo

- **Zoho Catalyst Web Client Hosting**: hosts the React app.
- **Zoho Catalyst Functions**: runs the FIR OCR/save backend.
- **Zoho Catalyst Zia OCR**: extracts text from FIR PDFs/images.
- **Zoho Catalyst Data Store**: stores reviewed FIR draft rows.
- **Zoho Catalyst ConvoKraft**: chatbot-style FIR assistant flow, with `/assist` ready as the bot backend.
