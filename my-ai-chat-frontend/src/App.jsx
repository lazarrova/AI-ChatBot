import {useEffect, useRef, useState} from 'react'
import './App.css'
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css'
import {
    MainContainer,
    ChatContainer,
    MessageList,
    Message,
    MessageInput,
    TypingIndicator
} from "@chatscope/chat-ui-kit-react"

const STORAGE_KEY = "lazarova-chat-history-v1"
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";


function App() {
    const [errorMsg, setErrorMsg] = useState("");
    const [isStopping, setIsStopping] = useState(false);
    const [typing, setTyping] = useState(false)
    const [messages, setMessages] = useState([
        {message: "Hello, I'm LazarovaBot! Ask me anything.", sender: "assistant", direction: "incoming"}
    ])

    // Dark / Light theme
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

    useEffect(() => {
        document.body.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    const abortRef = useRef(null)

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed) && parsed.length) setMessages(parsed)
            }
        } catch {
        }
    }, [])

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
        } catch {
        }
    }, [messages])


    const sendMessage = async (text) => {
        const newUserMsg = {message: text, sender: "user", direction: "outgoing"}
        setMessages(prev => [...prev, newUserMsg])
        setTyping(true)
        await processMessage(newUserMsg)
    }

    const toChatHistory = (allMsgs, k = 8) =>
        allMsgs.slice(-k).map(m => ({
            role: m.sender === "assistant" ? "assistant" : "user",
            content: m.message
        }));


    async function processMessage(newUserMsg) {
        try {
            const payload = {
                system: "Explain all concepts in advanced level of speaking.",
                model: "gpt-4o-mini",
                messages: toChatHistory([...messages, newUserMsg], 8)
            };
        //    console.log("📦 Payload sent to backend:", payload); testing to see if toChatHistory is working


            abortRef.current = new AbortController();

            const resp = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload),
                signal: abortRef.current.signal
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                const msg = err?.detail || `API error ${resp.status}`;
                setMessages(prev => [...prev, {
                    message: `⚠️ ${msg}`,
                    sender: "assistant",
                    direction: "incoming",
                    source: "openai"
                }]);
                return;
            }

            const data = await resp.json();
            const content = data?.message || "(no content)";
            setMessages(prev => [...prev, {
                message: content,
                sender: "assistant",
                direction: "incoming",
                source: "openai"
            }]);
        } catch (e) {
            if (String(e?.name) === "AbortError") {
                setMessages(prev => [...prev, {
                    message: "⏹️ Stopped.",
                    sender: "assistant",
                    direction: "incoming",
                    source: "openai"
                }]);
            } else {
                setMessages(prev => [...prev, {
                    message: `⚠️ Network/JS error: ${String(e).slice(0, 120)}`,
                    sender: "assistant",
                    direction: "incoming",
                    source: "openai"
                }]);
            }
        } finally {
            setTyping(false);
            setIsStopping(false);
            abortRef.current = null;
        }
    }


    const clearChat = () => {
        setMessages([{message: "New session started. How can I help?", sender: "assistant", direction: "incoming"}])
    }

    const stopGenerating = () => {
        if (abortRef.current) {
            setIsStopping(true);
            abortRef.current.abort();
        }
    };



    const searchWikipedia = async () => {
        try {
            const lastUserMsg = [...messages].reverse().find(m => m.sender === "user");
            if (!lastUserMsg) {
                setMessages(prev => [...prev, { message: "⚠️ No user message to search.", sender: "assistant", direction: "incoming", source: "wiki" }]);
                return;
            }

            setTyping(true);

            const resp = await fetch(`${API_BASE}/answer_enriched`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: lastUserMsg.message })
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                const msg = err?.detail || `API error ${resp.status}`;
                setMessages(prev => [...prev, { message: `⚠️ ${msg}`, sender: "assistant", direction: "incoming", source: "wiki" }]);
                return;
            }

            const data = await resp.json();
            setMessages(prev => [
                ...prev,
                {
                    message: `🔎 ${data.answer}\n\nSource: ${data.cited_title}\n${data.url || ""}`,
                    sender: "assistant",
                    direction: "incoming",
                    source: "wiki"
                }
            ]);
        } catch (e) {
            setMessages(prev => [...prev, { message: `⚠️ Error: ${String(e).slice(0,120)}`, sender: "assistant", direction: "incoming", source: "wiki" }]);
        } finally {
            setTyping(false);
        }
    };



    return (
        <div className='App'>
            {/* Toolbar со копчиња */}
            <div style={{
                maxWidth: "750px",
                margin: "10px auto",
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
                alignItems: "center"
            }}>
                <button
                    onClick={searchWikipedia}
                    style={{
                        padding: "6px 12px",
                        backgroundColor: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "14px"
                    }}
                >
                    🔍 Search Context
                </button>

                <button
                    onClick={toggleTheme}
                    style={{
                        padding: "6px 12px",
                        backgroundColor: theme === "dark" ? "#facc15" : "#1e293b",
                        color: theme === "dark" ? "#000" : "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "14px"
                    }}
                >
                    {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
                </button>

                <button
                    onClick={stopGenerating}
                    disabled={!typing}
                    style={{
                        padding: "6px 12px",
                        backgroundColor: typing ? "#ef4444" : "#9ca3af",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: typing ? "pointer" : "not-allowed",
                        fontSize: "14px"
                    }}
                >
                    {isStopping ? "Stopping…" : "⏹ Stop"}
                </button>

            </div>

            {/* Toolbar со копче за Clear Chat */}
            <div style={{
                maxWidth: "750px",
                margin: "10px auto",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center"
            }}>
                <button
                    onClick={clearChat}
                    style={{
                        padding: "6px 12px",
                        backgroundColor: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "14px"
                    }}
                >
                    🧹 Clear chat
                </button>
            </div>

            <div style={{height: "85vh", width: "750px"}}>
                <MainContainer>
                    <ChatContainer>
                        <MessageList
                            typingIndicator={typing ? <TypingIndicator content="Assistant is typing..."/> : null}>
                            {messages.map((m, i) => (
                                <div key={i} className="msg-wrap">
                                    <Message model={m}/>
                                    {m.sender === "assistant" && m.source && (
                                        <div className={`chip ${m.source === "wiki" ? "chip-wiki" : "chip-openai"}`}>
                                            {m.source === "wiki" ? "Wikipedia" : "OpenAI"}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </MessageList>

                        <MessageInput placeholder='Type message here' onSend={sendMessage}/>
                    </ChatContainer>
                </MainContainer>
            </div>
        </div>
    )
}

export default App
