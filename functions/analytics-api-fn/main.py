"""
KSP Crime Analytics - Python Analytics Function
Catalyst Advanced I/O Function (Python 3.9+)
Deploy as: analytics-api  (type: Advanced I/O)

Routes:
  GET /predict/risk      - district-level risk scoring
  GET /predict/hotzone   - next-30-day hotspot prediction
  GET /correlations      - socio-economic correlation matrix
  GET /anomalies         - statistical anomaly detection
  GET /mo-profile        - modus operandi frequency breakdown
  GET /recidivism        - repeat offender / recidivism stats
"""

import json, math, statistics
from datetime import datetime, date, timedelta
from zcatalyst_sdk import catalyst_app

app = catalyst_app.initialize()

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
}

def respond(data, status=200):
    return {"statusCode": status, "headers": CORS_HEADERS,
            "body": json.dumps({"success": True, "data": data})}

def error(msg, status=500):
    return {"statusCode": status, "headers": CORS_HEADERS,
            "body": json.dumps({"success": False, "error": msg})}

def zcql(sql):
    result = app.datastore().execute_query(sql)
    return result if result else []

def safe(v):
    return str(v or "").replace("'", "''")

# ─── Handler ─────────────────────────────────────────────────────────────────
def handler(request, response):
    if request.method == "OPTIONS":
        for k, v in CORS_HEADERS.items():
            response.set_header(k, v)
        response.status_code = 200
        return response.send("")

    path   = request.path or ""
    params = request.query_params or {}

    try:

        # ── GET /predict/risk ─────────────────────────────────────────────
        if path == "/predict/risk":
            year = int(params.get("year", 2024))

            districts = zcql(
                f"""SELECT name, socio_economic_index, urbanization_index,
                           unemployment_rate, literacy_rate, population
                    FROM districts"""
            )
            crime_counts = zcql(
                f"""SELECT district, COUNT(*) AS total,
                           SUM(severity) AS sev_total,
                           SUM(CASE WHEN solved=0 THEN 1 ELSE 0 END) AS unsolved
                    FROM crimes WHERE incident_year = {year}
                    GROUP BY district"""
            )
            cc_map = {r["district"]: r for r in crime_counts}

            results = []
            for d in districts:
                name = d["name"]
                cc   = cc_map.get(name, {})
                total    = int(cc.get("total",    0))
                sev_sum  = int(cc.get("sev_total",0))
                unsolved = int(cc.get("unsolved", 0))
                pop      = max(int(d.get("population", 1)), 1)

                # Weighted risk composite (0-100)
                crime_rate = total / pop * 100000           # per 100k
                sei_risk   = 1 - float(d.get("socio_economic_index", 0.5))
                urb_factor = float(d.get("urbanization_index", 0.5))
                unemp      = float(d.get("unemployment_rate",  0.1))
                avg_sev    = sev_sum / max(total, 1)
                unsolved_r = unsolved / max(total, 1)

                # Normalised 0-100 score
                risk = (
                    min(crime_rate / 500, 1) * 35 +
                    sei_risk                 * 20 +
                    unemp                    * 15 +
                    (avg_sev / 5)            * 15 +
                    unsolved_r               * 15
                ) * 100

                results.append({
                    "district":        name,
                    "risk_score":      round(min(risk, 100), 1),
                    "crime_rate_100k": round(crime_rate, 1),
                    "avg_severity":    round(avg_sev, 2),
                    "unsolved_rate":   round(unsolved_r, 3),
                    "risk_band":       "HIGH" if risk >= 60 else "MEDIUM" if risk >= 35 else "LOW",
                    "drivers": {
                        "socio_economic": round(sei_risk * 100, 1),
                        "urbanisation":   round(urb_factor * 100, 1),
                        "unemployment":   round(unemp * 100, 1),
                        "crime_rate":     round(min(crime_rate / 500, 1) * 100, 1)
                    }
                })

            results.sort(key=lambda x: -x["risk_score"])
            return respond(results)

        # ── GET /predict/hotzone ──────────────────────────────────────────
        if path == "/predict/hotzone":
            # Simple linear trend extrapolation per district+crime_type
            history = zcql(
                """SELECT district, crime_type, incident_year, incident_month, incident_count
                   FROM monthly_stats WHERE incident_year >= 2022
                   ORDER BY district, crime_type, incident_year, incident_month"""
            )

            # Group by district+crime_type
            series = {}
            for r in history:
                key = f"{r['district']}|{r['crime_type']}"
                series.setdefault(key, []).append(int(r["incident_count"]))

            predictions = []
            for key, vals in series.items():
                if len(vals) < 6:
                    continue
                district, crime_type = key.split("|", 1)
                # Simple linear regression slope
                n = len(vals)
                x_mean = (n - 1) / 2
                y_mean = statistics.mean(vals)
                num = sum((i - x_mean) * (vals[i] - y_mean) for i in range(n))
                den = sum((i - x_mean) ** 2 for i in range(n))
                slope = num / den if den else 0
                pred  = max(0, round(y_mean + slope * (n + 1)))
                trend_pct = round(slope / max(y_mean, 1) * 100, 1)

                if trend_pct > 10:   # only flag rising trends
                    predictions.append({
                        "district":       district,
                        "crime_type":     crime_type,
                        "predicted_next_month": pred,
                        "trend_pct_per_month":  trend_pct,
                        "recent_avg":     round(statistics.mean(vals[-3:]), 1),
                        "alert_level":    "HIGH" if trend_pct > 30 else "MEDIUM"
                    })

            predictions.sort(key=lambda x: -x["trend_pct_per_month"])
            return respond(predictions[:30])

        # ── GET /correlations ─────────────────────────────────────────────
        if path == "/correlations":
            districts = zcql(
                """SELECT d.name, d.socio_economic_index, d.urbanization_index,
                          d.unemployment_rate, d.literacy_rate,
                          COUNT(c.crime_id) AS total_crimes,
                          AVG(c.severity) AS avg_severity
                   FROM districts d
                   LEFT JOIN crimes c ON c.district = d.name
                   GROUP BY d.name, d.socio_economic_index, d.urbanization_index,
                            d.unemployment_rate, d.literacy_rate"""
            )

            def pearson(xs, ys):
                n = len(xs)
                if n < 3: return 0
                mx, my = statistics.mean(xs), statistics.mean(ys)
                num = sum((xs[i]-mx)*(ys[i]-my) for i in range(n))
                den = math.sqrt(
                    sum((x-mx)**2 for x in xs) * sum((y-my)**2 for y in ys))
                return round(num / den, 3) if den else 0

            fields = ["socio_economic_index", "urbanization_index",
                      "unemployment_rate", "literacy_rate"]
            crime_counts = [float(d.get("total_crimes", 0)) for d in districts]
            severity     = [float(d.get("avg_severity", 0) or 0) for d in districts]

            correlations = []
            for f in fields:
                vals = [float(d.get(f, 0) or 0) for d in districts]
                correlations.append({
                    "factor":                  f,
                    "corr_with_crime_count":   pearson(vals, crime_counts),
                    "corr_with_avg_severity":  pearson(vals, severity)
                })

            scatter = [{
                "district":           d["name"],
                "socio_economic":     d.get("socio_economic_index"),
                "urbanization":       d.get("urbanization_index"),
                "unemployment":       d.get("unemployment_rate"),
                "literacy":           d.get("literacy_rate"),
                "total_crimes":       d.get("total_crimes"),
                "avg_severity":       d.get("avg_severity")
            } for d in districts]

            return respond({"correlations": correlations, "scatter_data": scatter})

        # ── GET /anomalies ────────────────────────────────────────────────
        if path == "/anomalies":
            # Z-score anomaly detection on monthly district counts
            stats_rows = zcql(
                """SELECT district, crime_type, incident_year, incident_month, incident_count
                   FROM monthly_stats ORDER BY district, crime_type, incident_year, incident_month"""
            )

            series = {}
            for r in stats_rows:
                key = f"{r['district']}|{r['crime_type']}"
                series.setdefault(key, []).append({
                    "year": r["incident_year"], "month": r["incident_month"],
                    "count": int(r["incident_count"])
                })

            anomalies = []
            for key, pts in series.items():
                if len(pts) < 4:
                    continue
                district, crime_type = key.split("|", 1)
                counts = [p["count"] for p in pts]
                mu  = statistics.mean(counts)
                try: sigma = statistics.stdev(counts)
                except: sigma = 0
                if sigma == 0:
                    continue
                for pt in pts:
                    z = (pt["count"] - mu) / sigma
                    if abs(z) > 2.0:
                        anomalies.append({
                            "district":    district,
                            "crime_type":  crime_type,
                            "year":        pt["year"],
                            "month":       pt["month"],
                            "count":       pt["count"],
                            "mean":        round(mu, 1),
                            "z_score":     round(z, 2),
                            "direction":   "SPIKE" if z > 0 else "DROP",
                            "magnitude":   "EXTREME" if abs(z)>3 else "HIGH" if abs(z)>2.5 else "MODERATE"
                        })

            anomalies.sort(key=lambda x: -abs(x["z_score"]))
            return respond(anomalies[:50])

        # ── GET /mo-profile ───────────────────────────────────────────────
        if path == "/mo-profile":
            district  = safe(params.get("district",  ""))
            crime_type = safe(params.get("crime_type", ""))
            where = "WHERE 1=1"
            if district:   where += f" AND district = '{district}'"
            if crime_type: where += f" AND crime_type = '{crime_type}'"

            rows = zcql(
                f"""SELECT modus_operandi, crime_type,
                           COUNT(*) AS count, AVG(severity) AS avg_sev,
                           SUM(solved) AS solved, SUM(property_loss_inr) AS total_loss
                    FROM crimes {where}
                    GROUP BY modus_operandi, crime_type ORDER BY count DESC LIMIT 40"""
            )
            return respond(rows)

        # ── GET /recidivism ───────────────────────────────────────────────
        if path == "/recidivism":
            offenders = zcql(
                """SELECT offender_id, name, alias, prior_convictions,
                          gang_affiliation, status, risk_score, age
                   FROM offenders WHERE prior_convictions > 0
                   ORDER BY prior_convictions DESC LIMIT 100"""
            )
            # Bin by conviction count
            bins = {"1": 0, "2-3": 0, "4-5": 0, "6+": 0}
            for o in offenders:
                p = int(o.get("prior_convictions", 0))
                if   p == 1: bins["1"]   += 1
                elif p <= 3: bins["2-3"] += 1
                elif p <= 5: bins["4-5"] += 1
                else:        bins["6+"]  += 1

            gang_breakdown = {}
            for o in offenders:
                g = o.get("gang_affiliation") or "None"
                gang_breakdown[g] = gang_breakdown.get(g, 0) + 1

            return respond({
                "top_repeat_offenders": offenders[:20],
                "conviction_distribution": bins,
                "gang_breakdown": gang_breakdown,
                "total_repeat_offenders": len(offenders)
            })

        return error(f"Not found: {path}", 404)

    except Exception as e:
        import traceback; traceback.print_exc()
        return error(str(e))
