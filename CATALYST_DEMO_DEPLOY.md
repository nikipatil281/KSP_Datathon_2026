# Catalyst Demo Deployment Guide

This deployment path is for the hackathon/demo version of the app.

The deployed website will show the same data and screens as the local app. It does not need Zoho Catalyst Data Store, CSV upload, or backend functions.

## What This Setup Does

- Uses the bundled JSON data in `client/src/mock-data/`.
- Forces production builds to use mock data with `VITE_USE_MOCKS=true`.
- Builds a plain static React/Vite website.
- Uploads the built `client/dist` files to Zoho Catalyst Web Client Hosting.

## Before You Start

You need:

- A Zoho Catalyst account.
- Node.js installed.
- This repo on your machine.

You do not need to create Data Store tables.

You do not need to upload CSV files.

You do not need to deploy the functions for this demo path.

## Step 1: Open The Project Locally

Open Terminal and run:

```bash
cd /Users/NIKITA/Desktop/otherWork/Datathon_2026/Zoho_Catalyst/ksp-crime-analytics-revamp/client
```

## Step 2: Confirm Demo Mode Is Enabled

Open this file:

```text
client/.env.production
```

It should contain:

```bash
VITE_USE_MOCKS=true
```

This is the important line. It tells the deployed site to use the bundled local demo data.

## Step 3: Build The Website

From inside the `client` folder, run:

```bash
npm run build
```

When it finishes, you should have:

```text
client/dist
```

That `dist` folder is the website you will upload to Catalyst.

## Step 4: Check The Catalyst Package File

Run:

```bash
ls dist/client-package.json dist/index.html
```

Both files must exist.

Catalyst needs `client-package.json` in the root of the uploaded website package. This repo keeps it in `client/public/client-package.json`, and Vite copies it into `dist` during build.

## Step 5: Make A Zip For Catalyst

Stay inside the `client` folder and run:

```bash
cd dist
zip -r ../ksp-crime-analytics-demo.zip .
cd ..
```

This creates:

```text
client/ksp-crime-analytics-demo.zip
```

Important: zip the contents inside `dist`, not the `dist` folder itself. When Catalyst opens the zip, it should immediately see `index.html` and `client-package.json`.

## Step 6: Create A Fresh Catalyst Project

1. Go to the Zoho Catalyst console.
2. Click to create a new project.
3. Give it a name, for example:

```text
ksp-crime-analytics-demo
```

4. Keep it in the Development environment for now.

## Step 7: Open Web Client Hosting

Inside your new Catalyst project:

1. Go to **Host and Manage**.
2. Open **Web Client Hosting**.
3. Click **Upload**.

## Step 8: Upload The Zip

Upload this file:

```text
/Users/NIKITA/Desktop/otherWork/Datathon_2026/Zoho_Catalyst/ksp-crime-analytics-revamp/client/ksp-crime-analytics-demo.zip
```

Wait for Catalyst to finish hosting it.

## Step 9: Open The Catalyst URL

After upload, Catalyst will show a web app URL.

Open it in the browser. The app should load with the same demo data as local.

## Step 10: If The Page Is Blank

First, check that you uploaded the zip correctly.

The zip should contain files like this at the top level:

```text
index.html
client-package.json
assets/
```

It should not look like this:

```text
dist/index.html
dist/client-package.json
dist/assets/
```

If you accidentally zipped the whole `dist` folder, recreate the zip from inside `dist` using Step 5.

## Step 11: If Data Is Missing

Check `client/.env.production`.

It must be:

```bash
VITE_USE_MOCKS=true
```

Then rebuild and re-upload:

```bash
npm run build
cd dist
zip -r ../ksp-crime-analytics-demo.zip .
cd ..
```

## What Not To Do For This Demo

Do not upload CSVs to Catalyst Data Store for this demo.

Do not set `VITE_USE_MOCKS=false`.

Do not deploy the API functions unless you intentionally want to build the real backend version later.

## Why This Works

The app imports mock data directly from:

```text
client/src/mock-data/
```

During `npm run build`, Vite bundles that data into the static website. Catalyst only needs to serve the built files.
