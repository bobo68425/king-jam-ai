# Use an official PyTorch runtime as a parent image
# L4 supports CUDA 12
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Set the working directory
WORKDIR /app

# Install system dependencies including ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg libsm6 libxext6 wget curl git && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the Hugging Face models so they are baked into the Docker image
# This is crucial for fast Cloud Run scale-to-zero cold starts.
RUN python -c "from huggingface_hub import snapshot_download; \
    snapshot_download(repo_id='Lightricks/LTX-Video');"

# Copy the rest of the application code
COPY . .

# Expose the API port
EXPOSE 8080

# Run uvicorn server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
