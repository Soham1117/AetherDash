import os
import re
from decimal import Decimal, InvalidOperation
from datetime import datetime
from typing import List, Dict, Optional, Tuple

from pdfminer.high_level import extract_text


def extract_evidence_text(file_path: str, original_name: str = "") -> Tuple[str, str]:
    """
    Extract text from uploaded evidence file.
    Returns: (text, parser_used)
    """
    ext = (os.path.splitext(original_name or file_path)[1] or "").lower()

    # Reuse existing repo utility for PDFs first.
    if ext == ".pdf":
        try:
            return extract_text(file_path) or "", "pdfminer.extract_text"
        except Exception:
            pass

    # Optional OCR for image files.
    if ext in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}:
        try:
            import pytesseract
            from PIL import Image

            image = Image.open(file_path)
            return pytesseract.image_to_string(image) or "", "pytesseract"
        except Exception:
            pass

    # Last fallback: binary decode (works for some text-heavy docs)
    try:
        with open(file_path, "rb") as handle:
            raw = handle.read()
        return raw.decode("utf-8", errors="ignore"), "utf8_fallback"
    except Exception:
        return "", "none"


def _safe_decimal(value: str) -> Optional[Decimal]:
    if value is None:
        return None
    cleaned = str(value).replace(",", "").replace("$", "").strip()
    if not cleaned:
        return None
    try:
        return Decimal(cleaned)
    except (InvalidOperation, TypeError, ValueError):
        return None


def _safe_date(value: str):
    raw = (value or "").strip()
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _is_summary_line(line: str) -> bool:
    n = line.lower().strip()
    summary_tokens = [
        "subtotal",
        "total",
        "tax",
        "tip",
        "fee",
        "delivery",
        "service",
        "discount",
        "savings",
        "balance",
        "order total",
    ]
    return any(token in n for token in summary_tokens)


def _extract_item_line_generic(line: str) -> Optional[Dict]:
    # Matches "Some Item Name .... $12.34"
    m = re.search(r"^(?P<name>.+?)\s+\$?(?P<amount>-?\d+[\.,]\d{2})\s*$", line)
    if not m:
        return None

    name = m.group("name").strip(" -:\t")
    amount = _safe_decimal(m.group("amount"))
    if not name or amount is None:
        return None

    # Avoid noise rows like just "3 x" / "2x" without product name
    if re.fullmatch(r"\d+(?:\.\d+)?\s*x", name.lower().replace("×", "x").strip()):
        return None

    if _is_summary_line(name):
        return None

    return {
        "name": name[:255],
        "quantity": Decimal("1.00"),
        "unit_price": amount,
        "line_total": amount,
        "raw_line": line,
        "confidence": 0.65,
        "item_date": None,
    }


def _extract_item_line_instacart(line: str, prev_line: str = "") -> Optional[Dict]:
    # Matches patterns like "Bananas 2 x $0.59 $1.18" or "Bread 1 x 4.99"
    m = re.search(
        r"^(?P<name>.+?)\s+(?P<qty>\d+(?:\.\d+)?)\s*x\s*\$?(?P<unit>\d+[\.,]\d{2})(?:\s+\$?(?P<total>\d+[\.,]\d{2}))?$",
        line,
        re.IGNORECASE,
    )

    # OCR variant: "3 x $2.89" where product name may be on the previous line
    if not m:
        m2 = re.search(
            r"^(?P<qty>\d+(?:\.\d+)?)\s*x\s*\$?(?P<unit>\d+[\.,]\d{2})(?:\s+\$?(?P<total>\d+[\.,]\d{2}))?$",
            line,
            re.IGNORECASE,
        )
        if not m2:
            return None

        inferred_name = (prev_line or "").strip(" -:\t")
        if not inferred_name or _is_summary_line(inferred_name):
            return None

        qty = _safe_decimal(m2.group("qty")) or Decimal("1.00")
        unit = _safe_decimal(m2.group("unit"))
        total = _safe_decimal(m2.group("total")) if m2.group("total") else None
        if unit is None:
            return None
        if total is None:
            total = (qty * unit).quantize(Decimal("0.01"))

        return {
            "name": inferred_name[:255],
            "quantity": qty,
            "unit_price": unit,
            "line_total": total,
            "raw_line": f"{inferred_name} | {line}",
            "confidence": 0.78,
            "item_date": None,
        }

    name = m.group("name").strip(" -:\t")
    qty = _safe_decimal(m.group("qty")) or Decimal("1.00")
    unit = _safe_decimal(m.group("unit"))
    total = _safe_decimal(m.group("total")) if m.group("total") else None
    if not name or unit is None:
        return None

    if _is_summary_line(name):
        return None

    if total is None:
        total = (qty * unit).quantize(Decimal("0.01"))

    return {
        "name": name[:255],
        "quantity": qty,
        "unit_price": unit,
        "line_total": total,
        "raw_line": line,
        "confidence": 0.8,
        "item_date": None,
    }


def _extract_item_line_amazon(line: str) -> Optional[Dict]:
    # Handles common Amazon invoice style:
    # "USB-C Cable ... $9.99" OR "Qty: 2 USB-C Cable $9.99"
    m_qty_prefix = re.search(
        r"^qty\s*[:x]?\s*(?P<qty>\d+(?:\.\d+)?)\s+(?P<name>.+?)\s+\$?(?P<amount>\d+[\.,]\d{2})$",
        line,
        re.IGNORECASE,
    )
    if m_qty_prefix:
        qty = _safe_decimal(m_qty_prefix.group("qty")) or Decimal("1.00")
        total = _safe_decimal(m_qty_prefix.group("amount"))
        name = m_qty_prefix.group("name").strip(" -:\t")
        if total is None or not name or _is_summary_line(name):
            return None
        unit = (total / qty).quantize(Decimal("0.01")) if qty else total
        return {
            "name": name[:255],
            "quantity": qty,
            "unit_price": unit,
            "line_total": total,
            "raw_line": line,
            "confidence": 0.82,
            "item_date": None,
        }

    generic = _extract_item_line_generic(line)
    if generic:
        generic["confidence"] = 0.72
    return generic


def parse_itemized_text(
    text: str, merchant_name: str = "", transaction_date=None
) -> List[Dict]:
    lines = [ln.strip() for ln in (text or "").splitlines() if ln and ln.strip()]
    if not lines:
        return []

    merchant = (merchant_name or "").lower()
    parsed: List[Dict] = []

    prev_line = ""
    for line in lines:
        candidate = None
        if "instacart" in merchant:
            candidate = _extract_item_line_instacart(line, prev_line=prev_line) or _extract_item_line_generic(line)
        elif "amazon" in merchant or "amzn" in merchant:
            candidate = _extract_item_line_amazon(line)
        else:
            candidate = _extract_item_line_generic(line)

        if not candidate:
            # Date sniffing fallback if line starts with a date and has amount at end
            dm = re.search(
                r"^(?P<date>\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})\s+(?P<name>.+?)\s+\$?(?P<amount>\d+[\.,]\d{2})$",
                line,
            )
            if dm and not _is_summary_line(dm.group("name")):
                amount = _safe_decimal(dm.group("amount"))
                if amount is not None:
                    candidate = {
                        "name": dm.group("name")[:255],
                        "quantity": Decimal("1.00"),
                        "unit_price": amount,
                        "line_total": amount,
                        "raw_line": line,
                        "confidence": 0.6,
                        "item_date": _safe_date(dm.group("date")) or transaction_date,
                    }

        if candidate:
            candidate["item_date"] = candidate.get("item_date") or transaction_date
            parsed.append(candidate)

        prev_line = line

    return parsed
