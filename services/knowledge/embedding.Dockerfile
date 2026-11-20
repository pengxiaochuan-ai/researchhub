ARG KNOWLEDGE_BASE_IMAGE
FROM ${KNOWLEDGE_BASE_IMAGE}
COPY --chown=app:app embedding.py run.py model.json verify_model.py /app/knowledge/
WORKDIR /app/knowledge
USER root
RUN python verify_model.py /tmp/fastembed_cache /opt/researchhub-model \
 && chown -R app:app /opt/researchhub-model
ENV PYTHONDONTWRITEBYTECODE=1 HF_HUB_OFFLINE=1 KB_EMBED_MODEL_PATH=/opt/researchhub-model
USER app
EXPOSE 8199
CMD ["python", "run.py", "embedding", "--host", "0.0.0.0", "--port", "8199"]
