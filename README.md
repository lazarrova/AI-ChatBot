# 🤖 Lazarova AI Chatbot  (FastAPI + React)

A full-stack **AI Chatbot application** built with **FastAPI** (backend) and **React** (frontend).  
The project integrates **OpenAI GPT-4o-mini** for intelligent conversation and **Wikipedia API** for knowledge retrieval, creating a mini-RAG (Retrieval-Augmented Generation) system.

---

## 🌟 Features

- 🧠 **LLM-powered chat** using OpenAI GPT-4o-mini  
- 🔍 **Mini-RAG integration** (Wikipedia search + contextual LLM response)  
- 💬 Real-time conversation with message history  
- 🌓 Light / Dark mode toggle  
- 🧹 Clear chat & stop generation controls  
- 📑 REST API endpoints for:
  - `/chat` — standard conversation
  - `/summarize` — text summarization
  - `/sentiment` — sentiment classification
  - `/answer_enriched` — mini-RAG contextual Q&A with Wikipedia
- 🔒 Secure API key handling via `.env`

---

## 🧩 Tech Stack

| Layer | Technology | Purpose |
|--------|-------------|----------|
| **Frontend** | React + Vite + ChatScope UI | User interface, chat logic |
| **Backend** | FastAPI | API layer, connects with OpenAI & Wikipedia |
| **LLM** | OpenAI GPT-4o-mini | Core reasoning and text generation |
| **Data Source** | Wikipedia REST API | Contextual retrieval for RAG |
| **Styling** | CSS + Chat UI Kit | Modern chat interface |
| **Env Management** | dotenv | API key & CORS configuration |

---

## 🧠 How the Mini-RAG Works

Mini-RAG (Retrieval-Augmented Generation) enhances the chatbot with factual, real-world context:

1. The user sends a question (e.g. *“Who is Nikola Tesla?”*)  
2. Backend extracts the **main topic** using GPT-4o-mini (LLM extraction).  
3. Performs a **Wikipedia search** to find relevant articles.  
4. Fetches the article’s **summary** and sends it back to the LLM.  
5. GPT generates a **final, enriched answer** citing the Wikipedia source.

📈 This combines **retrieval (facts)** + **generation (reasoning)** = more accurate and explainable answers.


---

## 🧰 Project Structure

ai-chat-app/
│
├── backend/ # FastAPI service
│ ├── main.py # Core endpoints & logic
│ ├── .env # Contains your OPENAI_API_KEY
│ ├── requirements.txt
│ └── venv/ (optional)
│
├── frontend/ # React application
│ ├── src/App.jsx # Chat UI and logic
│ ├── package.json
│ ├── .env # Contains VITE_API_BASE (backend URL)
│ └── ...
│
└── README.md




## ⚙️ Installation & Setup

### 1️⃣ Clone the repository
```bash
git clone https://github.com/<your-username/AI-Chat-App.git
cd AI-Chat-App


