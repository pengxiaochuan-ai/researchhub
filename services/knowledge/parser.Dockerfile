ARG KNOWLEDGE_BASE_IMAGE
FROM ${KNOWLEDGE_BASE_IMAGE}
COPY --chown=app:app parser.py run.py model.json verify_model.py /app/knowledge/
WORKDIR /app/knowledge
ENV PYTHONDONTWRITEBYTECODE=1 HF_HUB_OFFLINE=1
USER app
EXPOSE 8200
CMD ["python", "run.py", "parser", "--host", "0.0.0.0", "--port", "8200"]
