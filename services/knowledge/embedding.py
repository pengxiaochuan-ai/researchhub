"""
kb-embed · 自托管中文 embedding 微服务（ADR-0003）。
🔴 红线：完全本机运行，向量化数据不外发（不接 Anthropic、不出机器）。
模型 BAAI/bge-small-zh-v1.5（MIT 可商用，512 维，中文检索强，ONNX 经 fastembed 跑，无需 torch）。
NestJS 后端 POST /embed {texts, is_query?} → {embeddings:[[...512]]}。失败上层回落关键词检索。
"""
import os
from typing import List, Optional

from fastapi import FastAPI
from pydantic import BaseModel

MODEL = os.environ.get("KB_EMBED_MODEL", "BAAI/bge-small-zh-v1.5")
# bge-zh：查询侧加检索指令可提召回（文档侧不加）。
QUERY_INSTRUCTION = "为这个句子生成表示以用于检索相关文章："

app = FastAPI(title="kb-embed")
_model = None


def get_model():
    global _model
    if _model is None:
        from fastembed import TextEmbedding
        _model = TextEmbedding(model_name=MODEL)
    return _model


class EmbedReq(BaseModel):
    texts: List[str]
    is_query: Optional[bool] = False


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL, "dim": 512}


@app.post("/embed")
def embed(req: EmbedReq):
    texts = req.texts or []
    if not texts:
        return {"embeddings": []}
    if req.is_query:
        texts = [QUERY_INSTRUCTION + t for t in texts]
    model = get_model()
    vecs = [v.tolist() for v in model.embed(texts)]
    return {"embeddings": vecs, "dim": len(vecs[0]) if vecs else 0}
