"""
ArthaSync — File Service
Handles PDF and image uploads, text extraction, and storage.
Fixed: PDF/image OCR now uses Groq vision as reliable fallback.
Persists metadata to arthasync.file_uploads table.
"""

import os
import uuid
import base64
import aiofiles
from pathlib import Path
from typing import Optional

from fastapi import UploadFile, HTTPException

from app.config import settings

# In-memory fallback store (primary: PostgreSQL arthasync.file_uploads)
_file_store: dict[str, dict] = {}


def _get_upload_dir() -> Path:
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


async def save_upload(file: UploadFile) -> dict:
    """Save uploaded file to disk, extract text, persist metadata."""
    MAX_BYTES = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    file_id = str(uuid.uuid4())
    suffix = Path(file.filename or "upload").suffix.lower()

    allowed = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}
    if suffix not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"File type {suffix} not supported. Allowed: {', '.join(sorted(allowed))}",
        )

    dest = _get_upload_dir() / f"{file_id}{suffix}"
    content = await file.read()

    if len(content) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE_MB}MB",
        )

    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

    extracted = await _extract_text(dest, suffix)

    metadata = {
        "file_id": file_id,
        "filename": file.filename,
        "path": str(dest),
        "size_bytes": len(content),
        "suffix": suffix,
        "extracted_text": extracted,
    }

    # In-memory fallback always populated
    _file_store[file_id] = metadata

    # Persist to DB (non-fatal if DB not available)
    await _persist_to_db(metadata)

    return metadata


async def _persist_to_db(metadata: dict) -> None:
    """Save file metadata to arthasync.file_uploads (best-effort)."""
    try:
        from app.services.database_service import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO arthasync.file_uploads
                    (file_id, filename, path, suffix, size_bytes, extracted_text)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (file_id) DO NOTHING
                """,
                metadata["file_id"],
                metadata["filename"],
                metadata["path"],
                metadata["suffix"],
                metadata["size_bytes"],
                metadata.get("extracted_text"),
            )
    except Exception as e:
        print(f"[file_service] DB persist skipped: {e}")


async def _extract_text(path: Path, suffix: str) -> Optional[str]:
    """Dispatch to PDF or image extractor."""
    try:
        if suffix == ".pdf":
            return await _extract_pdf(path)
        else:
            return await _extract_image(path, suffix)
    except Exception as e:
        print(f"[file_service] Extraction failed: {e}")
        return None


# ── PDF extraction ────────────────────────────────────────────────────────────

async def _extract_pdf(path: Path) -> str:
    """
    Extract text from PDF.
    1) Try pypdf (fast, works for digital/text PDFs).
    2) If text is thin (scanned PDF), convert first pages to images → OCR via Groq vision.
    """
    text = await _pypdf_extract(path)
    if text and len(text.strip()) > 80:
        return text

    # Scanned/image-only PDF → rasterise pages and use vision
    print(f"[file_service] pypdf yielded thin text ({len(text or '')} chars) — trying vision OCR")
    images = await _pdf_to_images(path, max_pages=3)
    if images:
        chunks = []
        for img_path in images:
            chunk = await _extract_image(img_path, img_path.suffix)
            if chunk:
                chunks.append(chunk)
            # Clean up temp image
            try:
                img_path.unlink()
            except Exception:
                pass
        if chunks:
            return "\n\n".join(chunks)

    return text or "[PDF text extraction returned empty result]"


async def _pypdf_extract(path: Path) -> str:
    """pypdf text-layer extraction (fast path)."""
    try:
        from pypdf import PdfReader  # type: ignore
        reader = PdfReader(str(path))
        pages = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages.append(t.strip())
        return "\n\n".join(pages)
    except ImportError:
        return ""
    except Exception as e:
        print(f"[pypdf] {e}")
        return ""


async def _pdf_to_images(path: Path, max_pages: int = 3) -> list[Path]:
    """Convert PDF pages to PNG images using pdf2image (requires poppler)."""
    try:
        from pdf2image import convert_from_path  # type: ignore
        pages = convert_from_path(str(path), first_page=1, last_page=max_pages, dpi=200)
        tmp_dir = _get_upload_dir()
        out_paths = []
        for i, page in enumerate(pages):
            tmp_path = tmp_dir / f"_tmp_{path.stem}_p{i}.png"
            page.save(str(tmp_path), "PNG")
            out_paths.append(tmp_path)
        return out_paths
    except ImportError:
        print("[file_service] pdf2image not installed; skipping page rasterisation")
        return []
    except Exception as e:
        print(f"[pdf2image] {e}")
        return []


# ── Image extraction ──────────────────────────────────────────────────────────

async def _extract_image(path: Path, suffix: str) -> str:
    """
    Extract text from image.
    1) Try pytesseract (local OCR).
    2) Fall back to Groq vision model (llama-4-scout) — much better for invoices.
    """
    # Try local OCR first
    text = await _tesseract_ocr(path)
    if text and len(text.strip()) > 40:
        return text

    # Fall back to Groq vision
    print(f"[file_service] tesseract thin ({len(text or '')} chars) — using Groq vision")
    return await _groq_vision_extract(path, suffix)


async def _tesseract_ocr(path: Path) -> str:
    """pytesseract OCR with enhanced settings."""
    try:
        import pytesseract  # type: ignore
        from PIL import Image, ImageEnhance, ImageFilter  # type: ignore

        img = Image.open(str(path)).convert("RGB")

        # Enhance for better OCR on invoice images
        img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
        img = ImageEnhance.Contrast(img).enhance(1.5)
        img = ImageEnhance.Sharpness(img).enhance(2.0)

        # PSM 6 = assume uniform block of text (good for invoices)
        text = pytesseract.image_to_string(img, config="--psm 6 --oem 3")
        return text.strip()
    except ImportError:
        return ""
    except Exception as e:
        print(f"[tesseract] {e}")
        return ""


async def _groq_vision_extract(path: Path, suffix: str) -> str:
    """
    Use Groq's llama-4-scout vision model to extract all text from an invoice image.
    This gives high-quality structured extraction even on low-quality scans.
    """
    if not settings.GROQ_API_KEY:
        return "[Groq API key not set — cannot run vision extraction]"

    try:
        from groq import AsyncGroq  # type: ignore

        suffix_lower = suffix.lower()
        mime_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".bmp": "image/bmp",
            ".tiff": "image/tiff",
            ".tif": "image/tiff",
        }
        media_type = mime_map.get(suffix_lower, "image/jpeg")

        with open(str(path), "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode("utf-8")

        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        response = await client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{image_b64}"
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "Extract ALL text from this invoice/document image exactly as it appears. "
                                "Preserve: vendor name, invoice number, dates, line items, quantities, "
                                "prices, tax amounts (CGST/SGST/IGST), totals, GST numbers, addresses. "
                                "Return the extracted text only, structured clearly."
                            ),
                        },
                    ],
                }
            ],
            max_tokens=2048,
        )
        extracted = response.choices[0].message.content or ""
        return extracted.strip()

    except Exception as e:
        return f"[Groq vision extraction failed: {e}]"


# ── Retrieval ─────────────────────────────────────────────────────────────────

def get_file_context(file_id: str) -> Optional[str]:
    """Retrieve extracted text for a file_id (memory first, then DB)."""
    meta = _file_store.get(file_id)
    if meta:
        return meta.get("extracted_text")
    return None


async def get_file_context_async(file_id: str) -> Optional[str]:
    """Retrieve extracted text — checks memory then DB."""
    if file_id in _file_store:
        return _file_store[file_id].get("extracted_text")
    try:
        from app.services.database_service import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT extracted_text, filename, path, suffix, size_bytes "
                "FROM arthasync.file_uploads WHERE file_id = $1",
                file_id,
            )
            if row:
                meta = dict(row)
                meta["file_id"] = file_id
                _file_store[file_id] = meta  # warm cache
                return meta.get("extracted_text")
    except Exception as e:
        print(f"[file_service] DB lookup failed: {e}")
    return None


def get_file_metadata(file_id: str) -> Optional[dict]:
    return _file_store.get(file_id)
