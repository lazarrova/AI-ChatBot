# main.py
import os
import re
from typing import List, Optional
from fastapi import HTTPException


import httpx
import re,html
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

# --- config ---
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("Missing OPENAI_API_KEY in .env")

client = OpenAI(api_key=api_key)

origins = [o.strip() for o in (os.getenv("ALLOWED_ORIGINS") or "").split(",") if o.strip()] or ["http://localhost:5173"]

app = FastAPI(title="Lazarova AI FastAPI - Minimal")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- schemas ---
class Msg(BaseModel):
    role: str
    content: str

class ChatPayload(BaseModel):
    messages: List[Msg]
    system: Optional[str] = "You are a helpful assistant."
    model: Optional[str] = "gpt-4o-mini"

class SummarizePayload(BaseModel):
    text: str

class SentimentPayload(BaseModel):
    text: str

class QuestionPayload(BaseModel):
    question: str


# --- health ---
@app.get("/")
def root():
    return {"ok": True, "service": "Lazarova AI FastAPI"}

# --- 1) CHAT ---
@app.post("/chat")
def chat(payload: ChatPayload):
    """
    Безбеден чат: фронтенд праќа пораки -> бекенд повикува OpenAI -> враќа одговор.
    """
    messages = [{"role": "system", "content": payload.system}]
    messages += [{"role": m.role, "content": m.content} for m in payload.messages[-8:]]

    try:
        resp = client.chat.completions.create(
            model=payload.model,
            messages=messages
        )
        content = resp.choices[0].message.content.strip()
        return {"message": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {e}")

# --- 2) SUMMARIZE ---
@app.post("/summarize")
def summarize(p: SummarizePayload):
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role":"system","content":"Summarize texts clearly and concisely."},
                {"role":"user","content":p.text}
            ]
        )
        summary = resp.choices[0].message.content.strip()
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {e}")

# --- 3) SENTIMENT ---
@app.post("/sentiment")
def sentiment(p: SentimentPayload):
    """
    Враќа label: positive / neutral / negative + кратко образложение.
    """
    prompt = (
            "Classify the sentiment of the following text as Positive, Neutral, or Negative. "
            "Return JSON with keys: label and explanation.\n\nText:\n" + p.text
    )
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role":"user","content":prompt}],
            temperature=0.2
        )
        text = resp.choices[0].message.content.strip()
        return {"result": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {e}")

#--WIKIPEDIA--

@app.get("/wiki")
async def wiki(q: str):
    hit = await wiki_search(q)
    if not hit:
        raise HTTPException(status_code=404, detail="No Wikipedia results")
    summary = await wiki_summary(hit["title"])
    if not summary:
        raise HTTPException(status_code=404, detail="No summary for top result")
    return {
        "title": summary["title"],
        "snippet": hit["snippet"],
        "summary": summary["extract"],
        "url": summary["url"],
        "source": "wikipedia",
    }

#mini RAG
@app.post("/answer_enriched")
async def answer_enriched(p: QuestionPayload):
    try:
        ext = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Return ONLY the main topic as a Wikipedia page title. No quotes. If unclear, return UNKNOWN."},
                {"role": "user", "content": p.question[:500]},
            ],
            temperature=0.2, max_tokens=24,
        )
        topic = (ext.choices[0].message.content or "").strip()
        if not topic or topic.upper() == "UNKNOWN":
            topic = p.question
    except Exception:
        topic = p.question

    # 2) wikipedia
    hit = await wiki_search(topic)
    if not hit:
        raise HTTPException(status_code=404, detail="No Wikipedia results")
    summary = await wiki_summary(hit["title"])
    if not summary:
        raise HTTPException(status_code=404, detail="No summary for top result")

    context = f"TITLE: {summary['title']}\nSUMMARY: {summary['extract']}\nURL: {summary['url']}"

    # 3) финален одговор со цитат
    try:
        final = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Use the provided context faithfully and cite the title inline once."},
                {"role": "user", "content": f"User question: {p.question}\n\nContext:\n{context}\n\nAnswer briefly and accurately."},
            ],
            temperature=0.3,
        )
        answer = final.choices[0].message.content.strip()
        return {"answer": answer, "cited_title": summary["title"], "url": summary["url"], "source": "wikipedia+openai"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {e}")



def strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", html.unescape(s or ""))

async def wiki_search(term: str):
    url = "https://en.wikipedia.org/w/api.php"
    params = {"action": "query", "list": "search", "srsearch": term, "format": "json", "origin": "*"}
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(url, params=params)
        r.raise_for_status()
        data = r.json()
    res = data.get("query", {}).get("search", [])
    if not res:
        return None
    top = res[0]
    return {"title": top["title"], "snippet": strip_html(top.get("snippet", ""))}

async def wiki_summary(title: str):
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(url)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        data = r.json()
    return {
        "title": data.get("title"),
        "extract": data.get("extract") or "",
        "url": data.get("content_urls", {}).get("desktop", {}).get("page"),
    }

