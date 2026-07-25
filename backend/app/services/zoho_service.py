import httpx
import json
import os
import time
from urllib.parse import urlencode
from app.config import settings

TOKEN_FILE = "zoho_tokens.json"

def get_zoho_api_url() -> str:
    region = settings.ZOHO_REGION
    if region == "in":
        return "https://books.zoho.in/api/v3"
    elif region == "eu":
        return "https://books.zoho.eu/api/v3"
    return "https://books.zoho.com/api/v3"

def get_zoho_accounts_url() -> str:
    region = settings.ZOHO_REGION
    if region == "in":
        return "https://accounts.zoho.in/oauth/v2"
    elif region == "eu":
        return "https://accounts.zoho.eu/oauth/v2"
    return "https://accounts.zoho.com/oauth/v2"

def get_tokens() -> dict:
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "r") as f:
                return json.load(f)
        except:
            pass
    return {}

def save_tokens(tokens: dict):
    with open(TOKEN_FILE, "w") as f:
        json.dump(tokens, f)

async def check_zoho_status() -> dict:
    tokens = get_tokens()
    if tokens and "access_token" in tokens:
        return {"connected": True}
    return {"connected": False}

def generate_auth_url() -> str:
    params = {
        "scope": "ZohoBooks.fullaccess.all",
        "client_id": settings.ZOHO_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.ZOHO_REDIRECT_URI,
        "access_type": "offline",
        "prompt": "consent"
    }
    return f"{get_zoho_accounts_url()}/auth?{urlencode(params)}"

async def exchange_code_for_token(code: str) -> bool:
    url = f"{get_zoho_accounts_url()}/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": settings.ZOHO_CLIENT_ID,
        "client_secret": settings.ZOHO_CLIENT_SECRET,
        "redirect_uri": settings.ZOHO_REDIRECT_URI,
        "code": code
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, data=data)
        if resp.status_code == 200:
            token_data = resp.json()
            if "access_token" in token_data:
                token_data["expires_at"] = time.time() + token_data.get("expires_in", 3600)
                save_tokens(token_data)
                return True
    return False

async def get_valid_access_token() -> str | None:
    tokens = get_tokens()
    if not tokens or "access_token" not in tokens:
        return None
        
    if time.time() >= tokens.get("expires_at", 0) - 300: # Refresh 5 mins before expiry
        if "refresh_token" in tokens:
            url = f"{get_zoho_accounts_url()}/token"
            data = {
                "grant_type": "refresh_token",
                "client_id": settings.ZOHO_CLIENT_ID,
                "client_secret": settings.ZOHO_CLIENT_SECRET,
                "refresh_token": tokens["refresh_token"]
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, data=data)
                if resp.status_code == 200:
                    new_data = resp.json()
                    tokens["access_token"] = new_data["access_token"]
                    tokens["expires_at"] = time.time() + new_data.get("expires_in", 3600)
                    save_tokens(tokens)
                else:
                    return None
        else:
            return None
            
    return tokens["access_token"]

async def push_purchase_order(invoice_data: dict, access_token: str) -> dict:
    base_url = get_zoho_api_url()
    org_id = settings.ZOHO_ORG_ID
    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient() as client:
            # 1. Get or Create Vendor
            vendor_id = None
            vendor_name = invoice_data.get("vendor_name", "Unknown Vendor")
            contacts_resp = await client.get(f"{base_url}/contacts?organization_id={org_id}&contact_name_contains={vendor_name}", headers=headers)
            if contacts_resp.status_code == 200:
                contacts = contacts_resp.json().get("contacts", [])
                if contacts:
                    vendor_id = contacts[0]["contact_id"]
            
            if not vendor_id:
                # Create the vendor dynamically
                payload = {"contact_name": vendor_name, "contact_type": "vendor"}
                create_resp = await client.post(f"{base_url}/contacts?organization_id={org_id}", json=payload, headers=headers)
                if create_resp.status_code in (200, 201):
                    vendor_id = create_resp.json().get("contact", {}).get("contact_id")
                else:
                    return {"success": False, "error": f"Failed to dynamically create vendor '{vendor_name}': {create_resp.text}"}

            # 2. Get a valid Item (We pick the first available for simplicity, as creating an item requires account_ids)
            item_id = None
            items_resp = await client.get(f"{base_url}/items?organization_id={org_id}", headers=headers)
            if items_resp.status_code == 200:
                items = items_resp.json().get("items", [])
                if items:
                    item_id = items[0]["item_id"]

            if not item_id:
                return {"success": False, "error": "No items found in your Zoho Books account. Please create at least one item manually first (or provide default account IDs) so we can map purchase orders."}

            # 3. Create the PO
            payload = {
                "vendor_id": vendor_id,
                "line_items": [
                    {
                        "item_id": item_id, 
                        "rate": invoice_data.get("total_amount", 0),
                        "quantity": 1
                    }
                ]
            }
            
            url = f"{base_url}/purchaseorders?organization_id={org_id}"
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                return {"success": True, "data": resp.json()}
                
            return {"success": False, "error": f"Zoho API Error: {resp.text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def sync_yolo_items_to_zoho(items: list, access_token: str) -> dict:
    base_url = get_zoho_api_url()
    org_id = settings.ZOHO_ORG_ID
    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "Content-Type": "application/json"
    }
    
    synced = 0
    errors = []
    try:
        async with httpx.AsyncClient() as client:
            for item_name in items:
                # 1. Check if item exists
                items_resp = await client.get(f"{base_url}/items?organization_id={org_id}&name_contains={item_name}", headers=headers)
                if items_resp.status_code == 200 and items_resp.json().get("items"):
                    synced += 1
                    continue
                
                # 2. Attempt to create item
                # This may fail if Zoho requires income/inventory account IDs that aren't set as defaults.
                payload = {"name": item_name, "rate": 0}
                create_resp = await client.post(f"{base_url}/items?organization_id={org_id}", json=payload, headers=headers)
                if create_resp.status_code in (200, 201):
                    synced += 1
                else:
                    errors.append(f"Failed to create '{item_name}': {create_resp.json().get('message', create_resp.text)}")
                    
        if errors:
            return {"success": False, "error": " | ".join(errors)}
        return {"success": True, "items_synced": synced}
    except Exception as e:
        return {"success": False, "error": str(e)}
