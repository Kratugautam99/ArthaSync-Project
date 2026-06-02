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

                # ── 1. Insert into arthasync.purchase ──────────────────────
                purchase_id: _uuid.UUID = await conn.fetchval(
                    """
                    INSERT INTO arthasync.purchase (
                        invoice_number, invoice_date, due_date, gst_no,
                        vendor_name, vendor_email, vendor_phone,
                        vendor_address, vendor_gstin,
                        items,
                        subtotal,
                        cgst_percent, cgst_amount,
                        sgst_percent, sgst_amount,
                        grand_total, currency,
                        payment_status,
                        terms, remark,
                        created_by
                    ) VALUES (
                        $1,  $2,  $3,  $4,
                        $5,  $6,  $7,
                        $8,  $9,
                        $10::jsonb,
                        $11,
                        $12, $13,
                        $14, $15,
                        $16, $17,
                        'pending',
                        $18, $19,
                        'invoice_agent'
                    )
                    RETURNING id
                    """,
                    inv_number, inv_date, due_date, gst_no,
                    vendor_name, vendor_email, vendor_phone,
                    vendor_addr, vendor_gstin,
                    items_json,
                    subtotal,
                    cgst_pct, cgst_amt,
                    sgst_pct, sgst_amt,
                    total, currency,
                    terms, notes,
                )

                # ── 2. Insert into arthasync.ledger ────────────────────────
                entry_id = f"LED-{str(_uuid.uuid4())[:8].upper()}"
                await conn.execute(
                    """
                    INSERT INTO arthasync.ledger (
                        entry_id, date, source_type, source_id,
                        party, party_no, party_mail,
                        direction, amount,
                        reference, notes
                    ) VALUES (
                        $1, $2, 'purchase', $3,
                        $4, $5, $6,
                        'out', $7,
                        $8, $9
                    )
                    """,
                    entry_id,
                    inv_date,
                    purchase_id,
                    vendor_name,
                    vendor_gstin,
                    vendor_email,
                    total,
                    f"Purchase Invoice #{inv_number}",
                    notes or f"Auto-saved by Invoice Agent",
                )

                return {
                    "success": True,
                    "invoice_id": str(purchase_id),
                    "entry_id": entry_id,
                    "vendor_name": vendor_name,
                    "invoice_number": inv_number,
                    "total_amount": float(total),
                    "line_items_saved": len(line_items),
                    "tables_updated": ["arthasync.purchase", "arthasync.ledger"],
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
