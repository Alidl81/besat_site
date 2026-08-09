# syntax=docker/dockerfile:1

ARG PYTHON_VERSION=3.12

FROM python:${PYTHON_VERSION}-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt ./
RUN python -m venv /opt/venv \
    && /opt/venv/bin/python -m pip install --upgrade pip \
    && /opt/venv/bin/python -m pip install -r requirements.txt

FROM python:${PYTHON_VERSION}-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}"

RUN addgroup --system --gid 10001 besat \
    && adduser --system --uid 10001 --ingroup besat --home /home/besat besat

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --chown=besat:besat . ./
RUN sed -i 's/\r$//' /app/entrypoint.sh \
    && chmod 0755 /app/entrypoint.sh \
    && mkdir -p /app/media /app/staticfiles \
    && chown -R besat:besat /app/media /app/staticfiles

USER besat

EXPOSE 8000

CMD ["sh", "/app/entrypoint.sh"]
