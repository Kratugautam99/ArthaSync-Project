"""
ArthaSync — Upload Routes
Handles file uploads for the Invoice Processor mode.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models.schemas import UploadResponse
from app.services.file_service import save_upload, get_file_metadata

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a PDF or image for processing.
    Returns a file_id that can be passed to the /chat/stream endpoint.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    metadata = await save_upload(file)
    extracted = metadata.get("extracted_text", "")

    # Trim extracted text for response preview (full text used in chat context)
    preview = extracted[:500] + "..." if extracted and len(extracted) > 500 else extracted

    return UploadResponse(
        file_id=metadata["file_id"],
        filename=metadata["filename"],
        size_bytes=metadata["size_bytes"],
        extracted_text=preview,
        message=(
            "File uploaded and text extracted successfully."
            if extracted
            else "File uploaded. Text extraction not available for this file type."
        ),
    )


@router.get("/upload/{file_id}")
async def get_upload_info(file_id: str):
    """Get metadata about a previously uploaded file."""
    meta = get_file_metadata(file_id)
    if not meta:
        raise HTTPException(status_code=404, detail="File not found")
    # Don't expose full path
    return {
        "file_id": meta["file_id"],
        "filename": meta["filename"],
        "size_bytes": meta["size_bytes"],
        "has_extracted_text": bool(meta.get("extracted_text")),
    }
