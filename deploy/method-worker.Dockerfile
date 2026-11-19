ARG PYTHON_IMAGE=python:3.12-slim-bookworm
FROM ${PYTHON_IMAGE}
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 RESEARCH_METHODS_WORKER_HOST=0.0.0.0 RESEARCH_METHODS_WORKER_PORT=8210 RESEARCH_METHODS_WORKER_MAX_BODY_BYTES=65536
RUN groupadd -r app && useradd -r -g app -d /home/app app && mkdir -p /app /home/app && chown -R app:app /app /home/app
WORKDIR /app
COPY --chown=app:app schema ./schema
COPY --chown=app:app serve.py statistical_power.py data_quality.py descriptive_statistics.py worker-manifest.json ./
USER app
EXPOSE 8210
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8210/ready')"
CMD ["python", "serve.py"]
