from langchain_core.tools import tool
from app.services.zoho_service import push_purchase_order, sync_yolo_items_to_zoho, get_valid_access_token
from app.services.tally_service import push_purchase_voucher, sync_yolo_items_to_tally
from typing import List

@tool
async def push_to_zoho_tool(vendor_name: str, total_amount: float) -> str:
    """Pushes a purchase order to Zoho Books for a given vendor and total amount. Use this when the user asks to save, push, or sync an invoice to Zoho."""
    token = await get_valid_access_token()
    if not token:
        return "Error: Zoho Books is not connected. Please authorize Zoho via the UI."
    
    invoice_data = {
        "vendor_name": vendor_name,
        "total_amount": total_amount
    }
    
    result = await push_purchase_order(invoice_data, token)
    if result.get("success"):
        return f"Successfully pushed purchase order to Zoho Books. Response: {result.get('data')}"
    else:
        return f"Failed to push to Zoho Books. Error: {result.get('error')}"

@tool
async def push_to_tally_tool(vendor_name: str, total_amount: float) -> str:
    """Pushes a purchase voucher to Tally Prime for a given vendor and total amount. Use this when the user asks to save, push, or sync an invoice to Tally."""
    invoice_data = {
        "vendor_name": vendor_name,
        "total_amount": total_amount
    }
    
    result = await push_purchase_voucher(invoice_data)
    if result.get("success"):
        return f"Successfully pushed purchase voucher to Tally Prime. Output: {result.get('response')}"
    else:
        return f"Failed to push to Tally Prime. Error: {result.get('error')}"

@tool
async def sync_items_to_zoho_tool(items: List[str]) -> str:
    """Syncs a list of detected inventory items (like ['chair', 'table']) to Zoho Books. Use this in Camera mode."""
    token = await get_valid_access_token()
    if not token:
        return "Error: Zoho Books is not connected. Please authorize Zoho via the UI."
    
    result = await sync_yolo_items_to_zoho(items, token)
    if result.get("success"):
        return f"Successfully synced {result.get('items_synced')} items to Zoho Books."
    else:
        return f"Failed to sync items to Zoho Books. Error: {result.get('error')}"

@tool
async def sync_items_to_tally_tool(items: List[str]) -> str:
    """Syncs a list of detected inventory items (like ['chair', 'table']) to Tally Prime. Use this in Camera mode."""
    result = await sync_yolo_items_to_tally(items)
    if result.get("success"):
        return f"Successfully synced {result.get('items_synced')} items to Tally Prime."
    else:
        return f"Failed to sync items to Tally Prime. Error: {result.get('error')}"

def get_tally_tools():
    return [push_to_tally_tool, sync_items_to_tally_tool]

def get_zoho_tools():
    return [push_to_zoho_tool, sync_items_to_zoho_tool]

def get_camera_tools():
    return [sync_items_to_zoho_tool, sync_items_to_tally_tool]
