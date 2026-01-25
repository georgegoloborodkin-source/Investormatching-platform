"""
Ollama-based Data Converter API
Converts unstructured data (text, CSV, JSON, etc.) into structured Startup/Investor format
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Tuple
import ollama
import os
import httpx
import json
import re
from io import StringIO
import csv

app = FastAPI(title="Ollama Data Converter API")

# Limit how much extracted text we send to the model (large PDFs often cause truncated JSON output).
# This keeps responses short enough to remain valid JSON.
MAX_MODEL_INPUT_CHARS = int(os.environ.get("MAX_MODEL_INPUT_CHARS", "24000"))

# OCR settings (for scanned/image PDFs)
OCR_MAX_PAGES = int(os.environ.get("OCR_MAX_PAGES", "5"))
OCR_DPI = int(os.environ.get("OCR_DPI", "200"))


def try_ocr_pdf_bytes(content: bytes) -> str:
    """
    Best-effort OCR for scanned/image-only PDFs.
    Requires:
      - pytesseract (python)
      - pdf2image (python)
      - Tesseract installed on the OS
      - Poppler installed on the OS (Windows: poppler-utils)
    """
    try:
        from pdf2image import convert_from_bytes  # type: ignore
        import pytesseract  # type: ignore
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "Scanned/image PDF detected but OCR dependencies are missing. "
                "Install: pip install pytesseract pdf2image, then install Tesseract + Poppler on Windows. "
                f"Error: {str(e)}"
            ),
        )

    try:
        images = convert_from_bytes(content, dpi=OCR_DPI, first_page=1, last_page=max(1, OCR_MAX_PAGES))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to render PDF pages for OCR. On Windows you usually need Poppler installed and on PATH. "
                f"Error: {str(e)}"
            ),
        )

    parts: List[str] = []
    for idx, img in enumerate(images, start=1):
        try:
            txt = pytesseract.image_to_string(img) or ""
            txt = re.sub(r"\s+\n", "\n", txt)
            txt = re.sub(r"\n{3,}", "\n\n", txt).strip()
            parts.append(f"\n--- OCR Page {idx} ---\n{txt}")
        except Exception as e:
            parts.append(f"\n--- OCR Page {idx} ---\n[OCR_FAILED: {str(e)}]")

    return "\n".join(parts).strip()

# Converter provider settings
_provider_env = os.getenv("CONVERTER_PROVIDER")
CONVERTER_PROVIDER = (_provider_env or "ollama").lower().strip()

# Ollama connection settings
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
PREFERRED_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "vc-converter:latest")

# Anthropic (Claude) settings
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620")
ANTHROPIC_API_URL = os.getenv("ANTHROPIC_API_URL", "https://api.anthropic.com/v1/messages")
ANTHROPIC_MODEL_FALLBACKS = [
    ANTHROPIC_MODEL,
    "claude-3-5-sonnet-20240620",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-haiku-20240307",
    "claude-3-opus-20240229",
]

# Ask-the-fund settings (keep costs lean)
ASK_MAX_TOKENS = int(os.getenv("ASK_MAX_TOKENS", "700"))
ASK_MAX_SOURCES = int(os.getenv("ASK_MAX_SOURCES", "6"))
ASK_MAX_SNIPPET_CHARS = int(os.getenv("ASK_MAX_SNIPPET_CHARS", "400"))

# Embeddings settings (semantic search)
EMBEDDINGS_PROVIDER = os.getenv("EMBEDDINGS_PROVIDER", "ollama").lower().strip()
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")

# Ingestion settings
CLICKUP_API_TOKEN = os.getenv("CLICKUP_API_TOKEN")

def get_anthropic_api_url() -> str:
    """
    Normalize Anthropic API URL.
    Accepts base URLs like:
      - https://api.anthropic.com
      - https://api.anthropic.com/v1
      - https://api.anthropic.com/v1/messages
      - https://api.anthropic.com/v1/messages/
    Returns the full /v1/messages endpoint.
    """
    base = (ANTHROPIC_API_URL or "").strip()
    if not base:
        return "https://api.anthropic.com/v1/messages"
    base = base.rstrip("/")
    if base.endswith("/v1/messages"):
        return base
    if base.endswith("/v1"):
        return f"{base}/messages"
    return f"{base}/v1/messages"


async def fetch_ollama_model_names() -> List[str]:
    """
    More reliable than python ollama.list() on some setups.
    Uses Ollama's HTTP API to list installed models.
    """
    names: List[str] = []

    # First, try the HTTP /api/tags endpoint
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(f"{OLLAMA_HOST}/api/tags")
            res.raise_for_status()
            data = res.json() or {}
            models = data.get("models", []) or []
            for m in models:
                if isinstance(m, dict) and m.get("name"):
                    names.append(m["name"])
    except Exception:
        # swallow and try python client fallback below
        names = []

    # Fallback: python client list() if HTTP returned nothing
    if not names:
        try:
            client = get_ollama_client()
            models = client.list()
            if isinstance(models, dict):
                for m in models.get("models", []) or []:
                    if isinstance(m, dict) and m.get("name"):
                        names.append(m["name"])
                    elif isinstance(m, str):
                        names.append(m)
        except Exception:
            pass

    return names


def pick_model(available_models: List[str]) -> str:
    """
    Pick a model name to use for conversion.
    Prefer env OLLAMA_MODEL, then vc-converter*, then llama3.1*, then llama3.2*, else first.
    """
    if not available_models:
        return PREFERRED_OLLAMA_MODEL

    if PREFERRED_OLLAMA_MODEL in available_models:
        return PREFERRED_OLLAMA_MODEL

    for prefix in ["vc-converter", "llama3.1", "llama3.2", "llama3"]:
        for name in available_models:
            if name.startswith(prefix):
                return name

    return available_models[0]


def get_ollama_client() -> "ollama.Client":
    # Force the host so the python client matches what `ollama list` uses.
    return ollama.Client(host=OLLAMA_HOST)

# CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    # Dev-friendly: allow any origin to call the local converter API.
    # If you later deploy this, lock this down to your production domain.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class StartupData(BaseModel):
    companyName: str
    geoMarkets: List[str]
    industry: str
    fundingTarget: int
    fundingStage: str
    availabilityStatus: str = "present"

class InvestorData(BaseModel):
    firmName: str
    memberName: str
    geoFocus: List[str]
    industryPreferences: List[str]
    stagePreferences: List[str]
    minTicketSize: int
    maxTicketSize: int
    totalSlots: int = 3
    tableNumber: Optional[str] = None
    availabilityStatus: str = "present"

class MentorData(BaseModel):
    fullName: str
    email: str
    linkedinUrl: Optional[str] = None
    geoFocus: List[str]
    industryPreferences: List[str]
    expertiseAreas: List[str]
    totalSlots: int = 3
    availabilityStatus: str = "present"

class CorporateData(BaseModel):
    firmName: str
    contactName: str
    email: Optional[str] = None
    geoFocus: List[str]
    industryPreferences: List[str]
    partnershipTypes: List[str]
    stages: List[str]
    totalSlots: int = 3
    availabilityStatus: str = "present"

class ConversionRequest(BaseModel):
    data: str  # Unstructured data (text, CSV, JSON, etc.)
    dataType: Optional[str] = None  # 'startup', 'investor', or None for auto-detect
    format: Optional[str] = None  # 'csv', 'text', 'json', etc.

class ConversionResponse(BaseModel):
    startups: List[StartupData] = []
    investors: List[InvestorData] = []
    mentors: List[MentorData] = []
    corporates: List[CorporateData] = []
    detectedType: str
    confidence: float
    warnings: List[str] = []
    errors: List[str] = []

class FileValidationResponse(BaseModel):
    isValid: bool
    errors: List[str] = []
    warnings: List[str] = []
    detectedType: Optional[str] = None
    startupCsvTemplate: Optional[str] = None
    investorCsvTemplate: Optional[str] = None

class ClickUpIngestRequest(BaseModel):
    list_id: str
    include_closed: bool = True

class ClickUpIngestResponse(BaseModel):
    tasks: List[Dict[str, Any]] = []

class ClickUpListsRequest(BaseModel):
    team_id: str

class AskSource(BaseModel):
    title: Optional[str] = None
    snippet: Optional[str] = None
    file_name: Optional[str] = None

class AskDecision(BaseModel):
    startup_name: Optional[str] = None
    action_type: Optional[str] = None
    outcome: Optional[str] = None
    notes: Optional[str] = None

class AskRequest(BaseModel):
    question: str
    sources: List[AskSource] = []
    decisions: List[AskDecision] = []

class AskResponse(BaseModel):
    answer: str

class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    embedding: List[float]

class ClickUpListsResponse(BaseModel):
    lists: List[Dict[str, Any]] = []

class GoogleDriveIngestRequest(BaseModel):
    url: str
    access_token: Optional[str] = None

class GoogleDriveIngestResponse(BaseModel):
    title: str
    content: str
    raw_content: str  # Alias for content, for clarity
    sourceType: str

# System prompt for Ollama
SYSTEM_PROMPT = """You are a data extraction and conversion expert. Your task is to extract structured information from unstructured text and convert it into JSON format.

You will receive unstructured data about startups, investors, mentors, or corporates, and you must extract the following information:

FOR STARTUPS:
- companyName: The name of the company/startup
- geoMarkets: List of geographic markets (e.g., ["North America", "Europe"])
- industry: Industry sector (e.g., "AI/ML", "Fintech", "Healthtech")
- fundingTarget: Funding amount as integer (remove currency symbols, commas)
- fundingStage: Stage (e.g., "Pre-seed", "Seed", "Series A", "Series B+")

FOR INVESTORS:
- firmName: Name of the VC firm/investor
- memberName: The specific investor team member/person name (REQUIRED)
- geoFocus: List of geographic focus areas
- industryPreferences: List of preferred industries
- stagePreferences: List of preferred funding stages
- minTicketSize: Minimum investment amount as integer
- maxTicketSize: Maximum investment amount as integer
- totalSlots: Number of meeting slots (default: 3)
- tableNumber: Optional table/booth number

FOR MENTORS:
- fullName: Full name of the mentor (REQUIRED)
- email: Email address (REQUIRED)
- linkedinUrl: LinkedIn profile URL
- geoFocus: List of geographic focus areas
- industryPreferences: List of preferred industries
- expertiseAreas: List of expertise areas (e.g., ["Product Development", "Fundraising"])
- totalSlots: Number of meeting slots (default: 3)

FOR CORPORATES:
- firmName: Name of the corporate/company (REQUIRED)
- contactName: Name of the corporate contact person (REQUIRED)
- email: Email address
- geoFocus: List of geographic focus areas
- industryPreferences: List of preferred industries
- partnershipTypes: List of partnership types (e.g., ["Pilot Program", "Distribution"])
- stages: List of startup stages of interest (e.g., ["Seed", "Series A"])
- totalSlots: Number of meeting slots (default: 3)

IMPORTANT RULES:
1. Always return valid JSON only, no markdown or explanations
2. If multiple entities are found, return an array
3. Extract numbers from text (e.g., "$2M" -> 2000000, "€500K" -> 500000)
4. Parse lists from text (e.g., "North America, Europe" -> ["North America", "Europe"])
5. If information is missing, use reasonable defaults or empty arrays
6. For funding stages, normalize to: "Pre-seed", "Seed", "Series A", "Series B+"
7. For industries, use standard names: "Fintech", "Healthtech", "EdTech", "E-commerce", "Construction", "Transportation/Mobility", "AI/ML", "Logistics", "Consumer Goods", "SaaS", "CleanTech"

Return ONLY the JSON object or array, nothing else."""

def create_conversion_prompt(data: str, data_type: Optional[str] = None) -> str:
    """Create a prompt for Ollama to convert unstructured data"""
    # Keep prompt/model input bounded to reduce truncation.
    trimmed = data if len(data) <= MAX_MODEL_INPUT_CHARS else data[:MAX_MODEL_INPUT_CHARS]
    if len(trimmed) != len(data):
        trimmed = trimmed + "\n\n[TRUNCATED INPUT: content was longer than MAX_MODEL_INPUT_CHARS]"
    if data_type:
        prompt = (
            f"Extract {data_type} information from the following data and convert to JSON format.\n"
            f"Return ONLY valid JSON (no commentary). Keep it minimal: only the required fields.\n\n{trimmed}\n"
        )
    else:
        prompt = (
            "Extract startup or investor information from the following data. Auto-detect the type and convert to JSON.\n"
            "Return ONLY valid JSON (no commentary). Keep it minimal: only the required fields.\n\n"
            f"{trimmed}\n"
        )
    return prompt

def parse_ollama_response(response: str) -> Dict[str, Any]:
    """Parse model response and extract JSON"""
    # Remove markdown code blocks if present
    response = re.sub(r'```json\n?', '', response)
    response = re.sub(r'```\n?', '', response)
    response = response.strip()

    def extract_first_json_block(text: str) -> Optional[str]:
        """
        Extract the first complete JSON object/array from text using bracket balancing.
        This is robust against extra prose before/after JSON and avoids greedy regex traps.
        """
        start_idx = None
        stack: List[str] = []
        in_string = False
        escape = False

        for i, ch in enumerate(text):
            if start_idx is None:
                if ch == '{':
                    start_idx = i
                    stack = ['}']
                elif ch == '[':
                    start_idx = i
                    stack = [']']
                continue

            # We are inside a candidate JSON block
            if in_string:
                if escape:
                    escape = False
                elif ch == '\\':
                    escape = True
                elif ch == '"':
                    in_string = False
                continue

            if ch == '"':
                in_string = True
                continue

            if ch == '{':
                stack.append('}')
            elif ch == '[':
                stack.append(']')
            elif ch in ('}', ']'):
                if stack and ch == stack[-1]:
                    stack.pop()
                    if not stack and start_idx is not None:
                        return text[start_idx:i + 1]
                else:
                    # Mismatched closing bracket; keep scanning but this block is likely invalid.
                    pass

        return None

    # First try: extract a complete JSON block from within the response
    block = extract_first_json_block(response)
    if block:
        try:
            return json.loads(block)
        except json.JSONDecodeError:
            pass

    # Fallback: try parsing the whole response as JSON
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        raise ValueError(
            "Could not parse JSON from model response (likely truncated / non-JSON). "
            f"Response starts with: {response[:200]}"
        )

def is_model_not_found(response: httpx.Response) -> bool:
    try:
        data = response.json() or {}
        err = data.get("error") or {}
        return err.get("type") == "not_found_error" and "model" in str(err.get("message", "")).lower()
    except Exception:
        return False

async def call_anthropic(prompt: str) -> str:
    """
    Call Anthropic (Claude) API and return the raw text response.
    Uses server-side API key from environment variables.
    """
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY not set. Set it in the server environment to use Claude."
        )

    headers = {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
    }
    url = get_anthropic_api_url()
    default_url = "https://api.anthropic.com/v1/messages"

    last_error: Optional[str] = None
    async with httpx.AsyncClient(timeout=60.0) as client:
        for model_name in [m for m in ANTHROPIC_MODEL_FALLBACKS if m]:
            payload = {
                "model": model_name,
                "max_tokens": 4096,
                "temperature": 0.1,
                "system": SYSTEM_PROMPT,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
            }

            res = await client.post(url, headers=headers, json=payload)
            # If a misconfigured URL causes 404, retry with the canonical endpoint.
            if res.status_code == 404 and url != default_url:
                res = await client.post(default_url, headers=headers, json=payload)
            if res.status_code == 404 and is_model_not_found(res):
                last_error = f"Model not found: {model_name}"
                continue
            if res.status_code == 404:
                body = res.text[:400].strip()
                raise HTTPException(
                    status_code=502,
                    detail=(
                        f"Claude API 404 at {url}. Check ANTHROPIC_API_URL and account access. "
                        f"Response: {body or 'empty'}"
                    ),
                )
            try:
                res.raise_for_status()
            except httpx.HTTPError as e:
                last_error = str(e)
                continue

            data = res.json()
            content = data.get("content", [])
            if not content or not isinstance(content, list) or "text" not in content[0]:
                last_error = "Claude returned empty content."
                continue
            return content[0]["text"]

    raise HTTPException(
        status_code=502,
        detail=f"Claude API error: {last_error or 'Unknown error. All models failed.'}"
    )

def build_answer_prompt(question: str, sources: List[AskSource], decisions: List[AskDecision]) -> str:
    safe_sources = (sources or [])[:ASK_MAX_SOURCES]
    source_lines: List[str] = []
    for idx, src in enumerate(safe_sources, start=1):
        title = src.title or src.file_name or f"Source {idx}"
        snippet = (src.snippet or "").strip()
        if len(snippet) > ASK_MAX_SNIPPET_CHARS:
            snippet = snippet[:ASK_MAX_SNIPPET_CHARS] + "…"
        source_lines.append(f"[{idx}] {title}\n{snippet}")

    decision_lines: List[str] = []
    for d in decisions or []:
        summary = " | ".join(
            [part for part in [d.startup_name, d.action_type, d.outcome, d.notes] if part]
        )
        if summary:
            decision_lines.append(f"- {summary}")

    sources_block = "\n\n".join(source_lines) if source_lines else "No sources available."
    decisions_block = "\n".join(decision_lines) if decision_lines else "No decision history available."

    return f"""You are Orbit AI, a VC intelligence system. You answer questions STRICTLY from the provided sources only.

CRITICAL RULES:
1. ONLY use information from the sources below. Do NOT use general knowledge.
2. If the sources don't contain the answer, say: "I don't have information about this in the provided sources. Please upload relevant documents or try a different question."
3. Cite sources using [1], [2], etc. for every claim.
4. Be concise and factual. No speculation.

Question:
{question}

Sources:
{sources_block}

Decision history (optional context):
{decisions_block}

Remember: If the answer isn't in the sources above, you MUST say you don't have that information. Never make up answers.
"""

async def call_anthropic_answer(prompt: str) -> str:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY not set. Set it in the server environment to use Claude."
        )

    headers = {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
    }
    url = get_anthropic_api_url()
    default_url = "https://api.anthropic.com/v1/messages"

    last_error: Optional[str] = None
    async with httpx.AsyncClient(timeout=60.0) as client:
        for model_name in [m for m in ANTHROPIC_MODEL_FALLBACKS if m]:
            payload = {
                "model": model_name,
                "max_tokens": ASK_MAX_TOKENS,
                "temperature": 0.1,
                "system": "You are Orbit AI, a VC intelligence system. You answer questions STRICTLY from provided sources only. Never use general knowledge. If information isn't in the sources, say so explicitly. Always cite sources with [1], [2], etc.",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
            }

            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 404 and url != default_url:
                res = await client.post(default_url, headers=headers, json=payload)
            if res.status_code == 404 and is_model_not_found(res):
                last_error = f"Model not found: {model_name}"
                continue
            if res.status_code >= 400:
                body = res.text[:400].strip()
                raise HTTPException(
                    status_code=502,
                    detail=f"Claude API error ({res.status_code}): {body or 'empty response'}",
                )

            data = res.json() or {}
            content = data.get("content") or []
            text = ""
            if isinstance(content, list) and content:
                text = content[0].get("text") or ""
            elif isinstance(content, str):
                text = content
            if not text:
                raise HTTPException(status_code=502, detail="Claude returned empty content.")
            return text.strip()

    raise HTTPException(status_code=503, detail=last_error or "No Claude model available.")

def normalize_startup_data(data: Dict[str, Any]) -> StartupData:
    """Normalize extracted startup data to match schema"""
    def safe_str(val: Any) -> str:
        return val.strip() if isinstance(val, str) else (str(val).strip() if val is not None else "")
    def safe_int(val: Any, default: int = 0) -> int:
        try:
            if val is None:
                return default
            if isinstance(val, (int, float)):
                return int(val)
            if isinstance(val, str):
                cleaned = re.sub(r'[^\d.]', '', val)
                return int(float(cleaned)) if cleaned else default
            return default
        except Exception:
            return default

    # Handle geoMarkets (accept snake_case + common synonyms like region)
    geo_markets = data.get('geoMarkets', data.get('geo_markets', data.get('region', data.get('regions', data.get('geography', [])))))
    if isinstance(geo_markets, str):
        geo_markets = [g.strip() for g in re.split(r'[,;|]', geo_markets)]
    
    # Handle fundingTarget
    funding_target = data.get('fundingTarget', data.get('funding_target', 0))
    if isinstance(funding_target, str):
        # Extract number from string
        funding_target = re.sub(r'[^\d.]', '', funding_target)
        funding_target = int(float(funding_target)) if funding_target else 0
    funding_target = safe_int(funding_target, 0)
    
    return StartupData(
        companyName=safe_str(data.get('companyName', data.get('company_name', data.get('name', '')))),
        geoMarkets=geo_markets if isinstance(geo_markets, list) else [],
        industry=safe_str(data.get('industry', data.get('sector', data.get('startup_industry', '')))),
        fundingTarget=safe_int(funding_target, 0),
        fundingStage=safe_str(data.get('fundingStage', data.get('funding_stage', data.get('stage', '')))),
        availabilityStatus='present'
    )

def normalize_investor_data(data: Dict[str, Any]) -> InvestorData:
    """Normalize extracted investor data to match schema"""
    def safe_str(val: Any) -> str:
        return val.strip() if isinstance(val, str) else (str(val).strip() if val is not None else "")
    def safe_int(val: Any, default: int = 0) -> int:
        try:
            if val is None:
                return default
            if isinstance(val, (int, float)):
                return int(val)
            if isinstance(val, str):
                cleaned = re.sub(r'[^\d.]', '', val)
                return int(float(cleaned)) if cleaned else default
            return default
        except Exception:
            return default

    # Handle lists
    def parse_list(value):
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return [item.strip() for item in re.split(r'[,;|]', value) if item.strip()]
        return []
    
    # Handle numbers
    def parse_number(value):
        if value is None:
            return 0
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str):
            # Handle currency and multipliers
            val = value.upper()
            multiplier = 1
            if 'M' in val or 'MILLION' in val:
                multiplier = 1000000
            elif 'K' in val or 'THOUSAND' in val:
                multiplier = 1000
            digits = re.sub(r'[^\d.]', '', val)
            try:
                return int(float(digits) * multiplier) if digits else 0
            except Exception:
                return 0
        # Fallback for any other type
        return safe_int(value, 0)
    
    geo_focus = parse_list(
        data.get('geoFocus') or
        data.get('geo_focus') or 
        data.get('Main Geographies Targeted (labels)') or  # Orbit CSV format
        data.get('Location') or
        data.get('geoMarkets') or 
        data.get('region') or 
        data.get('regions') or 
        data.get('geography') or 
        []
    )
    
    industry_prefs = parse_list(
        data.get('industryPreferences') or 
        data.get('industry_preferences') or 
        data.get('[BD] Vertical Interests / Vertical (labels)') or  # Orbit CSV format
        data.get('Vertical Interests') or
        data.get('industries') or 
        []
    )
    
    stage_prefs = parse_list(
        data.get('stagePreferences') or 
        data.get('stage_preferences') or 
        data.get('stages') or 
        []
    )
    
    # Handle cheque/ticket size - may be a range like "100K-500K" or ">1M"
    cheque_size_raw = data.get('[INV] Cheque Size (labels)') or data.get('Cheque Size') or data.get('Check Size') or ''
    
    if cheque_size_raw and isinstance(cheque_size_raw, str):
        # Parse ranges like "100K-500K" or ">1M"
        if '-' in cheque_size_raw:
            parts = cheque_size_raw.split('-')
            min_ticket = parse_number(parts[0]) if len(parts) > 0 else 0
            max_ticket = parse_number(parts[1]) if len(parts) > 1 else min_ticket * 10
        elif '>' in cheque_size_raw:
            min_ticket = parse_number(cheque_size_raw.replace('>', ''))
            max_ticket = min_ticket * 10
        elif '<' in cheque_size_raw:
            max_ticket = parse_number(cheque_size_raw.replace('<', ''))
            min_ticket = max_ticket // 10
        else:
            min_ticket = parse_number(cheque_size_raw)
            max_ticket = min_ticket * 5
    else:
        min_ticket = parse_number(data.get('minTicketSize') or data.get('min_ticket_size') or data.get('minInvestment') or 0)
        max_ticket = parse_number(data.get('maxTicketSize') or data.get('max_ticket_size') or data.get('maxInvestment') or 10000000)
    
    total_slots = safe_int(data.get('totalSlots') or data.get('total_slots') or data.get('slots') or 3, 3)

    # Handle various column name formats from different sources
    firm_name = safe_str(
        data.get('firmName') or 
        data.get('firm_name') or 
        data.get('Investor name') or  # Orbit CSV format
        data.get('name') or 
        data.get('firm') or 
        data.get('Company Name') or
        ''
    )
    
    member_name = safe_str(
        data.get('memberName') or 
        data.get('member_name') or 
        data.get('🦅 [INV] Team Member (users)') or  # Orbit CSV format
        data.get('[INV] Team Member (users)') or
        data.get('Team Member') or
        data.get('investment_member') or 
        data.get('investorMemberName') or 
        data.get('contactName') or 
        data.get('partnerName') or 
        data.get('personName') or 
        ''
    )
    
    return InvestorData(
        firmName=firm_name,
        memberName=member_name,
        geoFocus=geo_focus,
        industryPreferences=industry_prefs,
        stagePreferences=stage_prefs,
        minTicketSize=min_ticket,
        maxTicketSize=max_ticket,
        totalSlots=total_slots,
        tableNumber=data.get('tableNumber', data.get('table_number', data.get('table', None))),
        availabilityStatus='present'
    )

def normalize_mentor_data(data: Dict[str, Any]) -> MentorData:
    """Normalize extracted mentor data to match schema"""
    def safe_str(val: Any) -> str:
        return val.strip() if isinstance(val, str) else (str(val).strip() if val is not None else "")
    
    def parse_list(value):
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return [item.strip() for item in re.split(r'[,;|]', value) if item.strip()]
        return []
    
    full_name = safe_str(
        data.get('fullName') or 
        data.get('full_name') or 
        data.get('Full Name') or 
        data.get('name') or 
        ''
    )
    
    email = safe_str(
        data.get('email') or 
        data.get('Email') or 
        ''
    )
    
    linkedin_url = safe_str(
        data.get('linkedinUrl') or 
        data.get('linkedin_url') or 
        data.get('LinkedIn URL') or 
        data.get('LinkedIn') or 
        None
    )
    
    geo_focus = parse_list(
        data.get('geoFocus') or
        data.get('geo_focus') or 
        data.get('Location') or
        data.get('region') or 
        []
    )
    
    industry_prefs = parse_list(
        data.get('industryPreferences') or 
        data.get('industry_preferences') or 
        data.get('Industry Preferences') or
        data.get('industries') or 
        []
    )
    
    expertise_areas = parse_list(
        data.get('expertiseAreas') or 
        data.get('expertise_areas') or 
        data.get('Expertise Areas') or
        data.get('expertise') or 
        []
    )
    
    total_slots = int(data.get('totalSlots') or data.get('total_slots') or data.get('Total Slots') or 3)
    
    return MentorData(
        fullName=full_name,
        email=email,
        linkedinUrl=linkedin_url,
        geoFocus=geo_focus,
        industryPreferences=industry_prefs,
        expertiseAreas=expertise_areas,
        totalSlots=total_slots,
        availabilityStatus='present'
    )

def normalize_corporate_data(data: Dict[str, Any]) -> CorporateData:
    """Normalize extracted corporate data to match schema"""
    def safe_str(val: Any) -> str:
        return val.strip() if isinstance(val, str) else (str(val).strip() if val is not None else "")
    
    def parse_list(value):
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return [item.strip() for item in re.split(r'[,;|]', value) if item.strip()]
        return []
    
    firm_name = safe_str(
        data.get('firmName') or 
        data.get('firm_name') or 
        data.get('Company Name') or 
        data.get('companyName') or 
        data.get('name') or 
        ''
    )
    
    contact_name = safe_str(
        data.get('contactName') or 
        data.get('contact_name') or 
        data.get('Contact Name') or 
        ''
    )
    
    email = safe_str(
        data.get('email') or 
        data.get('Email') or 
        None
    )
    
    geo_focus = parse_list(
        data.get('geoFocus') or
        data.get('geo_focus') or 
        data.get('Location') or
        data.get('region') or 
        []
    )
    
    industry_prefs = parse_list(
        data.get('industryPreferences') or 
        data.get('industry_preferences') or 
        data.get('Industry Preferences') or
        data.get('industries') or 
        []
    )
    
    partnership_types = parse_list(
        data.get('partnershipTypes') or 
        data.get('partnership_types') or 
        data.get('Partnership Types') or
        []
    )
    
    stages = parse_list(
        data.get('stages') or 
        data.get('Stages') or 
        []
    )
    
    total_slots = int(data.get('totalSlots') or data.get('total_slots') or data.get('Total Slots') or 3)
    
    return CorporateData(
        firmName=firm_name,
        contactName=contact_name,
        email=email,
        geoFocus=geo_focus,
        industryPreferences=industry_prefs,
        partnershipTypes=partnership_types,
        stages=stages,
        totalSlots=total_slots,
        availabilityStatus='present'
    )

async def extract_text_content(file: UploadFile) -> Tuple[str, str]:
    """
    Shared helper to read an uploaded file and extract text_content with best-effort parsing.
    Returns (file_ext, text_content).
    """
    # Read the uploaded file bytes.
    # On some setups, UploadFile may be at EOF (e.g. if something already read the stream),
    # so we retry once after seeking back to the start.
    content = await file.read()
    if not content or len(content) == 0:
        try:
            await file.seek(0)
            content = await file.read()
        except Exception:
            # If seek/read fails, we fall through to the empty-upload guard below.
            pass
    file_ext = file.filename.split('.')[-1].lower() if file.filename else ""
    text_content = None  # Initialize to None

    # Guard: empty upload (common when the browser upload failed or the file is zero bytes)
    if not content or len(content) == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Uploaded file is empty (0 bytes). Re-upload the file. "
                "If this keeps happening, the browser may be sending an empty payload or the file may be corrupt. "
                f"filename={file.filename!r}, content_type={getattr(file, 'content_type', None)!r}"
            )
        )

    # Normalize extension and detect by magic bytes only if we don't already recognize a handled type.
    handled_exts = {'pdf', 'xlsx', 'xls', 'csv', 'txt', 'json', 'doc', 'docx'}
    # Fallback detection by magic bytes (override when extension is missing or wrong)
    # NOTE: some PDFs may have leading bytes before the %PDF header, so we search the first chunk.
    head = content[:2048]
    if b'%PDF' in head and file_ext not in handled_exts:
        file_ext = 'pdf'
    elif head[:2] == b'PK' and b'[Content_Types].xml' in head:
        # Peek inside the zip to disambiguate docx vs xlsx
        try:
            import zipfile
            from io import BytesIO
            with zipfile.ZipFile(BytesIO(content)) as z:
                names = set(z.namelist())
                if 'word/document.xml' in names:
                    file_ext = 'docx'
                elif 'xl/workbook.xml' in names or any(n.startswith('xl/') for n in names):
                    file_ext = 'xlsx'
                elif file_ext not in handled_exts:
                    # default fallback
                    file_ext = 'xlsx'
        except Exception:
            # fall back to extension if zip probe fails
            if file_ext not in handled_exts and file_ext not in ['docx', 'xlsx']:
                file_ext = 'xlsx'
    elif content.startswith(b'\xd0\xcf\x11\xe0') and file_ext not in handled_exts:
        # Old Office formats (could be doc or xls); if extension says doc, keep doc, else assume xls
        file_ext = 'doc' if file_ext == 'doc' else 'xls'
    
    # Handle Excel files (XLSX, XLS)
    if file_ext in ['xlsx', 'xls']:
        try:
            if file_ext == 'xlsx':
                try:
                    import openpyxl
                    from io import BytesIO
                    
                    excel_file = BytesIO(content)
                    workbook = openpyxl.load_workbook(excel_file, data_only=True)
                    text_content = ""
                    
                    # Get the first sheet
                    sheet = workbook.active
                    
                    # Extract headers
                    if sheet.max_row > 0:
                        headers = []
                        for cell in sheet[1]:
                            headers.append(str(cell.value) if cell.value else "")
                        text_content += ",".join(headers) + "\n"
                        
                        # Extract data rows
                        for row in sheet.iter_rows(min_row=2, values_only=False):
                            row_data = []
                            for cell in row:
                                row_data.append(str(cell.value) if cell.value else "")
                            text_content += ",".join(row_data) + "\n"
                    
                    if not text_content.strip():
                        raise HTTPException(status_code=400, detail="Excel file appears to be empty.")
                except ImportError:
                    raise HTTPException(
                        status_code=500,
                        detail="XLSX support requires openpyxl. Install with: pip install openpyxl"
                    )
            else:  # XLS
                try:
                    import xlrd
                    
                    workbook = xlrd.open_workbook(file_contents=content)
                    text_content = ""
                    
                    # Get the first sheet
                    sheet = workbook.sheet_by_index(0)
                    
                    # Extract headers
                    if sheet.nrows > 0:
                        headers = [str(sheet.cell_value(0, col)) for col in range(sheet.ncols)]
                        text_content += ",".join(headers) + "\n"
                        
                        # Extract data rows
                        for row_idx in range(1, sheet.nrows):
                            row_data = [str(sheet.cell_value(row_idx, col)) for col in range(sheet.ncols)]
                            text_content += ",".join(row_data) + "\n"
                    
                    if not text_content.strip():
                        raise HTTPException(status_code=400, detail="Excel file appears to be empty.")
                except ImportError:
                    raise HTTPException(
                        status_code=500,
                        detail="XLS support requires xlrd. Install with: pip install xlrd"
                    )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse Excel file: {str(e)}")
        
        # After Excel parsing, text_content should be set
        if text_content is None or not text_content.strip():
            raise HTTPException(status_code=500, detail="Excel file parsing completed but no content extracted.")
    
    # Handle DOCX files (prefer python-docx for tables; fallback to raw XML)
    elif file_ext == 'docx':
        try:
            from io import BytesIO
            try:
                from docx import Document  # type: ignore
                doc = Document(BytesIO(content))
                parts = []
                for p in doc.paragraphs:
                    if p.text and p.text.strip():
                        parts.append(p.text)
                for table in doc.tables:
                    for row in table.rows:
                        row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text is not None)
                        if row_text.strip():
                            parts.append(row_text)
                text_content = "\n".join(parts)
            except ImportError:
                # Fallback: manual XML strip
                import zipfile
                with zipfile.ZipFile(BytesIO(content)) as z:
                    with z.open('word/document.xml') as doc_xml:
                        raw_xml = doc_xml.read().decode('utf-8', errors='ignore')
                        # Replace paragraph boundaries with newline
                        raw_xml = raw_xml.replace('</w:p>', '\n')
                        # Strip XML tags
                        text_content = re.sub(r'<[^>]+>', '', raw_xml)
            if not text_content or not text_content.strip():
                raise HTTPException(status_code=400, detail="DOCX appears to have no extractable text. If this is a scanned/image DOCX, re-save as PDF or CSV.")
        except KeyError:
            raise HTTPException(status_code=400, detail="DOCX is missing document.xml. Please re-save the file or export to PDF.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not extract text from DOCX. Please export to PDF or CSV. Error: {str(e)}")

    # Handle DOC files (legacy binary) — best-effort text extraction; if empty, ask user to convert
    elif file_ext == 'doc':
        try:
            # DOC is legacy OLE; we don't depend on heavy converters here.
            # Best-effort: decode as latin-1 ignoring errors and strip control chars.
            raw = content.decode('latin-1', errors='ignore')
            # Remove nulls and most control chars
            cleaned = re.sub(r'[\x00-\x08\x0B-\x1F\x7F]', ' ', raw)
            # Collapse whitespace
            cleaned = re.sub(r'\s+', ' ', cleaned).strip()
            if len(cleaned) < 20:
                raise HTTPException(status_code=400, detail="DOC (legacy Word) has no extractable text. Please re-save as DOCX or PDF and re-upload.")
            text_content = cleaned
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"DOC (legacy Word) could not be read. Please re-save as DOCX or PDF and re-upload. Error: {str(e)}")

    # Handle PDF files
    elif file_ext == 'pdf':
        # Quick sanity-check: real PDFs should contain a %PDF header near the beginning.
        # Some PDFs may have leading bytes, so search the first chunk instead of only prefix.
        if b"%PDF" not in content[:8192]:
            head_hex = content[:32].hex()
            raise HTTPException(
                status_code=400,
                detail=f'File has ".pdf" extension but does not look like a valid PDF (missing %PDF header). First bytes (hex): {head_hex}'
            )

        # 1) Try PyMuPDF first (often more robust than PyPDF2/pdfplumber on quirky PDFs)
        pymupdf_error = None
        try:
            import fitz  # PyMuPDF
            from io import BytesIO

            doc = fitz.open(stream=BytesIO(content).getvalue(), filetype="pdf")
            parts = []
            for i in range(doc.page_count):
                page = doc.load_page(i)
                page_text = page.get_text("text") or ""
                parts.append(f"\n--- Page {i + 1} ---\n{page_text}")
            text_content = "\n".join(parts).strip()
        except Exception as e:
            pymupdf_error = e
            text_content = None

        # If PyMuPDF extracted real text, we're done.
        if text_content and len(text_content.strip()) >= 50:
            return file_ext, text_content

        # Try PyPDF2 first, but fall back to pdfplumber on ANY failure (PyPDF2 can throw UnicodeDecodeError on some PDFs)
        py_pdf2_error = None
        try:
            import PyPDF2
            from io import BytesIO
            
            pdf_file = BytesIO(content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            text_content = ""
            
            for page_num, page in enumerate(pdf_reader.pages):
                text_content += f"\n--- Page {page_num + 1} ---\n"
                extracted = page.extract_text()
                if extracted:
                    text_content += extracted
            
            if not text_content.strip():
                raise HTTPException(status_code=400, detail="PDF appears to be empty or image-based. Could not extract text.")
        except Exception as e:
            py_pdf2_error = e
            # Fallback: try pdfplumber
            try:
                import pdfplumber
                from io import BytesIO
                
                pdf_file = BytesIO(content)
                text_content = ""
                
                with pdfplumber.open(pdf_file) as pdf:
                    for page_num, page in enumerate(pdf.pages):
                        text_content += f"\n--- Page {page_num + 1} ---\n"
                        page_text = page.extract_text()
                        if page_text:
                            text_content += page_text
                
                if not text_content.strip():
                    raise HTTPException(status_code=400, detail="PDF appears to be empty or image-based. Could not extract text.")
            except ImportError:
                raise HTTPException(
                    status_code=500,
                    detail="PDF support requires PyPDF2 or pdfplumber. Install with: pip install PyPDF2 pdfplumber"
                )
            except Exception as plumber_error:
                # If text extraction failed, try OCR (scanned/image PDFs)
                ocr_text = try_ocr_pdf_bytes(content)
                if ocr_text and len(ocr_text.strip()) >= 50:
                    return file_ext, ocr_text

                # If OCR didn't help, surface a helpful error
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Could not extract text from PDF (likely scanned/image-only or corrupted), and OCR also failed or returned empty.\n"
                        f"PyMuPDF error: {str(pymupdf_error)}; PyPDF2 error: {str(py_pdf2_error)}; pdfplumber error: {str(plumber_error)}\n"
                        "Fix: upload the original XLSX/CSV, or OCR/export a searchable PDF."
                    )
                )
    elif file_ext in ['csv', 'txt', 'json']:
        # Regular text files (CSV, TXT, JSON)
        try:
            text_content = content.decode('utf-8')
        except UnicodeDecodeError:
            # Try other encodings
            try:
                text_content = content.decode('latin-1')
            except:
                raise HTTPException(status_code=400, detail="Could not decode file. Please ensure it's a text-based file (CSV, TXT, JSON).")
    else:
        # Unsupported format - explicitly prevent binary files from being decoded as text
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format: {file_ext or 'unknown'}. Supported formats: CSV, TXT, JSON, PDF, XLSX, XLS. If you uploaded an Excel file, make sure openpyxl (for XLSX) or xlrd (for XLS) is installed: pip install openpyxl xlrd"
        )
    
    # Ensure text_content is set before creating request
    if text_content is None:
        raise HTTPException(status_code=500, detail="Internal error: text_content was not set during file processing.")
    
    return file_ext, text_content

@app.get("/")
async def root():
    return {
        "message": "Ollama Data Converter API",
        "version": "1.0.0",
        "endpoints": {
            "/convert": "POST - Convert unstructured data",
            "/health": "GET - Health check",
            "/models": "GET - List available Ollama models"
        }
    }

@app.get("/health")
async def health_check():
    """Check which converter provider is available"""
    if ANTHROPIC_API_KEY:
        return {
            "status": "healthy",
            "available": True,
            "provider": "claude",
            "models": [ANTHROPIC_MODEL],
            "error": None,
        }
    if CONVERTER_PROVIDER == "claude":
        return {
            "status": "unhealthy",
            "available": False,
            "provider": "claude",
            "models": [ANTHROPIC_MODEL],
            "error": "ANTHROPIC_API_KEY not set",
        }

    try:
        model_list = await fetch_ollama_model_names()
        return {
            "status": "healthy",
            "available": True,
            "provider": "ollama",
            "models": model_list,
            "ollama_host": OLLAMA_HOST,
            "preferred_model": PREFERRED_OLLAMA_MODEL,
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "available": False,
            "provider": "ollama",
            "error": str(e),
            "ollama_host": OLLAMA_HOST,
            "preferred_model": PREFERRED_OLLAMA_MODEL,
        }

@app.get("/models")
async def list_models():
    """List available Ollama models"""
    try:
        model_names = await fetch_ollama_model_names()
        return {
            "models": [{"name": n} for n in model_names],
            "ollama_host": OLLAMA_HOST,
            "preferred_model": PREFERRED_OLLAMA_MODEL,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}")

def try_direct_csv_parse(text_data: str, data_type: Optional[str]) -> Optional[ConversionResponse]:
    """
    Try to parse CSV directly without Ollama if headers are clear.
    Returns ConversionResponse if successful, None if uncertain.
    """
    def normalize_header(value: str) -> str:
        if not value:
            return ""
        lowered = value.lower()
        lowered = re.sub(r'\[.*?\]', ' ', lowered)
        lowered = re.sub(r'[^a-z0-9\s]', ' ', lowered)
        lowered = re.sub(r'\s+', ' ', lowered).strip()
        return lowered

    try:
        # Parse rows with csv.reader to detect header row even if file starts with blank lines
        raw_rows = list(csv.reader(StringIO(text_data)))
        if not raw_rows:
            return None

        header_idx = None
        normalized_rows = []
        for idx, row in enumerate(raw_rows):
            normalized = [normalize_header(cell) for cell in row]
            normalized_rows.append(normalized)
            if not any(normalized):
                continue
            # Look for known header signals
            if (
                ("investor name" in normalized or "firm name" in normalized) and
                any("team member" in h or "member" == h for h in normalized)
            ):
                header_idx = idx
                break
            if ("company name" in normalized and any("funding" in h or "stage" == h for h in normalized)):
                header_idx = idx
                break
            if ("full name" in normalized and "email" in normalized):
                header_idx = idx
                break
            if (("contact name" in normalized or "contact" in normalized) and ("firm name" in normalized or "company name" in normalized)):
                header_idx = idx
                break

        if header_idx is None:
            # Fallback to DictReader using first line as headers
            reader = csv.DictReader(StringIO(text_data))
            rows = list(reader)
        else:
            header = raw_rows[header_idx]
            data_rows = raw_rows[header_idx + 1 :]
            rows = []
            for row in data_rows:
                if not any(cell.strip() for cell in row if isinstance(cell, str)) and not any(row):
                    continue
                record = {header[i]: (row[i] if i < len(row) else "") for i in range(len(header))}
                rows.append(record)

        if not rows:
            return None

        # Check first row to determine type
        first_row = rows[0]
        headers_lower = {normalize_header(k): k for k in first_row.keys() if k}
        
        print(f"[DEBUG] CSV Headers detected: {list(headers_lower.keys())}")
        
        # Detect type based on headers
        has_mentor_headers = any(h in headers_lower for h in ['full name', 'fullname']) and any(h in headers_lower for h in ['email'])
        has_corporate_headers = any(h in headers_lower for h in ['contact name', 'contactname']) and any(h in headers_lower for h in ['firm name', 'firmname', 'company name', 'companyname'])
        has_investor_headers = any(h in headers_lower for h in ['investor name', 'firm name', 'firmname']) and any(h in headers_lower for h in ['member name', 'membername', 'team member'])
        has_startup_headers = any(h in headers_lower for h in ['company name', 'companyname']) and any(h in headers_lower for h in ['funding', 'stage'])
        
        print(f"[DEBUG] Mentor headers: {has_mentor_headers}, Corporate: {has_corporate_headers}, Investor: {has_investor_headers}, Startup: {has_startup_headers}")
        
        startups = []
        investors = []
        mentors = []
        corporates = []
        warnings = []
        
        if has_mentor_headers:
            for row in rows:
                try:
                    mentor = normalize_mentor_data(row)
                    if mentor.fullName and mentor.email:
                        mentors.append(mentor)
                except Exception as e:
                    warnings.append(f"Error parsing mentor row: {str(e)}")
            
            if mentors:
                return ConversionResponse(
                    startups=[],
                    investors=[],
                    mentors=mentors,
                    corporates=[],
                    detectedType="mentor",
                    confidence=0.95,
                    warnings=warnings,
                    errors=[]
                )
        
        elif has_corporate_headers:
            for row in rows:
                try:
                    corp = normalize_corporate_data(row)
                    if corp.firmName and corp.contactName:
                        corporates.append(corp)
                except Exception as e:
                    warnings.append(f"Error parsing corporate row: {str(e)}")
            
            if corporates:
                return ConversionResponse(
                    startups=[],
                    investors=[],
                    mentors=[],
                    corporates=corporates,
                    detectedType="corporate",
                    confidence=0.95,
                    warnings=warnings,
                    errors=[]
                )
        
        elif has_investor_headers:
            for row in rows:
                try:
                    inv = normalize_investor_data(row)
                    if inv.firmName:
                        if not inv.memberName:
                            inv.memberName = "UNKNOWN"
                        investors.append(inv)
                except Exception as e:
                    warnings.append(f"Error parsing investor row: {str(e)}")
            
            if investors:
                return ConversionResponse(
                    startups=[],
                    investors=investors,
                    mentors=[],
                    corporates=[],
                    detectedType="investor",
                    confidence=0.95,
                    warnings=warnings,
                    errors=[]
                )
        
        elif has_startup_headers:
            for row in rows:
                try:
                    startup = normalize_startup_data(row)
                    if startup.companyName:
                        startups.append(startup)
                except Exception as e:
                    warnings.append(f"Error parsing startup row: {str(e)}")
            
            if startups:
                return ConversionResponse(
                    startups=startups,
                    investors=[],
                    mentors=[],
                    corporates=[],
                    detectedType="startup",
                    confidence=0.95,
                    warnings=warnings,
                    errors=[]
                )
        
        # If we couldn't determine type or no data, return None to fall back to Ollama
        return None
        
    except Exception as e:
        print(f"Direct CSV parse exception: {e}")
        return None

@app.post("/convert", response_model=ConversionResponse)
async def convert_data(request: ConversionRequest):
    """
    Convert unstructured data to structured format using Ollama
    """
    # Try direct CSV parsing first if format is CSV
    if request.format == 'csv':
        try:
            direct_result = try_direct_csv_parse(request.data, request.dataType)
            if direct_result:
                return direct_result
        except Exception as e:
            # If direct CSV parsing fails, fall through to Ollama
            print(f"Direct CSV parse failed, falling back to Ollama: {e}")
    
    try:
        # Create prompt
        prompt = create_conversion_prompt(request.data, request.dataType)

        # Decide which provider to use
        use_claude = ANTHROPIC_API_KEY is not None and ANTHROPIC_API_KEY.strip() != ""
        if CONVERTER_PROVIDER == "claude" or use_claude:
            response_text = await call_anthropic(prompt)
            try:
                parsed_data = parse_ollama_response(response_text)
            except Exception:
                retry_prompt = (
                    "Return ONLY valid JSON. Do not include markdown or explanations. "
                    "Restart the JSON from scratch and ensure all brackets are closed.\n\n"
                    + create_conversion_prompt(request.data, request.dataType)
                )
                retry_text = await call_anthropic(retry_prompt)
                parsed_data = parse_ollama_response(retry_text)
        else:
            # Check models via HTTP API (more reliable than python ollama.list on some setups)
            try:
                available_models = await fetch_ollama_model_names()
            except Exception as e:
                raise HTTPException(
                    status_code=503,
                    detail=f"Ollama not reachable at {OLLAMA_HOST}. Error: {str(e)}"
                )

            if not available_models:
                # Final fallback: attempt python client list directly
                try:
                    client = get_ollama_client()
                    models = client.list()
                    if isinstance(models, dict):
                        for m in models.get("models", []) or []:
                            name = None
                            if isinstance(m, dict) and m.get("name"):
                                name = m["name"]
                            elif isinstance(m, str):
                                name = m
                            if name:
                                available_models.append(name)
                except Exception:
                    pass

            if not available_models:
                raise HTTPException(
                    status_code=503,
                    detail=f"No Ollama models available at {OLLAMA_HOST}. Run: ollama pull llama3.1"
                )

            model_name = pick_model(available_models)

            # Call Ollama
            client = get_ollama_client()
            # Prefer JSON mode if supported by the client/version, otherwise fall back.
            chat_kwargs = dict(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                options={
                    "temperature": 0.1,  # Low temperature for consistent extraction
                    "num_predict": 4096,  # More headroom to avoid truncated JSON
                },
            )
            try:
                response = client.chat(**chat_kwargs, format="json")
            except TypeError:
                response = client.chat(**chat_kwargs)

            # Extract response content
            response_text = response.get('message', {}).get('content')
            if not isinstance(response_text, str):
                raise HTTPException(status_code=502, detail="Ollama returned empty content. Ensure the model is available and retry.")

            # Parse JSON from response (retry once if model output is truncated/non-JSON)
            try:
                parsed_data = parse_ollama_response(response_text)
            except Exception:
                # Retry with a stricter prompt and higher output budget
                retry_prompt = (
                    "Return ONLY valid JSON. Do not include markdown or explanations. "
                    "Restart the JSON from scratch and ensure all brackets are closed.\n\n"
                    + create_conversion_prompt(request.data, request.dataType)
                )
                retry_kwargs = dict(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": retry_prompt},
                    ],
                    options={
                        "temperature": 0.0,
                        "num_predict": 8192,
                    },
                )
                try:
                    retry_res = client.chat(**retry_kwargs, format="json")
                except TypeError:
                    retry_res = client.chat(**retry_kwargs)
                retry_text = retry_res.get("message", {}).get("content")
                if not isinstance(retry_text, str):
                    raise HTTPException(status_code=502, detail="Ollama returned empty content on retry.")
                parsed_data = parse_ollama_response(retry_text)
        
        # If the model returns a wrapper object (common), unwrap it.
        # Supported shapes:
        # - { startups: [...], investors: [...] }
        # - { data: [...] }
        # - { detectedType: "...", investors: [...] } etc.
        if isinstance(parsed_data, dict):
            wrapper = parsed_data

            # Direct "data" wrapper
            if isinstance(wrapper.get("data"), list):
                parsed_data = wrapper["data"]
            # Direct "startups"/"investors" wrapper: bypass generic detection loop
            elif isinstance(wrapper.get("startups"), (list, dict)) or isinstance(wrapper.get("investors"), (list, dict)):
                startups = []
                investors = []
                mentors = []
                corporates = []
                warnings = []
                errors = []

                def ensure_list(v: Any) -> List[Any]:
                    if v is None:
                        return []
                    if isinstance(v, list):
                        return v
                    return [v]

                for item in ensure_list(wrapper.get("startups")):
                    if isinstance(item, dict):
                        try:
                            s = normalize_startup_data(item)
                            if s.companyName:
                                startups.append(s)
                        except Exception as e:
                            errors.append(f"Error processing startup item: {str(e)}")

                for item in ensure_list(wrapper.get("investors")):
                    if isinstance(item, dict):
                        try:
                            inv = normalize_investor_data(item)
                            if inv.firmName:
                                if not inv.memberName:
                                    inv.memberName = "UNKNOWN"
                                    warnings.append(
                                        f"Investor missing memberName; using placeholder 'UNKNOWN' for firm '{inv.firmName}'."
                                    )
                                investors.append(inv)
                        except Exception as e:
                            errors.append(f"Error processing investor item: {str(e)}")

                for item in ensure_list(wrapper.get("mentors")):
                    if isinstance(item, dict):
                        try:
                            mentor = normalize_mentor_data(item)
                            if mentor.fullName and mentor.email:
                                mentors.append(mentor)
                        except Exception as e:
                            errors.append(f"Error processing mentor item: {str(e)}")

                for item in ensure_list(wrapper.get("corporates")):
                    if isinstance(item, dict):
                        try:
                            corp = normalize_corporate_data(item)
                            if corp.firmName and corp.contactName:
                                corporates.append(corp)
                        except Exception as e:
                            errors.append(f"Error processing corporate item: {str(e)}")

                # Determine detected type
                types_found = []
                if startups:
                    types_found.append("startup")
                if investors:
                    types_found.append("investor")
                if mentors:
                    types_found.append("mentor")
                if corporates:
                    types_found.append("corporate")
                
                detected_type = "+".join(types_found) if types_found else "unknown"
                
                if not (startups or investors or mentors or corporates):
                    errors.append("No valid data extracted. Please check the input format and column names.")

                return ConversionResponse(
                    startups=startups,
                    investors=investors,
                    mentors=mentors,
                    corporates=corporates,
                    detectedType=detected_type,
                    confidence=0.8 if (startups or investors) else 0.0,
                    warnings=warnings,
                    errors=errors,
                )

            # Fallback: treat wrapper as a single item
            else:
                parsed_data = [wrapper]
        # Normalize to list if single object
        elif isinstance(parsed_data, dict):
            parsed_data = [parsed_data]
        
        # Convert to structured format
        startups = []
        investors = []
        mentors = []
        corporates = []
        warnings = []
        errors = []
        detected_type = request.dataType or "unknown"
        
        for item in parsed_data:
            # Skip non-dict items to avoid type errors
            if not isinstance(item, dict):
                warnings.append(f"Skipping non-dict item: {item}")
                continue
            try:
                # Auto-detect type if not specified
                if not request.dataType:
                    has_startup_fields = any(k in item for k in ['companyName', 'fundingTarget', 'fundingStage'])
                    has_investor_fields = any(k in item for k in ['firmName', 'minTicketSize', 'maxTicketSize', 'memberName'])
                    has_mentor_fields = any(k in item for k in ['fullName', 'Full Name', 'expertiseAreas', 'Expertise Areas']) and any(k in item for k in ['email', 'Email'])
                    has_corporate_fields = any(k in item for k in ['contactName', 'Contact Name', 'partnershipTypes', 'Partnership Types'])
                    
                    if has_mentor_fields:
                        detected_type = "mentor"
                    elif has_corporate_fields:
                        detected_type = "corporate"
                    elif has_startup_fields and not has_investor_fields:
                        detected_type = "startup"
                    elif has_investor_fields and not has_startup_fields:
                        detected_type = "investor"
                    elif has_startup_fields and has_investor_fields:
                        # Ambiguous - check more indicators
                        if 'companyName' in item and 'fundingTarget' in item:
                            detected_type = "startup"
                        else:
                            detected_type = "investor"
                
                # Convert based on detected type
                if detected_type == "startup" or (not request.dataType and 'companyName' in item):
                    startup = normalize_startup_data(item)
                    if startup.companyName:
                        startups.append(startup)
                elif detected_type == "mentor" or (not request.dataType and any(k in item for k in ['fullName', 'Full Name'])):
                    mentor = normalize_mentor_data(item)
                    if mentor.fullName and mentor.email:
                        mentors.append(mentor)
                    elif mentor.fullName:
                        warnings.append(f"Mentor '{mentor.fullName}' missing email, skipping")
                elif detected_type == "corporate" or (not request.dataType and any(k in item for k in ['contactName', 'Contact Name'])):
                    corporate = normalize_corporate_data(item)
                    if corporate.firmName and corporate.contactName:
                        corporates.append(corporate)
                    elif corporate.firmName:
                        warnings.append(f"Corporate '{corporate.firmName}' missing contact name, skipping")
                elif detected_type == "investor" or (not request.dataType and 'firmName' in item):
                    investor = normalize_investor_data(item)
                    if investor.firmName:
                        # Some sources (esp. PDFs) list only firm names without a specific person.
                        # Don't hard-fail the whole conversion; fill a placeholder and warn.
                        if not investor.memberName:
                            investor.memberName = "UNKNOWN"
                            warnings.append(
                                f"Investor missing memberName; using placeholder 'UNKNOWN' for firm '{investor.firmName}'."
                            )
                        investors.append(investor)
                else:
                    warnings.append(f"Could not determine type for item: {item}")
            except Exception as e:
                errors.append(f"Error processing item: {str(e)}")
        
        if not (startups or investors or mentors or corporates):
            errors.append("No valid data extracted. Please check the input format and column names.")
        
        return ConversionResponse(
            startups=startups,
            investors=investors,
            mentors=mentors,
            corporates=corporates,
            detectedType=detected_type,
            confidence=0.8 if (startups or investors) else 0.0,
            warnings=warnings,
            errors=errors
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

def validate_structured_rows(
    startups: List[StartupData], 
    investors: List[InvestorData],
    mentors: List[MentorData] = None,
    corporates: List[CorporateData] = None
) -> List[str]:
    """
    Row-level validation with explicit row numbers and missing fields.
    """
    errors: List[str] = []

    for idx, s in enumerate(startups, start=1):
        missing = []
        if not s.companyName:
            missing.append("companyName")
        # NOTE: We intentionally do NOT hard-require every field here.
        # Many PDFs / unstructured sources omit fields like stage/geo/ticket size.
        # The UI supports editing later; blocking imports is worse UX.
        if missing:
            errors.append(f"Startup row {idx}: missing {', '.join(missing)}")

    for idx, inv in enumerate(investors, start=1):
        missing = []
        if not inv.firmName:
            missing.append("firmName")
        if not inv.memberName:
            missing.append("memberName")
        # Do not require geoFocus/industryPreferences/stagePreferences/ticket sizes here.
        if missing:
            errors.append(f"Investor row {idx}: missing {', '.join(missing)}")

    for idx, mentor in enumerate(mentors or [], start=1):
        missing = []
        if not mentor.fullName:
            missing.append("fullName")
        if not mentor.email:
            missing.append("email")
        if missing:
            errors.append(f"Mentor row {idx}: missing {', '.join(missing)}")

    for idx, corp in enumerate(corporates or [], start=1):
        missing = []
        if not corp.firmName:
            missing.append("firmName")
        if not corp.contactName:
            missing.append("contactName")
        if missing:
            errors.append(f"Corporate row {idx}: missing {', '.join(missing)}")

    return errors

def build_startup_csv(startups: List[StartupData]) -> str:
    headers = ["company_name", "geo_markets", "industry", "funding_target", "funding_stage"]
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    for s in startups:
        writer.writerow({
            "company_name": s.companyName or "",
            "geo_markets": "; ".join(s.geoMarkets) if s.geoMarkets else "",
            "industry": s.industry or "",
            "funding_target": s.fundingTarget if s.fundingTarget is not None else "",
            "funding_stage": s.fundingStage or "",
        })
    return output.getvalue()

def build_investor_csv(investors: List[InvestorData]) -> str:
    headers = [
        "firm_name",
        "investment_member",
        "geo_focus",
        "industry_preferences",
        "min_ticket_size",
        "max_ticket_size",
        "total_slots",
        "table_number",
    ]
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    for inv in investors:
        writer.writerow({
            "firm_name": inv.firmName or "",
            "investment_member": inv.memberName or "",
            "geo_focus": "; ".join(inv.geoFocus) if inv.geoFocus else "",
            "industry_preferences": "; ".join(inv.industryPreferences) if inv.industryPreferences else "",
            "min_ticket_size": inv.minTicketSize if inv.minTicketSize is not None else "",
            "max_ticket_size": inv.maxTicketSize if inv.maxTicketSize is not None else "",
            "total_slots": inv.totalSlots if inv.totalSlots is not None else "",
            "table_number": inv.tableNumber or "",
        })
    return output.getvalue()

@app.post("/convert-file")
async def convert_file(file: UploadFile = File(...), dataType: Optional[str] = None):
    """Convert uploaded file (CSV, text, PDF, etc.)"""
    try:
        file_ext, text_content = await extract_text_content(file)
        request = ConversionRequest(
            data=text_content,
            dataType=dataType,
            format=file_ext
        )
        conversion_result = await convert_data(request)

        # Validate critical identifiers, but don't hard-fail if optional fields are missing.
        row_errors = validate_structured_rows(
            conversion_result.startups, 
            conversion_result.investors,
            conversion_result.mentors,
            conversion_result.corporates
        )

        # Block only if nothing was extracted
        has_any_data = (
            conversion_result.startups or 
            conversion_result.investors or 
            conversion_result.mentors or 
            conversion_result.corporates
        )
        if not has_any_data:
            # Return a 200 with errors so the frontend can show a meaningful message
            # (instead of a generic HTTP failure that hides conversion_result.errors).
            conversion_result.errors = (conversion_result.errors or []) + [
                "No valid data extracted. Please check the input format and column names. Expected columns for Investors: firmName, memberName, geoFocus, industryPreferences, stagePreferences. For Mentors: fullName, email, geoFocus. For Corporates: firmName, contactName, geoFocus, partnershipTypes."
            ]
            return conversion_result

        # Surface missing critical fields as warnings so users can import and edit in the UI.
        if row_errors:
            conversion_result.warnings = (conversion_result.warnings or []) + row_errors

        return conversion_result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File conversion failed: {str(e)}")

def parse_google_drive_url(url: str) -> Tuple[str, str]:
    patterns = [
        ("document", r"https?://docs\.google\.com/document/d/([^/]+)"),
        ("presentation", r"https?://docs\.google\.com/presentation/d/([^/]+)"),
        ("spreadsheet", r"https?://docs\.google\.com/spreadsheets/d/([^/]+)"),
        ("drive", r"https?://drive\.google\.com/file/d/([^/]+)"),
    ]
    for kind, pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return kind, match.group(1)
    # Alternate Drive URL pattern: open?id=FILE_ID
    match = re.search(r"[?&]id=([^&]+)", url)
    if match:
        return "drive", match.group(1)
    raise HTTPException(status_code=400, detail="Unsupported Google Drive URL format.")

@app.post("/ingest/clickup", response_model=ClickUpIngestResponse)
async def ingest_clickup(request: ClickUpIngestRequest):
    if not CLICKUP_API_TOKEN:
        raise HTTPException(status_code=503, detail="CLICKUP_API_TOKEN not set on the server.")

    list_id = request.list_id.strip()
    if not list_id:
        raise HTTPException(status_code=400, detail="list_id is required.")

    url = f"https://api.clickup.com/api/v2/list/{list_id}/task"
    params = {"include_closed": "true" if request.include_closed else "false"}
    headers = {"Authorization": CLICKUP_API_TOKEN}

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(url, headers=headers, params=params)
        if res.status_code >= 400:
            raise HTTPException(status_code=res.status_code, detail=res.text[:400])
        data = res.json()

    tasks = []
    for task in data.get("tasks", []):
        assignees = [a.get("username") for a in (task.get("assignees") or []) if a.get("username")]
        tasks.append({
            "id": task.get("id"),
            "name": task.get("name"),
            "url": task.get("url"),
            "status": (task.get("status") or {}).get("status"),
            "assignees": assignees,
            "description": task.get("description"),
        })

    return ClickUpIngestResponse(tasks=tasks)

@app.post("/ingest/clickup/lists", response_model=ClickUpListsResponse)
async def list_clickup_lists(request: ClickUpListsRequest):
    if not CLICKUP_API_TOKEN:
        raise HTTPException(status_code=503, detail="CLICKUP_API_TOKEN not set on the server.")

    team_id = request.team_id.strip()
    if not team_id:
        raise HTTPException(status_code=400, detail="team_id is required.")

    url = f"https://api.clickup.com/api/v2/team/{team_id}/list"
    headers = {"Authorization": CLICKUP_API_TOKEN}

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(url, headers=headers, params={"archived": "false"})
        if res.status_code >= 400:
            raise HTTPException(status_code=res.status_code, detail=res.text[:400])
        data = res.json()

    lists = []
    for item in data.get("lists", []):
        lists.append({
            "id": item.get("id"),
            "name": item.get("name"),
        })

    return ClickUpListsResponse(lists=lists)

@app.post("/ask", response_model=AskResponse)
async def ask_fund(request: AskRequest):
    question = (request.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required.")

    prompt = build_answer_prompt(question, request.sources, request.decisions)
    answer = await call_anthropic_answer(prompt)
    return AskResponse(answer=answer)

@app.post("/embed/query", response_model=EmbedResponse)
async def embed_query(request: EmbedRequest):
    text = (request.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required.")

    if EMBEDDINGS_PROVIDER != "ollama":
        raise HTTPException(status_code=503, detail="EMBEDDINGS_PROVIDER is not enabled.")

    try:
        response = ollama.embeddings(model=OLLAMA_EMBEDDING_MODEL, prompt=text)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama embedding failed: {str(e)}")

    embedding = response.get("embedding") if isinstance(response, dict) else None
    if not embedding:
        raise HTTPException(status_code=502, detail="No embedding returned.")
    return EmbedResponse(embedding=embedding)

@app.post("/ingest/google-drive", response_model=GoogleDriveIngestResponse)
async def ingest_google_drive(request: GoogleDriveIngestRequest):
    if not request.access_token:
        raise HTTPException(status_code=400, detail="Access token required for private Google Drive files.")
    
    kind, file_id = parse_google_drive_url(request.url.strip())
    
    if kind not in ["document", "presentation", "spreadsheet"]:
        raise HTTPException(status_code=400, detail="Drive file URLs require a Docs/Slides/Sheets link.")

    # Use Google Drive API v3 to download the file
    # For Google Docs/Sheets/Slides, we need to export them
    if kind == "document":
        # Export as plain text
        api_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/export?mimeType=text/plain"
        source_type = "notes"
    elif kind == "presentation":
        # Export as plain text
        api_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/export?mimeType=text/plain"
        source_type = "deck"
    elif kind == "spreadsheet":
        # Export as CSV
        api_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/export?mimeType=text/csv"
        source_type = "notes"
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    headers = {
        "Authorization": f"Bearer {request.access_token}",
        "Accept": "text/plain" if kind != "spreadsheet" else "text/csv"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(api_url, headers=headers)
        if res.status_code >= 400:
            error_detail = res.text[:500] if res.text else "No error details"
            raise HTTPException(
                status_code=res.status_code,
                detail=f"Google Drive API failed (status {res.status_code}): {error_detail}. Make sure you have Drive access and the file is accessible."
            )
        content = res.text
        
        # Log if content is empty
        if not content or len(content.strip()) == 0:
            print(f"WARNING: Google Drive API returned empty content for {file_id}. Status: {res.status_code}")
            content = f"[Empty content from Google Drive file: {file_id}]"

    title = f"{kind}-{file_id[:8]}"
    return GoogleDriveIngestResponse(title=title, content=content, raw_content=content, sourceType=source_type)

class ValidationRequest(BaseModel):
    data: str
    dataType: Optional[str] = None

class ValidationResponse(BaseModel):
    isValid: bool
    missingFields: Dict[str, List[str]]  # { "startups": ["geoMarkets"], "investors": ["minTicketSize"] }
    incompleteFields: Dict[str, List[str]]  # Fields that exist but are incomplete
    suggestions: List[str]  # Suggestions for what to add
    extractedData: Dict[str, Any]  # What was successfully extracted

@app.post("/validate-file", response_model=FileValidationResponse)
async def validate_file(file: UploadFile = File(...), dataType: Optional[str] = None):
    """
    Validate an uploaded file (any supported format) and return:
    - row-level errors with explicit row numbers
    - CSV templates with extracted rows prefilled and missing columns preserved
    """
    try:
        file_ext, text_content = await extract_text_content(file)
        conversion_request = ConversionRequest(
            data=text_content,
            dataType=dataType,
            format=file_ext
        )
        conversion_result = await convert_data(conversion_request)

        row_errors = validate_structured_rows(conversion_result.startups, conversion_result.investors)
        errors = (conversion_result.errors or []) + row_errors
        warnings = conversion_result.warnings or []

        startup_csv = build_startup_csv(conversion_result.startups) if conversion_result.startups else build_startup_csv([])
        investor_csv = build_investor_csv(conversion_result.investors) if conversion_result.investors else build_investor_csv([])

        return FileValidationResponse(
            isValid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            detectedType=conversion_result.detectedType,
            startupCsvTemplate=startup_csv,
            investorCsvTemplate=investor_csv,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File validation failed: {str(e)}")

@app.post("/validate", response_model=ValidationResponse)
async def validate_data(request: ValidationRequest):
    """
    Validate data and identify what's missing
    This is what the investment team needs - tells them what to add!
    """
    try:
        # First, try to convert the data
        conversion_request = ConversionRequest(
            data=request.data,
            dataType=request.dataType
        )
        conversion_result = await convert_data(conversion_request)
        
        missing_fields = {"startups": [], "investors": []}
        incomplete_fields = {"startups": [], "investors": []}
        suggestions = []
        
        # Check startups
        for startup in conversion_result.startups:
            startup_missing = []
            startup_incomplete = []
            
            if not startup.companyName or (isinstance(startup.companyName, str) and startup.companyName.strip() == ""):
                startup_missing.append("companyName")
            if not startup.geoMarkets or len(startup.geoMarkets) == 0:
                startup_missing.append("geoMarkets")
                suggestions.append(f"Add geographic markets for {startup.companyName}")
            if not startup.industry or (isinstance(startup.industry, str) and startup.industry.strip() == ""):
                startup_missing.append("industry")
            if not startup.fundingTarget or startup.fundingTarget == 0:
                startup_missing.append("fundingTarget")
                suggestions.append(f"Add funding target amount for {startup.companyName}")
            if not startup.fundingStage or (isinstance(startup.fundingStage, str) and startup.fundingStage.strip() == ""):
                startup_missing.append("fundingStage")
                suggestions.append(f"Add funding stage (Pre-seed, Seed, Series A, etc.) for {startup.companyName}")
            
            if startup_missing:
                missing_fields["startups"].extend(startup_missing)
        
        # Check investors
        for investor in conversion_result.investors:
            investor_missing = []
            investor_incomplete = []
            
            if not investor.firmName or (isinstance(investor.firmName, str) and investor.firmName.strip() == ""):
                investor_missing.append("firmName")
            if not investor.memberName or (isinstance(investor.memberName, str) and investor.memberName.strip() == ""):
                investor_missing.append("memberName")
                suggestions.append(f"Add investor member name (person) for {investor.firmName or 'this investor'}")
            if not investor.geoFocus or len(investor.geoFocus) == 0:
                investor_missing.append("geoFocus")
                suggestions.append(f"Add geographic focus for {investor.firmName}")
            if not investor.industryPreferences or len(investor.industryPreferences) == 0:
                investor_missing.append("industryPreferences")
                suggestions.append(f"Add industry preferences for {investor.firmName}")
            if not investor.stagePreferences or len(investor.stagePreferences) == 0:
                investor_missing.append("stagePreferences")
                suggestions.append(f"Add stage preferences (Seed, Series A, etc.) for {investor.firmName}")
            if not investor.minTicketSize or investor.minTicketSize == 0:
                investor_missing.append("minTicketSize")
                suggestions.append(f"Add minimum ticket size for {investor.firmName}")
            if not investor.maxTicketSize or investor.maxTicketSize == 0:
                investor_missing.append("maxTicketSize")
                suggestions.append(f"Add maximum ticket size for {investor.firmName}")
            if not investor.totalSlots or investor.totalSlots == 0:
                investor_missing.append("totalSlots")
                suggestions.append(f"Add number of meeting slots for {investor.firmName}")
            
            if investor_missing:
                missing_fields["investors"].extend(investor_missing)
        
        # Remove duplicates
        missing_fields["startups"] = list(set(missing_fields["startups"]))
        missing_fields["investors"] = list(set(missing_fields["investors"]))
        
        is_valid = (
            len(missing_fields["startups"]) == 0 and
            len(missing_fields["investors"]) == 0 and
            len(conversion_result.errors) == 0
        )
        
        return ValidationResponse(
            isValid=is_valid,
            missingFields=missing_fields,
            incompleteFields=incomplete_fields,
            suggestions=suggestions,
            extractedData={
                "startups": [s.dict() for s in conversion_result.startups],
                "investors": [i.dict() for i in conversion_result.investors],
                "detectedType": conversion_result.detectedType,
                "confidence": conversion_result.confidence
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", os.environ.get("OLLAMA_CONVERTER_PORT", "8000")))
    uvicorn.run(app, host="0.0.0.0", port=port)

