FROM python:3.12-slim

WORKDIR /app

# System dependencies: libmagic for file type detection
# Note: Tesseract/Poppler no longer needed — Claude-native PDF ingestion
RUN apt-get update && apt-get install -y \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Render/Railway will set PORT env var)
EXPOSE 10000

# Run with uvloop + httptools for maximum performance
CMD ["python", "main.py"]

