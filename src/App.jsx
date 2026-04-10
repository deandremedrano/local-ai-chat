import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const API_URL = "http://localhost:11434/api/chat";

const AGENTS = {
  coding: { name: "Coding", model: "qwen2.5-coder:latest", color: "#0a84ff" },
  qa: { name: "QA", model: "mistral-nemo:latest", color: "#30d158" },
  resume: { name: "Career", model: "mistral-nemo:latest", color: "#ffd60a" },
  general: { name: "General", model: "mistral:latest", color: "#636366" }
};

const AGENT_SYSTEMS = {
  coding: "You are an expert software engineer. Help with writing, debugging, and explaining code. Be concise and include code examples.",
  qa: "You are an expert QA engineer with 15 years of experience at top tech companies including Apple. Specialize in test planning, automation, bug reporting, and QA methodologies.",
  resume: "You are an expert career coach with deep knowledge of the tech industry. Give honest, accurate, personalized career advice based only on what the user shares.",
  general: "You are a helpful, intelligent, and concise AI assistant. Answer questions clearly and accurately."
};

const ROUTER_MODEL = "llama3.1:8b";
const ROUTER_PROMPT = `Reply with ONLY one word: coding, qa, resume, or general.
- coding: programming, code, debugging
- qa: quality assurance, testing, bug reports  
- resume: career advice, job search, interview prep
- general: everything else
User message: `;

const TEST_GEN_SYSTEM = `You are a world class QA engineer with 15 years of experience at Apple. Generate comprehensive professional test cases.

Format exactly like this:

## Feature: [name]

### Functional Test Cases
| ID | Test Case | Steps | Expected Result | Severity |
|----|-----------|-------|-----------------|----------|

### Edge Cases
| ID | Test Case | Steps | Expected Result | Severity |
|----|-----------|-------|-----------------|----------|

### Negative Test Cases
| ID | Test Case | Steps | Expected Result | Severity |
|----|-----------|-------|-----------------|----------|

### Accessibility Test Cases
| ID | Test Case | Steps | Expected Result | Severity |
|----|-----------|-------|-----------------|----------|

### Summary
- Total test cases: [number]
- High severity: [number]
- Medium severity: [number]
- Low severity: [number]
- Recommended automation candidates: [list]`;

const SELENIUM_SYSTEM = `You are an expert QA automation engineer. Generate complete ready-to-run Python Selenium test scripts using pytest. Only output Python code, no explanations before or after.

Use this exact fixture:
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

@pytest.fixture
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.implicitly_wait(10)
    yield driver
    driver.quit()`;

const BUG_REPORT_SYSTEM = `You are a senior QA engineer at Apple. Write professional detailed bug reports.

Format exactly like this:

## Bug Report

**Bug ID:** BUG-[4 digit number]
**Date:** [today]
**Reporter:** QA Engineer
**Status:** Open

---

### Summary
[One line description]

### Environment
- **OS:** 
- **Browser/App Version:** 
- **Device:** 

### Severity
[Critical/High/Medium/Low] — [justification]

### Priority
[P1/P2/P3/P4] — [justification]

### Steps to Reproduce
1. 
2. 
3. 

### Expected Result
[What should happen]

### Actual Result
[What actually happens]

### Impact
[Who is affected]

### Possible Root Cause
[Technical hypothesis]

### Recommended Fix
[Suggested fix]

### Attachments
- [ ] Screenshot
- [ ] Screen recording
- [ ] Console logs
- [ ] Network logs`;

export default function App() {
  const [activeTab, setActiveTab] = useState("chat");
  const [chats, setChats] = useState([{ id: 1, name: "New Conversation", messages: [] }]);
  const [activeChatId, setActiveChatId] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [currentAgent, setCurrentAgent] = useState(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [docText, setDocText] = useState("");
  const [docName, setDocName] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [manualAgent, setManualAgent] = useState("auto");
  const [featureDesc, setFeatureDesc] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const [seleniumDesc, setSeleniumDesc] = useState("");
  const [seleniumOutput, setSeleniumOutput] = useState("");
  const [seleniumLoading, setSeleniumLoading] = useState(false);
  const [seleniumStatus, setSeleniumStatus] = useState("");
  const [bugDesc, setBugDesc] = useState("");
  const [bugOutput, setBugOutput] = useState("");
  const [bugLoading, setBugLoading] = useState(false);
  const [bugStatus, setBugStatus] = useState("");
  const [pipelineDesc, setPipelineDesc] = useState("");
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState("");
  const [pipelineTests, setPipelineTests] = useState("");
  const [pipelineScript, setPipelineScript] = useState("");
  const [pipelineBug, setPipelineBug] = useState("");
  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const messages = activeChat?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const newChat = () => {
    const id = Date.now();
    setChats(prev => [...prev, { id, name: "New Conversation", messages: [] }]);
    setActiveChatId(id);
    setDocText(""); setDocName("");
    setCurrentAgent(null); setStreamingContent(""); setStatus("");
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDocName(file.name); setDocLoading(true);
    if (file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(" ") + "\n";
      }
      setDocText(fullText);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setDocText(ev.target.result);
      reader.readAsText(file);
    }
    setDocLoading(false);
  };

  const exportContent = (content, filename) => {
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const streamAI = async (model, system, userMessage, onChunk) => {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: userMessage }],
        stream: true
      }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value).split("\n").filter(l => l.trim())) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) { fullContent += data.message.content; onChunk(fullContent); }
        } catch {}
      }
    }
    return fullContent;
  };

  const callAI = async (model, system, userMessage) => {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: userMessage }],
        stream: false
      }),
    });
    return (await res.json()).message.content;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const updated = [...messages, userMsg];
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, name: c.messages.length === 0 ? input.slice(0, 45) : c.name, messages: updated } : c));
    setInput(""); setLoading(true); setStreamingContent(""); setCurrentAgent(null);
    if (textareaRef.current) textareaRef.current.style.height = "22px";
    try {
      setStatus("Routing…");
      const route = manualAgent !== "auto" ? manualAgent : await (async () => {
        const r = await callAI(ROUTER_MODEL, "", ROUTER_PROMPT + input);
        return AGENTS[r.trim().toLowerCase()] ? r.trim().toLowerCase() : "general";
      })();
      const agent = AGENTS[route];
      setCurrentAgent(route);
      setStatus(`${agent.name} is responding…`);
      const docContext = docText ? `\n\nAttached document "${docName}":\n\n${docText.slice(0, 8000)}` : "";
      const fullContent = await streamAI(agent.model, AGENT_SYSTEMS[route] + docContext, input, setStreamingContent);
      setStatus("");
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...updated, { role: "assistant", content: fullContent, agent: route }] } : c));
      setStreamingContent("");
    } catch { setStatus("Connection error — is Ollama running?"); }
    setLoading(false);
  };

  const generateWithStream = async (model, system, prompt, setOut, setLoad, setStat, s1, s2, s3) => {
    setLoad(true); setOut(""); setStat(s1);
    try {
      await streamAI(model, system, prompt, (c) => { setOut(c); if (c.length > 200) setStat(s2); if (c.length > 800) setStat(s3); });
      setStat("Done"); setTimeout(() => setStat(""), 1500);
    } catch { setStat("Error — is Ollama running?"); }
    setLoad(false);
  };

  const runPipeline = async () => {
    if (!pipelineDesc.trim() || pipelineLoading) return;
    setPipelineLoading(true); setPipelineTests(""); setPipelineScript(""); setPipelineBug("");
    try {
      setPipelineStep("Generating test cases…");
      await streamAI("mistral-nemo:latest", TEST_GEN_SYSTEM, `Generate test cases for:\n\n${pipelineDesc}`, setPipelineTests);
      setPipelineStep("Writing Selenium script…");
      await streamAI("qwen2.5-coder:latest", SELENIUM_SYSTEM, `Generate Selenium script for:\n\n${pipelineDesc}`, setPipelineScript);
      setPipelineStep("Creating bug report template…");
      await streamAI("mistral-nemo:latest", BUG_REPORT_SYSTEM, `Generate bug report template for:\n\n${pipelineDesc}`, setPipelineBug);
      setPipelineStep("Complete"); setTimeout(() => setPipelineStep(""), 2000);
    } catch { setPipelineStep("Error — is Ollama running?"); }
    setPipelineLoading(false);
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = "22px";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  };

  const TABS = ["Chat", "Tests", "Scripts", "Bugs", "Pipeline"];

  return (
    <div style={{ display: "flex", height: "100vh", background: "#1c1c1e", fontFamily: "-apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif", color: "#f5f5f7" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.4)} }
        ::-webkit-scrollbar { width: 0px; }
        textarea::placeholder { color: #48484a; }
        input::placeholder { color: #48484a; }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: "252px", background: "#161618", borderRight: "0.5px solid #2c2c2e", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        
        {/* App header */}
        <div style={{ padding: "20px 16px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "linear-gradient(135deg, #0a84ff, #5e5ce6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>◎</div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#f5f5f7", letterSpacing: "-0.01em" }}>AI Suite</div>
              <div style={{ fontSize: "10px", color: "#48484a", letterSpacing: "0.02em" }}>Private · Local</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            {TABS.map(t => {
              const id = t.toLowerCase();
              const active = activeTab === id;
              return (
                <button key={id} onClick={() => setActiveTab(id)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderRadius: "8px", background: active ? "rgba(255,255,255,0.07)" : "transparent", border: "none", cursor: "pointer", textAlign: "left", width: "100%", transition: "background 0.15s" }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: active ? "#0a84ff" : "#3a3a3c", flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", color: active ? "#f5f5f7" : "#8e8e93", fontWeight: active ? 500 : 400 }}>{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height: "0.5px", background: "#2c2c2e", margin: "0 16px" }} />

        {/* Chat list */}
        {activeTab === "chat" && (
          <>
            <div style={{ padding: "12px 16px 6px" }}>
              <button onClick={newChat} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "8px", background: "transparent", border: "none", cursor: "pointer", color: "#0a84ff", fontSize: "13px", fontWeight: 500, width: "100%" }}>
                <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> New Conversation
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
              {chats.map(c => (
                <button key={c.id} onClick={() => setActiveChatId(c.id)} style={{ display: "block", width: "100%", padding: "8px 10px", borderRadius: "8px", background: c.id === activeChatId ? "rgba(255,255,255,0.06)" : "transparent", border: "none", cursor: "pointer", textAlign: "left", color: c.id === activeChatId ? "#f5f5f7" : "#8e8e93", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: "1px", transition: "all 0.15s" }}>
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        {activeTab !== "chat" && <div style={{ flex: 1 }} />}

        {/* Footer controls */}
        <div style={{ padding: "12px 16px 20px", borderTop: "0.5px solid #2c2c2e" }}>
          {activeTab === "chat" && (
            <>
              <div style={{ fontSize: "10px", color: "#48484a", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>Agent</div>
              <select value={manualAgent} onChange={e => setManualAgent(e.target.value)} style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", background: "#2c2c2e", color: "#f5f5f7", border: "none", fontSize: "13px", outline: "none", marginBottom: "8px", appearance: "none" }}>
                <option value="auto">Auto Route</option>
                <option value="coding">Coding</option>
                <option value="qa">QA</option>
                <option value="resume">Career</option>
                <option value="general">General</option>
              </select>
              <button onClick={() => fileRef.current.click()} style={{ display: "block", width: "100%", padding: "7px 10px", borderRadius: "8px", background: "transparent", border: "0.5px solid #3a3a3c", color: docName ? "#30d158" : "#8e8e93", fontSize: "13px", cursor: "pointer", textAlign: "left", marginBottom: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {docLoading ? "Reading…" : docName ? `📄 ${docName}` : "Attach Document"}
              </button>
              {docName && (
                <button onClick={() => { setDocText(""); setDocName(""); }} style={{ display: "block", width: "100%", padding: "6px 10px", borderRadius: "8px", background: "transparent", border: "none", color: "#48484a", fontSize: "12px", cursor: "pointer", textAlign: "left", marginBottom: "6px" }}>
                  Remove attachment
                </button>
              )}
              <button onClick={() => exportContent(messages.map(m => `${m.role === "user" ? "You" : AGENTS[m.agent]?.name || "AI"}: ${m.content}`).join("\n\n"), `conversation-${Date.now()}.txt`)} style={{ display: "block", width: "100%", padding: "7px 10px", borderRadius: "8px", background: "transparent", border: "0.5px solid #3a3a3c", color: "#8e8e93", fontSize: "13px", cursor: "pointer", textAlign: "left" }}>
                Export Conversation
              </button>
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.pdf" onChange={handleFile} style={{ display: "none" }} />
            </>
          )}
          {activeTab !== "chat" && (
            <button onClick={() => {
              if (activeTab === "tests") exportContent(testOutput, `test-cases-${Date.now()}.md`);
              if (activeTab === "scripts") exportContent(seleniumOutput, `test_${Date.now()}.py`);
              if (activeTab === "bugs") exportContent(bugOutput, `bug-report-${Date.now()}.md`);
              if (activeTab === "pipeline") exportContent(`# QA Pipeline\n\n${pipelineTests}\n\n---\n\n${pipelineScript}\n\n---\n\n${pipelineBug}`, `pipeline-${Date.now()}.md`);
            }} style={{ display: "block", width: "100%", padding: "7px 10px", borderRadius: "8px", background: "transparent", border: "0.5px solid #3a3a3c", color: "#8e8e93", fontSize: "13px", cursor: "pointer", textAlign: "left" }}>
              Export Output
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {activeTab === "chat" && (
          <>
            {/* Topbar */}
            <div style={{ height: "52px", borderBottom: "0.5px solid #2c2c2e", display: "flex", alignItems: "center", padding: "0 24px", gap: "10px", background: "#1c1c1e", flexShrink: 0 }}>
              {currentAgent ? (
                <>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: AGENTS[currentAgent].color, boxShadow: `0 0 6px ${AGENTS[currentAgent].color}` }} />
                  <span style={{ fontSize: "13px", color: "#f5f5f7", fontWeight: 500 }}>{AGENTS[currentAgent].name} Agent</span>
                  {status && <span style={{ fontSize: "12px", color: "#48484a" }}>— {status}</span>}
                </>
              ) : (
                <>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0a84ff" }} />
                  <span style={{ fontSize: "13px", color: "#8e8e93" }}>
                    {status || "Ready"}
                  </span>
                </>
              )}
              {docName && (
                <div style={{ marginLeft: "auto", fontSize: "11px", color: "#30d158", background: "rgba(48,209,88,0.08)", padding: "3px 10px", borderRadius: "6px", border: "0.5px solid rgba(48,209,88,0.2)" }}>
                  {docName}
                </div>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "32px 0" }}>
              <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
                {messages.length === 0 && !loading && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "20px", animation: "fadeIn 0.4s ease" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "16px", background: "linear-gradient(135deg, #0a84ff22, #5e5ce622)", border: "0.5px solid #3a3a3c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>◎</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "17px", fontWeight: 600, color: "#f5f5f7", marginBottom: "6px", letterSpacing: "-0.02em" }}>AI Suite</div>
                      <div style={{ fontSize: "13px", color: "#48484a", lineHeight: 1.5 }}>Private AI assistant · Runs on your Mac · No cloud</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                      {Object.entries(AGENTS).map(([key, a]) => (
                        <div key={key} style={{ padding: "5px 12px", borderRadius: "20px", border: `0.5px solid ${a.color}44`, color: a.color, fontSize: "12px", background: a.color + "0d", letterSpacing: "0.01em" }}>
                          {a.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: "5px", animation: "fadeIn 0.2s ease" }}>
                    {m.role === "assistant" && m.agent && (
                      <div style={{ fontSize: "11px", color: AGENTS[m.agent]?.color || "#8e8e93", fontWeight: 500, letterSpacing: "0.03em", paddingLeft: "2px", textTransform: "uppercase" }}>
                        {AGENTS[m.agent]?.name}
                      </div>
                    )}
                    {m.role === "user" && (
                      <div style={{ fontSize: "11px", color: "#48484a", paddingRight: "2px", textTransform: "uppercase", letterSpacing: "0.03em" }}>You</div>
                    )}
                    <div style={{
                      maxWidth: "80%",
                      padding: m.role === "user" ? "11px 16px" : "14px 18px",
                      borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                      background: m.role === "user" ? "#0a84ff" : "#2c2c2e",
                      color: "#f5f5f7",
                      fontSize: "14px",
                      lineHeight: 1.65,
                      whiteSpace: "pre-wrap",
                      letterSpacing: "-0.01em"
                    }}>
                      {m.content}
                    </div>
                  </div>
                ))}

                {loading && streamingContent && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px", animation: "fadeIn 0.2s ease" }}>
                    {currentAgent && (
                      <div style={{ fontSize: "11px", color: AGENTS[currentAgent]?.color, fontWeight: 500, letterSpacing: "0.03em", paddingLeft: "2px", textTransform: "uppercase" }}>
                        {AGENTS[currentAgent]?.name}
                      </div>
                    )}
                    <div style={{ maxWidth: "80%", padding: "14px 18px", borderRadius: "4px 18px 18px 18px", background: "#2c2c2e", color: "#f5f5f7", fontSize: "14px", lineHeight: 1.65, whiteSpace: "pre-wrap", letterSpacing: "-0.01em" }}>
                      {streamingContent}
                      <span style={{ display: "inline-block", width: "1.5px", height: "14px", background: "#0a84ff", marginLeft: "2px", animation: "blink 0.7s infinite", verticalAlign: "text-bottom", borderRadius: "1px" }} />
                    </div>
                  </div>
                )}

                {loading && !streamingContent && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "5px", flexDirection: "column" }}>
                    {currentAgent && <div style={{ fontSize: "11px", color: AGENTS[currentAgent]?.color, fontWeight: 500, letterSpacing: "0.03em", paddingLeft: "2px", textTransform: "uppercase" }}>{AGENTS[currentAgent]?.name}</div>}
                    <div style={{ padding: "14px 18px", borderRadius: "4px 18px 18px 18px", background: "#2c2c2e", display: "flex", gap: "5px", alignItems: "center" }}>
                      {[0, 0.18, 0.36].map((d, i) => (
                        <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#48484a", animation: `pulse 1.2s infinite ${d}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input */}
            <div style={{ padding: "12px 24px 20px", background: "#1c1c1e", flexShrink: 0 }}>
              <div style={{ maxWidth: "720px", margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", background: "#2c2c2e", borderRadius: "16px", padding: "10px 10px 10px 16px", border: "0.5px solid #3a3a3c" }}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Message AI Suite…"
                    rows={1}
                    style={{ flex: 1, background: "transparent", border: "none", color: "#f5f5f7", fontSize: "14px", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6, height: "22px", letterSpacing: "-0.01em" }}
                  />
                  <button onClick={sendMessage} disabled={loading || !input.trim()} style={{ width: "32px", height: "32px", borderRadius: "10px", background: (!loading && input.trim()) ? "#0a84ff" : "#3a3a3c", color: (!loading && input.trim()) ? "#fff" : "#48484a", border: "none", cursor: (!loading && input.trim()) ? "pointer" : "not-allowed", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                    ↑
                  </button>
                </div>
                <div style={{ textAlign: "center", fontSize: "11px", color: "#3a3a3c", marginTop: "8px", letterSpacing: "0.01em" }}>
                  Runs privately on your Mac — no data sent to any server
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tool tabs */}
        {activeTab !== "chat" && (
          <>
            <div style={{ height: "52px", borderBottom: "0.5px solid #2c2c2e", display: "flex", alignItems: "center", padding: "0 32px", gap: "10px", background: "#1c1c1e", flexShrink: 0 }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0a84ff" }} />
              <span style={{ fontSize: "13px", color: "#f5f5f7", fontWeight: 500 }}>
                {activeTab === "tests" && "Test Case Generator"}
                {activeTab === "scripts" && "Selenium Script Generator"}
                {activeTab === "bugs" && "Bug Report Generator"}
                {activeTab === "pipeline" && "QA Pipeline"}
              </span>
              {(testStatus || seleniumStatus || bugStatus || pipelineStep) && (
                <span style={{ fontSize: "12px", color: "#48484a" }}>
                  — {testStatus || seleniumStatus || bugStatus || pipelineStep}
                </span>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
              <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ fontSize: "13px", color: "#8e8e93" }}>
                  {activeTab === "tests" && "Describe the feature you want to generate test cases for."}
                  {activeTab === "scripts" && "Describe what you want to automate with Selenium."}
                  {activeTab === "bugs" && "Describe the bug you found."}
                  {activeTab === "pipeline" && "Describe your feature. The pipeline generates test cases, a Selenium script, and a bug report template automatically."}
                </div>

                <textarea
                  value={activeTab === "tests" ? featureDesc : activeTab === "scripts" ? seleniumDesc : activeTab === "bugs" ? bugDesc : pipelineDesc}
                  onChange={e => {
                    if (activeTab === "tests") setFeatureDesc(e.target.value);
                    else if (activeTab === "scripts") setSeleniumDesc(e.target.value);
                    else if (activeTab === "bugs") setBugDesc(e.target.value);
                    else setPipelineDesc(e.target.value);
                  }}
                  placeholder={
                    activeTab === "tests" ? "Example: A login form with email and password fields. Users can log in with valid credentials and see error messages for invalid inputs." :
                    activeTab === "scripts" ? "Example: A login form at https://the-internet.herokuapp.com/login with username 'tomsmith' and password 'SuperSecretPassword!'." :
                    activeTab === "bugs" ? "Example: When clicking submit with valid credentials, nothing happens. No error message appears and the user is not redirected." :
                    "Example: A login form with email and password fields. Users can log in, see errors for invalid inputs, and reset their password via email."
                  }
                  rows={5}
                  style={{ background: "#2c2c2e", border: "0.5px solid #3a3a3c", borderRadius: "12px", color: "#f5f5f7", padding: "14px 16px", fontSize: "14px", resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.6, letterSpacing: "-0.01em" }}
                />

                <button
                  onClick={() => {
                    if (activeTab === "tests") generateWithStream("mistral-nemo:latest", TEST_GEN_SYSTEM, `Generate test cases for:\n\n${featureDesc}`, setTestOutput, setTestLoading, setTestStatus, "Analyzing…", "Writing test cases…", "Adding edge cases…");
                    else if (activeTab === "scripts") generateWithStream("qwen2.5-coder:latest", SELENIUM_SYSTEM, `Generate Selenium script for:\n\n${seleniumDesc}`, setSeleniumOutput, setSeleniumLoading, setSeleniumStatus, "Analyzing…", "Writing functions…", "Adding assertions…");
                    else if (activeTab === "bugs") generateWithStream("mistral-nemo:latest", BUG_REPORT_SYSTEM, `Generate bug report for:\n\n${bugDesc}`, setBugOutput, setBugLoading, setBugStatus, "Analyzing issue…", "Structuring report…", "Adding detail…");
                    else runPipeline();
                  }}
                  disabled={
                    (activeTab === "tests" && (testLoading || !featureDesc.trim())) ||
                    (activeTab === "scripts" && (seleniumLoading || !seleniumDesc.trim())) ||
                    (activeTab === "bugs" && (bugLoading || !bugDesc.trim())) ||
                    (activeTab === "pipeline" && (pipelineLoading || !pipelineDesc.trim()))
                  }
                  style={{
                    padding: "10px 20px",
                    borderRadius: "10px",
                    background: "#0a84ff",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 500,
                    alignSelf: "flex-start",
                    letterSpacing: "-0.01em",
                    opacity: (
                      (activeTab === "tests" && (testLoading || !featureDesc.trim())) ||
                      (activeTab === "scripts" && (seleniumLoading || !seleniumDesc.trim())) ||
                      (activeTab === "bugs" && (bugLoading || !bugDesc.trim())) ||
                      (activeTab === "pipeline" && (pipelineLoading || !pipelineDesc.trim()))
                    ) ? 0.3 : 1,
                    transition: "opacity 0.2s"
                  }}
                >
                  {activeTab === "tests" && (testLoading ? testStatus : "Generate")}
                  {activeTab === "scripts" && (seleniumLoading ? seleniumStatus : "Generate")}
                  {activeTab === "bugs" && (bugLoading ? bugStatus : "Generate")}
                  {activeTab === "pipeline" && (pipelineLoading ? pipelineStep : "Run Pipeline")}
                </button>

                {(testOutput || seleniumOutput || bugOutput) && activeTab !== "pipeline" && (
                  <div style={{ background: "#2c2c2e", border: "0.5px solid #3a3a3c", borderRadius: "12px", padding: "20px", whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: 1.8, color: "#d1d1d6", fontFamily: activeTab === "scripts" ? "monospace" : "inherit", letterSpacing: activeTab === "scripts" ? "0" : "-0.01em" }}>
                    {activeTab === "tests" ? testOutput : activeTab === "scripts" ? seleniumOutput : bugOutput}
                  </div>
                )}

                {activeTab === "pipeline" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {pipelineTests && (
                      <div>
                        <div style={{ fontSize: "11px", color: "#30d158", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>Test Cases</div>
                        <div style={{ background: "#2c2c2e", border: "0.5px solid #3a3a3c", borderRadius: "12px", padding: "20px", whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: 1.8, color: "#d1d1d6" }}>{pipelineTests}</div>
                      </div>
                    )}
                    {pipelineScript && (
                      <div>
                        <div style={{ fontSize: "11px", color: "#0a84ff", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>Selenium Script</div>
                        <div style={{ background: "#2c2c2e", border: "0.5px solid #3a3a3c", borderRadius: "12px", padding: "20px", whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: 1.8, color: "#d1d1d6", fontFamily: "monospace" }}>{pipelineScript}</div>
                      </div>
                    )}
                    {pipelineBug && (
                      <div>
                        <div style={{ fontSize: "11px", color: "#ffd60a", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>Bug Report Template</div>
                        <div style={{ background: "#2c2c2e", border: "0.5px solid #3a3a3c", borderRadius: "12px", padding: "20px", whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: 1.8, color: "#d1d1d6" }}>{pipelineBug}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}