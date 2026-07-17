"""
KSP Crime Analytics - Data Seeder Function
Catalyst Advanced I/O Function (Python)
Deploy as: data-seeder  (type: Advanced I/O)

Call once to insert all synthetic CSV data into Catalyst Data Store.
  POST /seed?table=districts
  POST /seed?table=police_stations
  POST /seed?table=officers
  POST /seed?table=crime_types
  POST /seed?table=modus_operandi
  POST /seed?table=offenders
  POST /seed?table=victims
  POST /seed?table=crimes
  POST /seed?table=crime_officers
  POST /seed?table=crime_offenders
  POST /seed?table=crime_victims
  POST /seed?table=associations
  POST /seed?table=monthly_stats
  POST /seed?table=all

Expects CSV files uploaded to Catalyst File Store under bucket: ksp-data
"""

import json, csv, io
from zcatalyst_sdk import catalyst_app

app = catalyst_app.initialize()

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
}

def resp(data, status=200):
    return {"statusCode": status, "headers": CORS,
            "body": json.dumps({"success": True, "data": data})}

def err(msg, status=500):
    return {"statusCode": status, "headers": CORS,
            "body": json.dumps({"success": False, "error": msg})}

TABLES = [
    "districts",
    "crime_types",
    "modus_operandi",
    "location_types",
    "weapons",
    "case_statuses",
    "gangs",
    "education_levels",
    "occupations",
    "offender_statuses",
    "relationship_types",
    "police_stations",
    "officers",
    "offenders",
    "victims",
    "crimes",
    "crime_officers",
    "crime_offenders",
    "crime_victims",
    "associations",
    "monthly_stats",
]

BATCH_SIZE = 50  # Catalyst Data Store insert batch

def read_csv_from_filestore(filename):
    """Read a CSV from Catalyst File Store bucket 'ksp-data'."""
    try:
        fs      = app.file_store()
        folder  = fs.get_folder_details("ksp-data")
        file_obj = folder.get_file_details(filename)
        content  = file_obj.download_file()
        reader   = csv.DictReader(io.StringIO(content.decode("utf-8")))
        return list(reader)
    except Exception as e:
        raise RuntimeError(f"Could not read {filename} from File Store: {e}")

def insert_rows(table_name, rows):
    """Batch insert rows into Data Store table."""
    ds    = app.datastore()
    table = ds.table(table_name)
    total = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i+BATCH_SIZE]
        # Cast numeric-looking fields
        cleaned = []
        for row in batch:
            r = {}
            for k, v in row.items():
                if v == "" or v is None:
                    r[k] = None
                else:
                    try:    r[k] = int(v)
                    except:
                        try:    r[k] = float(v)
                        except: r[k] = v
            cleaned.append(r)
        table.insert_rows(cleaned)
        total += len(batch)
    return total

def handler(request, response):
    if request.method == "OPTIONS":
        for k, v in CORS.items(): response.set_header(k, v)
        response.status_code = 200
        return response.send("")

    params = request.query_params or {}
    table  = params.get("table", "")

    if not table:
        return err("Query param 'table' required (or 'all')", 400)

    tables_to_seed = TABLES if table == "all" else [table]
    if table != "all" and table not in TABLES:
        return err(f"Unknown table '{table}'. Valid: {TABLES}", 400)

    results = {}
    for t in tables_to_seed:
        try:
            rows    = read_csv_from_filestore(f"{t}.csv")
            inserted = insert_rows(t, rows)
            results[t] = {"status": "ok", "rows_inserted": inserted}
        except Exception as e:
            results[t] = {"status": "error", "message": str(e)}

    return resp(results)
