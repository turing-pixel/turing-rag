FROM python:3.11-slim

WORKDIR /app

# Tencent Cloud mirrors: Debian apt + PyPI
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g; s|security.debian.org|mirrors.cloud.tencent.com|g' \
    /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g; s|security.debian.org|mirrors.cloud.tencent.com|g' \
    /etc/apt/sources.list 2>/dev/null || true

ENV PIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
ENV PIP_TRUSTED_HOST=mirrors.cloud.tencent.com

RUN apt-get update && apt-get install -y \
  build-essential \
  default-libmysqlclient-dev \
  pkg-config \
  netcat-traditional \
  curl \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

COPY . .

RUN mkdir -p uploads

ENV PYTHONPATH=/app
ENV ENVIRONMENT=production

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
