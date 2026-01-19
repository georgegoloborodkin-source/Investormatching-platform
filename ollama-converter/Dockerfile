FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PDF/OCR processing
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    poppler-utils \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Render will set PORT env var)
EXPOSE 10000

# Run the app
CMD ["python", "main.py"]

