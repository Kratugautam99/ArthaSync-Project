"""
ArthaSync — Invoice → PostgreSQL Ledger Service
Saves extracted invoice JSON to the arthasync.purchase and arthasync.ledger tables.
Schema matches create_arthasync.sql exactly.
"""

import json
import uuid as _uuid
from datetime import date, datetime
from typing import Any, Optional

from app.services.database_service import get_pool


async def save_invoice_to_ledger(invoice_data: dict) -> dict[str, Any]:
    """
    Save a parsed invoice dict to the arthasync PostgreSQL database.

    Maps invoice fields → arthasync.purchase  (vendor invoices / bills received)
    Adds a corresponding credit entry in  arthasync.ledger

    Returns a success/failure dict.
    """
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():

                vendor_name  = (invoice_data.get("vendor_name") or "").strip() or "Unknown Vendor"
                inv_number   = (invoice_data.get("invoice_number") or "").strip() or f"INV-{_uuid.uuid4().hex[:8].upper()}"
                inv_date     = _to_date(invoice_data.get("invoice_date")) or date.today()
                due_date     = _to_date(invoice_data.get("due_date"))
                currency     = (invoice_data.get("currency") or "INR").upper()[:3]
                total        = _to_decimal(invoice_data.get("total_amount", 0))
                tax          = _to_decimal(invoice_data.get("tax_amount", 0))
                subtotal     = _to_decimal(invoice_data.get("subtotal") or (total - tax))
                terms        = invoice_data.get("payment_terms") or invoice_data.get("terms") or ""
                notes        = invoice_data.get("notes") or ""
                vendor_gstin = (invoice_data.get("vendor_gstin") or "").strip() or None
                vendor_email = (invoice_data.get("vendor_email") or "").strip() or None
                vendor_phone = (invoice_data.get("vendor_phone") or "").strip() or None
                vendor_addr  = (invoice_data.get("vendor_address") or "").strip() or None
                gst_no       = (invoice_data.get("gst_no") or "").strip() or None

                # Attempt to split total tax into CGST / SGST (50/50 default)
                # Override if keys present in source data
                cgst_pct = _to_decimal(invoice_data.get("cgst_percent", 0))
                sgst_pct = _to_decimal(invoice_data.get("sgst_percent", 0))
                cgst_amt = _to_decimal(invoice_data.get("cgst_amount") or (tax / 2))
                sgst_amt = _to_decimal(invoice_data.get("sgst_amount") or (tax / 2))

                # Serialise line items as JSONB
                line_items = invoice_data.get("line_items") or []
                items_json = json.dumps(line_items)

                # ── 1. Insert into arthasync.invoices ──────────────────────
                invoice_id: _uuid.UUID = await conn.fetchval(
                    """
                    INSERT INTO arthasync.invoices (
                        invoice_number, vendor_name, customer_name,
                        invoice_date, due_date,
                        total_amount, tax_amount, subtotal, currency,
                        type, payment_status, items
                    ) VALUES (
                        $1,  $2,  $3,
                        $4,  $5,
                        $6,  $7,  $8,  $9,
                        'purchase', 'pending', $10::jsonb
                    )
                    RETURNING id
                    """,
                    inv_number, vendor_name, invoice_data.get("customer_name") or None,
                    inv_date, due_date,
                    total, tax, subtotal, currency,
                    items_json
                )

                return {
                    "success": True,
                    "invoice_id": str(invoice_id),
                    "vendor_name": vendor_name,
                    "invoice_number": inv_number,
                    "total_amount": float(total),
                    "line_items_saved": len(line_items),
                    "tables_updated": ["arthasync.invoices"],
                }

    except Exception as e:
        error_msg = str(e)
        # Duplicate invoice? Give a clear message
        if "ux_purchase_invoice_number_vendor" in error_msg or "duplicate" in error_msg.lower():
            return {
                "success": False,
                "error": f"Invoice #{invoice_data.get('invoice_number', '?')} from this vendor already exists in the database.",
            }
        return {"success": False, "error": error_msg}


# ── Type coercers ──────────────────────────────────────────────────────────────

def _to_date(val) -> Optional[date]:
    if not val:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%d-%b-%Y", "%d %b %Y"):
        try:
            return datetime.strptime(str(val).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _to_decimal(val) -> float:
    if val is None:
        return 0.0
    try:
        cleaned = str(val).replace(",", "").replace("₹", "").replace("$", "").strip()
        return round(float(cleaned), 2)
    except (ValueError, TypeError):
        return 0.0
