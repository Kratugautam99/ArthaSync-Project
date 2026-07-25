from fastapi import APIRouter
from pydantic import BaseModel
from app.services.tally_service import check_tally_status, push_purchase_voucher, sync_yolo_items_to_tally

router = APIRouter()

class InvoiceData(BaseModel):
    vendor_name: str
    total_amount: float
    # Add other fields as needed

class SyncItemsRequest(BaseModel):
    items: list

@router.get("/api/tally/status")
async def get_status():
    return await check_tally_status()

@router.post("/api/tally/push-voucher")
async def push_voucher(data: InvoiceData):
    result = await push_purchase_voucher(data.model_dump())
    return result

@router.post("/api/tally/sync-items")
async def sync_items(req: SyncItemsRequest):
    return await sync_yolo_items_to_tally(req.items)
