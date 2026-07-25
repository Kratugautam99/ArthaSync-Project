from fastapi import APIRouter, UploadFile, File
from app.services.yolo_service import process_frame
from app.services.tally_service import sync_yolo_items_to_tally
from app.services.zoho_service import sync_yolo_items_to_zoho

router = APIRouter()

@router.post("/api/camera/detect")
async def detect_items(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        result = process_frame(contents)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/api/camera/sync-to-tally")
async def sync_tally(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        # Detect
        result = process_frame(contents)
        # Sync
        items = [{"name": k, "quantity": v} for k, v in result["counts"].items()]
        sync_result = await sync_yolo_items_to_tally(items)
        return {"success": True, "sync_result": sync_result}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/api/camera/sync-to-zoho")
async def sync_zoho(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        # Detect
        result = process_frame(contents)
        # Sync
        items = [{"name": k, "quantity": v} for k, v in result["counts"].items()]
        sync_result = await sync_yolo_items_to_zoho(items, "MOCK_TOKEN")
        return {"success": True, "sync_result": sync_result}
    except Exception as e:
        return {"success": False, "error": str(e)}
