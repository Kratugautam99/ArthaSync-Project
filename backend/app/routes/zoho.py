from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from app.services.zoho_service import (
    check_zoho_status, push_purchase_order, sync_yolo_items_to_zoho,
    generate_auth_url, exchange_code_for_token, get_valid_access_token
)

router = APIRouter()

class InvoiceData(BaseModel):
    vendor_name: str
    total_amount: float

class SyncItemsRequest(BaseModel):
    items: list

@router.get("/api/zoho/status")
async def get_status():
    return await check_zoho_status()

@router.get("/api/zoho/auth-url")
async def get_auth_url():
    url = generate_auth_url()
    return RedirectResponse(url)

@router.get("/api/zoho/callback")
async def zoho_callback(code: str = None, error: str = None):
    if error:
        return {"error": error}
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")
        
    success = await exchange_code_for_token(code)
    if success:
        # Redirect back to frontend dashboard
        return RedirectResponse("http://localhost:3000")
    else:
        raise HTTPException(status_code=500, detail="Failed to exchange token")

@router.post("/api/zoho/push-invoice")
async def push_invoice(data: InvoiceData):
    token = await get_valid_access_token()
    if not token:
        raise HTTPException(status_code=401, detail="Zoho not connected")
    result = await push_purchase_order(data.model_dump(), token)
    return result

@router.post("/api/zoho/sync-items")
async def sync_items(req: SyncItemsRequest):
    token = await get_valid_access_token()
    if not token:
        raise HTTPException(status_code=401, detail="Zoho not connected")
    return await sync_yolo_items_to_zoho(req.items, token)
