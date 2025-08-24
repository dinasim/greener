import os
import json
import logging
from datetime import datetime, timedelta
import azure.functions as func
from azure.cosmos import CosmosClient
import google.generativeai as genai
import requests

# ===================== CONFIG =====================
COSMOS_URI  = "https://greener-database.documents.azure.com:443/"
COSMOS_KEY  = "Mqxy0jUQCmwDYNjaxtFOauzxc2CRPeNFaxDKktxNJTmUiGlARA2hIZueLt8D1u8B8ijgvEbzCtM5ACDbUzDRKg=="
DB_NAME     = "GreenerDB"
USER_PLANTS_CONTAINER           = "userPlants"
USER_PLANTS_LOCATION_CONTAINER  = "userPlantsLocation"
PLANTS_CONTAINER                = "Plants"

GOOGLE_KEY = "AIzaSyAFR55U0tZw7SFb2Z578W2pi6qUqmq74nw"
PLANT_DETAILS_JSON_URL = "https://usersfunctions.azurewebsites.net/api/plantdetailsjson"

# ===================== CLIENTS =====================
genai.configure(api_key=GOOGLE_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

client = CosmosClient(COSMOS_URI, credential=COSMOS_KEY)
db = client.get_database_client(DB_NAME)
user_plants_container = db.get_container_client(USER_PLANTS_CONTAINER)
location_container    = db.get_container_client(USER_PLANTS_LOCATION_CONTAINER)
plants_container      = db.get_container_client(PLANTS_CONTAINER)

# ===================== UTILS =====================
def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def _parse_dt(s: str) -> datetime | None:
    """Parse ISO 8601 strings with or without trailing 'Z' into naive UTC datetimes."""
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
        if dt.tzinfo:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None
    
def parse_schedule(val, fallback_unit="days"):
    if isinstance(val, dict):
        amt = val.get("amount")
        unit = val.get("unit") or fallback_unit
        if amt is not None and unit:
            return {"amount": amt, "unit": unit}
    if isinstance(val, int):
        return {"amount": val, "unit": fallback_unit}
    if isinstance(val, str):
        for part in val.split():
            if part.isdigit():
                return {"amount": int(part), "unit": fallback_unit}
    return None

def normalize_plant_data(raw):
    care  = raw.get("care_info", {})
    sched = raw.get("schedule", {})
    def clean(x, fallback="—"):
        return x if x not in [None, "null", "", [], {}] else fallback

    problems = raw.get("common_problems")
    if not isinstance(problems, list):
        problems = []
    normalized_problems = []
    for p in problems:
        if isinstance(p, dict) and "name" in p and "description" in p:
            normalized_problems.append({"name": str(p["name"]), "description": str(p["description"])})
        elif isinstance(p, str):
            normalized_problems.append({"name": p, "description": ""})

    return {
        "common_name":      clean(raw.get("common_name")      or raw.get("name")),
        "scientific_name":  clean(raw.get("scientific_name")  or raw.get("latin_name")),
        "image_url":        clean(raw.get("image_url")        or (raw.get("image_urls") or [None])[0]),
        "care_info": {
            "light":            clean(care.get("light")            or raw.get("light")),
            "humidity":         clean(care.get("humidity")         or raw.get("humidity")),
            "temperature_min_c": care.get("temperature_min_c") if care.get("temperature_min_c") is not None else None,
            "temperature_max_c": care.get("temperature_max_c") if care.get("temperature_max_c") is not None else None,
            "pets":             (care.get("pets") or "unknown"),
            "difficulty":       care.get("difficulty") if care.get("difficulty") is not None else None,
        },
        "schedule": {
            "water": parse_schedule(sched.get("water") or raw.get("water")),
            "feed":  parse_schedule(sched.get("feed")  or raw.get("feed")),
            "repot": parse_schedule(sched.get("repot") or raw.get("repot"), "years"),
        },
        "care_tips": clean(raw.get("care_tips")),
        "family":    clean(raw.get("family")),
        "common_problems": normalized_problems,
    }

def query_cosmos(plant_name):
    if not plant_name:
        return None
    try:
        query = "SELECT * FROM Plants p WHERE LOWER(p.common_name) = @name OR LOWER(p.scientific_name) = @name"
        params = [{"name": "@name", "value": plant_name.lower()}]
        results = list(plants_container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        if results:
            doc = results[0]
            norm = normalize_plant_data(doc)

            refresh = False
            for field in ["light", "humidity", "temperature_min_c", "temperature_max_c", "pets", "difficulty"]:
                v = norm["care_info"].get(field)
                if v in [None, "—", "unknown"]:
                    refresh = True
                    break
            if not refresh:
                w = norm["schedule"].get("water")
                if not w or w.get("amount") in [None, 0]:
                    refresh = True
            if not refresh and (not norm.get("common_problems") or len(norm.get("common_problems", [])) == 0):
                refresh = True

            if refresh:
                logging.warning(f"DB entry for '{plant_name}' incomplete. Forcing Gemini enrichment...")
                gem = call_gemini(plant_name)
                if gem:
                    gem['id'] = doc.get('id', plant_name)
                    plants_container.upsert_item(gem)
                    return gem
            return norm
        return None
    except Exception as e:
        logging.error(f"Cosmos query failed for '{plant_name}': {e}")
        return None

def schedule_to_days(amount, unit):
    unit = (unit or "").lower()
    if unit in ["day", "days"]:   return amount
    if unit in ["week", "weeks"]: return amount * 7
    if unit in ["month", "months"]: return amount * 30
    if unit in ["year", "years"]: return amount * 365
    return amount

def call_gemini(plant_name):
    prompt = (
        f"Return ONLY valid JSON for care of '{plant_name}'. "
        "{"
        "\"common_name\": str, \"scientific_name\": str, \"image_url\": str, "
        "\"care_info\": {"
            "\"light\": str, \"humidity\": str, \"temperature_min_c\": int, \"temperature_max_c\": int, "
            "\"pets\": \"poisonous|not poisonous|unknown\", \"difficulty\": int"
        "}, "
        "\"schedule\": {"
            "\"water\": {\"amount\": int, \"unit\": str}, "
            "\"feed\": {\"amount\": int, \"unit\": str}, "
            "\"repot\": {\"amount\": int, \"unit\": str}"
        "}, "
        "\"care_tips\": str, \"family\": str, "
        "\"common_problems\": [ {\"name\": str, \"description\": str} ]"
        "}"
        " Use species-level data; if uncertain, use genus-level best practice rather than 'Unknown'."
    )
    try:
        logging.info(f"Calling Gemini for '{plant_name}'...")
        res = model.generate_content(prompt)
        response_text = (res.text or "").strip()
        json_start = response_text.find('{')
        json_end   = response_text.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            plant_json = json.loads(response_text[json_start:json_end])
            logging.info(f"Gemini response for '{plant_name}': {plant_json}")
            return normalize_plant_data(plant_json)
        logging.error(f"Could not extract JSON from Gemini for '{plant_name}': {response_text}")
        return None
    except Exception as e:
        logging.error(f"Gemini call failed for '{plant_name}': {e}")
        return None

def call_plantdetailsjson(plant_name):
    try:
        resp = requests.get(PLANT_DETAILS_JSON_URL, params={"name": plant_name}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return normalize_plant_data(data)
        else:
            logging.error(f"plantdetailsjson failed for '{plant_name}': {resp.status_code} {resp.text}")
    except Exception as e:
        logging.error(f"Error calling plantdetailsjson for '{plant_name}': {e}")
    return None

# ---------- placeholder helpers ----------
_PLACEHOLDER_SCALARS = {None, "", "—", "unknown", "Unknown", "UNKNOWN"}

def _is_placeholder(value):
    # booleans should be treated as placeholders (e.g., light: False)
    if value in _PLACEHOLDER_SCALARS or isinstance(value, bool):
        return True
    if isinstance(value, (list, dict)) and len(value) == 0:
        return True
    return False

def _bad_str(v):
    return (not isinstance(v, str)) or (v.strip() == "") or (v.strip().lower() in {"unknown", "—"})

def _came_from_scan(payload: dict) -> bool:
    return (payload.get("source") or "").lower() in {"plantnet", "photo_scan", "camera", "scan"}

# ---------- cosmos-safe helpers ----------
def _cosmos_safe_id(raw: str) -> str:
    if not isinstance(raw, str):
        raw = str(raw or "")
    s = " ".join(raw.strip().split())
    for bad in ["/", "\\", "?", "#"]:
        s = s.replace(bad, "-")
    return s[:256]

def _normalize_location(loc: str) -> str:
    if not isinstance(loc, str):
        loc = str(loc or "")
    return " ".join(loc.strip().split())

# ---------- merge & promote ----------
def _merge_care_info(base: dict, enriched: dict) -> dict:
    base = base or {}
    enriched = enriched or {}
    out = dict(base)

    for k in ["light", "humidity", "pets"]:
        if _bad_str(out.get(k)):
            out[k] = enriched.get(k)

    for k in ["temperature_min_c", "temperature_max_c", "difficulty"]:
        v = out.get(k)
        if not isinstance(v, (int, float)) or v is None:
            out[k] = enriched.get(k)
    return out

def _merge_schedule(base: dict, enriched: dict) -> dict:
    base = base or {}
    enriched = enriched or {}
    out = dict(base)

    for part in ["water", "feed", "repot"]:
        b = out.get(part)
        e = enriched.get(part)
        if not isinstance(b, dict) or (b.get("amount") in [None, 0]):
            if isinstance(e, dict):
                out[part] = {"amount": e.get("amount"), "unit": e.get("unit")}
            else:
                out[part] = b
        else:
            if (b.get("unit") in [None, "", "—"]) and isinstance(e, dict) and e.get("unit"):
                b["unit"] = e.get("unit")
            out[part] = b
    return out

def _promote_flat_fields_to_nested(payload: dict) -> dict:
    care_info = payload.get("care_info") or {}
    schedule  = payload.get("schedule")  or {}

    def _safe_text(v):
        return v if isinstance(v, str) and v.strip() else None

    def _safe_int(v):
        if isinstance(v, (int, float)):
            try:
                return int(v)
            except Exception:
                return None
        return None

    promoted = {
        "light": _safe_text(payload.get("sunlight")) or _safe_text(payload.get("shade")) or care_info.get("light"),
        "humidity": _safe_text(payload.get("humidity")) or care_info.get("humidity"),
        "temperature_min_c": _safe_int(payload.get("temperature_min_c")) if payload.get("temperature_min_c") is not None else care_info.get("temperature_min_c"),
        "temperature_max_c": _safe_int(payload.get("temperature_max_c")) if payload.get("temperature_max_c") is not None else care_info.get("temperature_max_c"),
        "pets": care_info.get("pets") or "unknown",
        "difficulty": care_info.get("difficulty"),
    }
    if any(v not in [None, "", "Unknown", "—"] for v in promoted.values()):
        payload["care_info"] = promoted

    w = schedule.get("water") if isinstance(schedule, dict) else None
    if (not isinstance(w, dict)) or (w.get("amount") in [None, 0]):
        avg_w = payload.get("avg_watering")
        if isinstance(avg_w, (int, float)) and avg_w > 0:
            payload["schedule"] = {
                "water": {"amount": int(avg_w), "unit": "day"},
                "feed": schedule.get("feed") if isinstance(schedule, dict) else None,
                "repot": schedule.get("repot") if isinstance(schedule, dict) else None,
            }
    return payload

# ---------- enrichment flow ----------
def enrich_if_needed(payload):
    payload = _promote_flat_fields_to_nested(payload)

    care_info = payload.get("care_info") or {}
    schedule  = payload.get("schedule")  or {}

    force_gemini = _came_from_scan(payload)

    sci = (payload.get("scientific_name") or "").strip()
    com = (payload.get("common_name") or "").strip()
    name_for_lookup = sci or com

    needs_enrichment = force_gemini or _care_info_needs_enrichment(care_info) or _schedule_needs_enrichment(schedule)
    if not needs_enrichment:
        return payload

    if not name_for_lookup:
        logging.info("enrich_if_needed: No name; applying safe defaults.")
        if _schedule_needs_enrichment(schedule):
            payload["schedule"] = {"water": {"amount": 7, "unit": "day"}, "feed": None, "repot": None}
        if _care_info_needs_enrichment(care_info):
            payload["care_info"] = {
                "light": "Unknown", "humidity": "Unknown",
                "temperature_min_c": None, "temperature_max_c": None,
                "pets": "unknown", "difficulty": None
            }
        return payload

    logging.info(f"Enriching using '{name_for_lookup}' (force_gemini={force_gemini}) ...")

    if force_gemini:
        enriched = call_gemini(name_for_lookup) or query_cosmos(name_for_lookup) or call_plantdetailsjson(name_for_lookup)
    else:
        enriched = query_cosmos(name_for_lookup) or call_gemini(name_for_lookup) or call_plantdetailsjson(name_for_lookup)

    if enriched:
        try:
            if not query_cosmos(name_for_lookup):
                enriched["id"] = (enriched.get("scientific_name") or enriched.get("common_name") or name_for_lookup).lower()
                plants_container.upsert_item(enriched)
        except Exception as e:
            logging.error(f"Failed to upsert into Plants DB for '{name_for_lookup}': {e}")

        if force_gemini:
            payload["care_info"] = enriched.get("care_info") or payload.get("care_info")
            payload["schedule"]  = enriched.get("schedule")  or payload.get("schedule")
        else:
            payload["care_info"] = _merge_care_info(care_info, enriched.get("care_info"))
            payload["schedule"]  = _merge_schedule(schedule, enriched.get("schedule"))

        payload["family"]          = payload.get("family") or enriched.get("family")
        payload["origin"]          = payload.get("origin") or enriched.get("origin")
        payload["care_tips"]       = payload.get("care_tips") or enriched.get("care_tips")
        payload["common_problems"] = payload.get("common_problems") or enriched.get("common_problems")
        payload["image_url"]       = payload.get("image_url") or enriched.get("image_url")

    return payload

def _care_info_needs_enrichment(ci: dict) -> bool:
    if not ci or not isinstance(ci, dict):
        return True
    keys = ["light", "humidity", "temperature_min_c", "temperature_max_c", "pets", "difficulty"]
    return any(_is_placeholder(ci.get(k)) for k in keys)

def _schedule_needs_enrichment(sch: dict) -> bool:
    if not sch or not isinstance(sch, dict):
        return True
    water = sch.get("water")
    return (not isinstance(water, dict)) or (water.get("amount") in [None, 0])

def compute_next_dates(payload):
    """
    Next due dates are based on the last time the action occurred (if provided).
    If last_* is missing, we fall back to now + interval.
    We DO NOT 'catch up' overdue tasks to the future; leaving a past due keeps them overdue in the UI until completed.
    """
    now = datetime.utcnow()

    schedule = payload.get("schedule") or {}
    water = schedule.get("water") or {}
    feed  = schedule.get("feed")  or {}
    repot = schedule.get("repot") or {}

    water_days = schedule_to_days(water.get("amount", 0) or 0, water.get("unit", "day"))
    feed_days  = schedule_to_days(feed.get("amount", 0) or 0,  feed.get("unit", "day"))
    repot_days = schedule_to_days(repot.get("amount", 0) or 0, repot.get("unit", "year"))

    # prefer explicit last_* on payload; otherwise look inside wateringSchedule for water
    last_watered = payload.get("last_watered") or (payload.get("wateringSchedule") or {}).get("lastWatered")
    last_fed = payload.get("last_fed")
    last_repotted = payload.get("last_repotted")

    lw = _parse_dt(last_watered)
    lf = _parse_dt(last_fed)
    lr = _parse_dt(last_repotted)

    # Guard against future last_* (bad data). If last_* > now, ignore it.
    if lw and lw > now: lw = None
    if lf and lf > now: lf = None
    if lr and lr > now: lr = None

    next_water_dt = (lw + timedelta(days=water_days)) if (lw and water_days) else (now + timedelta(days=water_days) if water_days else None)
    next_feed_dt  = (lf + timedelta(days=feed_days))  if (lf and feed_days)  else (now + timedelta(days=feed_days)  if feed_days  else None)
    next_repot_dt = (lr + timedelta(days=repot_days)) if (lr and repot_days) else (now + timedelta(days=repot_days) if repot_days else None)

    payload["next_water"] = next_water_dt.isoformat() if next_water_dt else None
    payload["next_feed"]  = next_feed_dt.isoformat()  if next_feed_dt  else None
    payload["next_repot"] = next_repot_dt.isoformat() if next_repot_dt else None

    return payload

def _upsert_location_map(payload):
    # Normalize location & build safe id
    loc_norm = _normalize_location(payload.get("location", ""))
    payload["location"] = loc_norm
    loc_id = _cosmos_safe_id(f"{payload['email'].lower()}_{loc_norm.lower()}")

    logging.info(f"[locmap] loc_norm='{loc_norm}' loc_id='{loc_id}'")

    try:
        # Query by id across partitions (avoids fragile read_item partition assumptions)
        items = list(location_container.query_items(
            query="SELECT * FROM c WHERE c.id = @id",
            parameters=[{"name": "@id", "value": loc_id}],
            enable_cross_partition_query=True
        ))
        if items:
            doc = items[0]
            plants = set(doc.get("plants", []))
            plants.add(payload["id"])
            doc["plants"]   = sorted(plants)
            doc["email"]    = payload["email"].lower()
            doc["location"] = loc_norm
            location_container.upsert_item(doc)
        else:
            location_container.upsert_item({
                "id": loc_id,
                "email": payload["email"].lower(),
                "location": loc_norm,
                "plants": [payload["id"]],
            })
    except Exception as e:
        logging.exception(f"userPlantsLocation upsert failed: {e}")

# ===================== MAIN =====================
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("🌱 addUserPlant function triggered")
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_cors_headers())

    try:
        payload = req.get_json()
    except Exception:
        return func.HttpResponse("Invalid JSON", status_code=400, headers=_cors_headers())

    if not payload.get("id") or not payload.get("email"):
        return func.HttpResponse("Missing required fields (id, email)", status_code=400, headers=_cors_headers())

    # Normalize critical fields early
    payload["email"] = (payload.get("email") or "").strip().lower()
    if "location" in payload and payload["location"] is not None:
        payload["location"] = _normalize_location(payload["location"])

    # Debug line shows whether we will enrich + the source
    ci_dbg  = payload.get("care_info") or {}
    sch_dbg = payload.get("schedule")  or {}
    logging.info(f"[addUserPlant] needs_enrichment? ci={_care_info_needs_enrichment(ci_dbg)} sch={_schedule_needs_enrichment(sch_dbg)} source={payload.get('source')}")

    # Enrich + compute next dates
    payload = enrich_if_needed(payload)
    payload = compute_next_dates(payload)

    # Watering schedule scaffolding
    schedule = payload.get("schedule") or {}
    water    = schedule.get("water") or {}
    water_days = schedule_to_days(water.get("amount", 7) if water.get("amount") is not None else 7, water.get("unit", "day"))
    payload["wateringSchedule"] = {
        "waterDays": water_days,
        "activeWaterDays": water_days,
        "lastWateringUpdate": datetime.utcnow().strftime("%Y-%m-%d"),
        "needsWatering": False,
        "weatherAffected": False,
        "lastWatered": payload.get("last_watered"),
        "createdAt": datetime.utcnow().isoformat(),
    }

    # Save user plant
    try:
        user_plants_container.upsert_item(payload)
        logging.info(f"Saved plant '{payload['id']}' to userPlants.")
    except Exception as e:
        logging.exception(f"Failed to save to userPlants (id={payload.get('id')}, email={payload.get('email')}): {e}")
        return func.HttpResponse(f"Error saving user plant: {str(e)}", status_code=500, headers=_cors_headers())

    # Update location map safely (no read_item path building)
    _upsert_location_map(payload)

    return func.HttpResponse(json.dumps({"status": "ok"}), status_code=200, headers={**_cors_headers(), "Content-Type": "application/json"})
