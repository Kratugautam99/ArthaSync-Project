import asyncio
from app.services.agent_tools import push_to_zoho_tool

async def test():
    print("Testing push_to_zoho_tool...")
    try:
        res = await push_to_zoho_tool.ainvoke({"vendor_name": "Test Vendor", "total_amount": 999.0})
        print(f"Result: {res}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
