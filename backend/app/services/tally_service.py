import httpx
import xml.etree.ElementTree as ET
from app.config import settings

TALLY_URL = f"http://{settings.TALLY_HOST}:{settings.TALLY_PORT}/"

async def check_tally_status() -> dict:
    try:
        # Tally responds with XML on root if running
        async with httpx.AsyncClient() as client:
            resp = await client.get(TALLY_URL, timeout=3.0)
            if resp.status_code == 200:
                return {"connected": True, "company_name": settings.TALLY_COMPANY or "Default Company"}
    except Exception as e:
        pass
    return {"connected": False}

async def push_purchase_voucher(invoice_data: dict) -> dict:
    """Pushes a purchase voucher to Tally Prime via XML."""
    company = settings.TALLY_COMPANY
    vendor = invoice_data.get("vendor_name", "Cash")
    amount = invoice_data.get("total_amount", 0)
    
    xml_data = f"""<ENVELOPE>
        <HEADER>
            <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
            <IMPORTDATA>
                <REQUESTDESC>
                    <REPORTNAME>Vouchers</REPORTNAME>
                    <STATICVARIABLES>
                        <SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY>
                    </STATICVARIABLES>
                </REQUESTDESC>
                <REQUESTDATA>
                    <TALLYMESSAGE xmlns:UDF="TallyUDF">
                        <VOUCHER VCHTYPE="Purchase" ACTION="Create">
                            <DATE>20260703</DATE>
                            <PARTYLEDGERNAME>{vendor}</PARTYLEDGERNAME>
                            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
                            <ALLLEDGERENTRIES.LIST>
                                <LEDGERNAME>{vendor}</LEDGERNAME>
                                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                                <AMOUNT>{amount}</AMOUNT>
                            </ALLLEDGERENTRIES.LIST>
                            <ALLLEDGERENTRIES.LIST>
                                <LEDGERNAME>Purchase A/c</LEDGERNAME>
                                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                                <AMOUNT>-{amount}</AMOUNT>
                            </ALLLEDGERENTRIES.LIST>
                        </VOUCHER>
                    </TALLYMESSAGE>
                </REQUESTDATA>
            </IMPORTDATA>
        </BODY>
    </ENVELOPE>"""
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(TALLY_URL, data=xml_data, headers={"Content-Type": "text/xml"})
            # Parse response
            return {"success": True, "response": resp.text}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def sync_yolo_items_to_tally(items: list) -> dict:
    company = settings.TALLY_COMPANY
    synced = 0
    errors = []
    
    try:
        async with httpx.AsyncClient() as client:
            for item in items:
                xml_data = f"""<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>All Masters</REPORTNAME>
                <STATICVARIABLES>
                    <SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY>
                </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <STOCKITEM NAME="{item}" ACTION="Create">
                        <NAME>{item}</NAME>
                        <BASEUNITS>Nos</BASEUNITS>
                    </STOCKITEM>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>"""
                resp = await client.post(TALLY_URL, data=xml_data, headers={"Content-Type": "text/xml"})
                if resp.status_code == 200:
                    if "<LINEERROR>" in resp.text:
                        errors.append(f"Tally XML Error for {item}")
                    else:
                        synced += 1
                else:
                    errors.append(f"HTTP Error {resp.status_code} for {item}")
        
        if errors:
            return {"success": False, "error": " | ".join(errors)}
        return {"success": True, "items_synced": synced}
    except Exception as e:
        return {"success": False, "error": str(e)}
