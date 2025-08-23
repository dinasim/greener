import json, datetime
import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(json.dumps({"ok": True, "time": datetime.datetime.utcnow().isoformat()}), status_code=200)
