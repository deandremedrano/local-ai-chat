import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const API_URL = "http://localhost:11434/api/chat";

const AGENTS = {
  coding: { name: "Coding Agent", model: "qwen2.5-coder:latest", color: "#a78bfa", icon: "⌨️" },
  qa: { name: "QA Agent", model: "mistral-nemo:latest", color: "#34d399", icon: "🧪" },
  resume: { name: "Career Agent", model: "mistral-nemo:latest", color: "#fbbf24", icon: "💼" },
  general: { name: "General Agent", model: "mistral:latest", color: "#60a5fa", icon: "🤖" }
};

const AGENT_SYSTEMS = {
  coding: "You are an expert software engineer and coding specialist. Help with writing, debugging, and explaining code. Be concise and always include code examples.",
  qa: "You are an expert QA engineer with 15 years of experience at top tech companies including Apple. You specialize in test planning, test automation, bug reporting, and QA methodologies.",
  resume: "You are an expert career coach and resume specialist with deep knowledge of the tech industry. Give honest, accurate, personalized career advice based only on what the user shares.",
  general: "You are a helpful, intelligent, and concise AI assistant. Answer questions clearly and accurately."
};

const ROUTER_MODEL = "llama3.1:8b";
const ROUTER_PROMPT = `You are a routing agent. Reply with ONLY one word: coding, qa, resume, or general.
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
  const [chats, setChats] = useState([{ id: 1, name: "New Chat", messages: [] }]);
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

  const activeChat = chats.find(c => c.id === activeChatId);
  const messages = activeChat?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const newChat = () => {
    const id = Date.now();
    setChats(prev => [...prev, { id, name: "New Chat", messages: [] }]);
    setActiveChatId(id);
    setDocText("");
    setDocName("");
    setCurrentAgent(null);
    setStreamingContent("");
    setStatus("");
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDocName(file.name);
    setDocLoading(true);
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
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const streamAI = async (model, system, userMessage, onChunk) => {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: userMessage }
        ],
        stream: true
      }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(l => l.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            fullContent += data.message.content;
            onChunk(fullContent);
          }
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
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: userMessage }
        ],
        stream: false
      }),
    });
    const data = await res.json();
    return data.message.content;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = { role: "user", content: input };
    const updated = [...messages, userMessage];
    setChats(prev => prev.map(c => c.id === activeChatId ? {
      ...c,
      name: c.messages.length === 0 ? input.slice(0, 30) : c.name,
      messages: updated
    } : c));
    setInput("");
    setLoading(true);
    setStreamingContent("");
    setCurrentAgent(null);

    try {
      setStatus("🔀 Analyzing your message...");
      const route = manualAgent !== "auto" ? manualAgent : await (async () => {
        const r = await callAI(ROUTER_MODEL, "", ROUTER_PROMPT + input);
        return AGENTS[r.trim().toLowerCase()] ? r.trim().toLowerCase() : "general";
      })();

      const agent = AGENTS[route];
      setCurrentAgent(route);
      setStatus(`${agent.icon} ${agent.name} is thinking...`);

      const docContext = docText ? `\n\nUploaded document "${docName}":\n\n${docText.slice(0, 8000)}` : "";

      const fullContent = await streamAI(
        agent.model,
        AGENT_SYSTEMS[route] + docContext,
        input,
        (content) => setStreamingContent(content)
      );

      setStatus("✅ Done!");
      setTimeout(() => setStatus(""), 2000);

      const reply = { role: "assistant", content: fullContent, agent: agent.name, color: agent.color };
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...updated, reply] } : c));
      setStreamingContent("");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error — make sure Ollama is running");
    }
    setLoading(false);
  };

  const generateWithStream = async (model, system, prompt, setOutput, setLoadingState, setStatusState, statusMessages) => {
    setLoadingState(true);
    setOutput("");
    setStatusState(statusMessages[0]);
    try {
      await streamAI(model, system, prompt, (content) => {
        setOutput(content);
        if (content.length > 100 && content.length < 200) setStatusState(statusMessages[1]);
        if (content.length > 500) setStatusState(statusMessages[2]);
      });
      setStatusState("✅ Done!");
      setTimeout(() => setStatusState(""), 2000);
    } catch (err) {
      setStatusState("❌ Error — make sure Ollama is running");
    }
    setLoadingState(false);
  };

  const runPipeline = async () => {
    if (!pipelineDesc.trim() || pipelineLoading) return;
    setPipelineLoading(true);
    setPipelineTests("");
    setPipelineScript("");
    setPipelineBug("");

    try {
      setPipelineStep("🧪 Step 1 of 3 — Generating test cases...");
      const tests = await streamAI("mistral-nemo:latest", TEST_GEN_SYSTEM, `Generate test cases for:\n\n${pipelineDesc}`, setPipelineTests);

      setPipelineStep("⌨️ Step 2 of 3 — Writing Selenium script...");
      const script = await streamAI("qwen2.5-coder:latest", SELENIUM_SYSTEM, `Generate Selenium script for:\n\n${pipelineDesc}`, setPipelineScript);

      setPipelineStep("🐛 Step 3 of 3 — Creating bug report template...");
      const bug = await streamAI("mistral-nemo:latest", BUG_REPORT_SYSTEM, `Generate bug report template for:\n\n${pipelineDesc}`, setPipelineBug);

      setPipelineStep("✅ Pipeline complete!");
      setTimeout(() => setPipelineStep(""), 3000);
    } catch (err) {
      setPipelineStep("❌ Error — make sure Ollama is running");
    }
    setPipelineLoading(false);
  };

  const tabs = [
    { id: "chat", label: "Chat", color: "#4ade80" },
    { id: "tests", label: "Tests", color: "#34d399" },
    { id: "scripts", label: "Scripts", color: "#a78bfa" },
    { id: "bugs", label: "Bugs", color: "#f87171" },
    { id: "pipeline", label: "Pipeline", color: "#facc15" }
  ];

  const tabStyle = (tab) => ({
    padding: "0.4rem 0.6rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 600,
    background: activeTab === tab.id ? tab.color + "22" : "transparent",
    color: activeTab === tab.id ? tab.color : "#555",
    border: activeTab === tab.id ? `1px solid ${tab.color}44` : "1px solid transparent",
    transition: "all 0.2s"
  });

  const cardStyle = { background: "#161616", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "1.5rem", whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: 1.8, color: "#e0e0e0" };

  const btnStyle = (color, disabled) => ({
    padding: "0.75rem 1.5rem",
    borderRadius: "8px",
    background: disabled ? "#1a1a1a" : color,
    color: disabled ? "#444" : "#fff",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "14px",
    fontWeight: 600,
    alignSelf: "flex-start",
    transition: "opacity 0.2s"
  });

  const inputStyle = { background: "#161616", border: "1px solid #2a2a2a", borderRadius: "8px", color: "#f0f0f0", padding: "0.75rem 1rem", fontSize: "14px", resize: "vertical", outline: "none", fontFamily: "sans-serif", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a0a", color: "#f0f0f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ width: "240px", background: "#111", borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "1.25rem 1rem 1rem", borderBottom: "1px solid #1e1e1e" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "0.75rem", letterSpacing: "0.05em" }}>LOCAL AI SUITE</div>
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
            {tabs.map(tab => (
              <button key={tab.id} style={tabStyle(tab)} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
            ))}
          </div>
        </div>

        {activeTab === "chat" && (
          <>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #1e1e1e" }}>
              <button onClick={newChat} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#fff", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
                + New Chat
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
              {chats.map(c => (
                <div key={c.id} onClick={() => setActiveChatId(c.id)} style={{ padding: "0.6rem 0.75rem", borderRadius: "8px", cursor: "pointer", fontSize: "13px", marginBottom: "2px", background: c.id === activeChatId ? "#1e1e1e" : "transparent", color: c.id === activeChatId ? "#fff" : "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderLeft: c.id === activeChatId ? "2px solid #2563eb" : "2px solid transparent" }}>
                  {c.name}
                </div>
              ))}
            </div>
            <div style={{ padding: "1rem", borderTop: "1px solid #1e1e1e", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "10px", color: "#444", fontWeight: 600, letterSpacing: "0.08em", marginBottom: "2px" }}>AGENT MODE</div>
              <select value={manualAgent} onChange={e => setManualAgent(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", background: "#1a1a1a", color: "#4ade80", border: "1px solid #2a2a2a", fontSize: "12px", outline: "none" }}>
                <option value="auto">🔀 Auto Route</option>
                <option value="coding">⌨️ Coding Agent</option>
                <option value="qa">🧪 QA Agent</option>
                <option value="resume">💼 Career Agent</option>
                <option value="general">🤖 General Agent</option>
              </select>
              <button onClick={() => fileRef.current.click()} style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", background: "#1a1a1a", color: docName ? "#4ade80" : "#555", border: "1px solid #2a2a2a", cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {docLoading ? "Reading..." : docName ? `📄 ${docName}` : "📎 Upload Document"}
              </button>
              {docName && <button onClick={() => { setDocText(""); setDocName(""); }} style={{ width: "100%", padding: "0.4rem", borderRadius: "6px", background: "transparent", color: "#444", border: "1px solid #1e1e1e", cursor: "pointer", fontSize: "11px" }}>Remove</button>}
              <button onClick={() => exportContent(messages.map(m => `${m.role === "user" ? "You" : m.agent || "AI"}: ${m.content}`).join("\n\n"), `chat-${Date.now()}.txt`)} style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", background: "#1a1a1a", color: messages.length > 0 ? "#facc15" : "#333", border: "1px solid #2a2a2a", cursor: messages.length > 0 ? "pointer" : "not-allowed", fontSize: "12px" }}>
                💾 Export Chat
              </button>
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.pdf" onChange={handleFile} style={{ display: "none" }} />
            </div>
          </>
        )}

        {activeTab !== "chat" && (
          <div style={{ flex: 1, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {activeTab === "tests" && <div style={{ fontSize: "11px", color: "#555" }}>Powered by Mistral Nemo 12B</div>}
            {activeTab === "scripts" && <div style={{ fontSize: "11px", color: "#555" }}>Powered by Qwen2.5 Coder</div>}
            {activeTab === "bugs" && <div style={{ fontSize: "11px", color: "#555" }}>Powered by Mistral Nemo 12B</div>}
            {activeTab === "pipeline" && <div style={{ fontSize: "11px", color: "#555" }}>3 models · full pipeline</div>}
            <button onClick={() => {
              if (activeTab === "tests") exportContent(testOutput, `test-cases-${Date.now()}.md`);
              if (activeTab === "scripts") exportContent(seleniumOutput, `test_script_${Date.now()}.py`);
              if (activeTab === "bugs") exportContent(bugOutput, `bug-report-${Date.now()}.md`);
              if (activeTab === "pipeline") exportContent(`# QA Pipeline\n\n${pipelineTests}\n\n---\n\n${pipelineScript}\n\n---\n\n${pipelineBug}`, `qa-pipeline-${Date.now()}.md`);
            }} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", background: "#1a1a1a", color: "#facc15", border: "1px solid #2a2a2a", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
              💾 Export
            </button>
            <div style={{ fontSize: "10px", color: "#333", marginTop: "auto", textAlign: "center" }}>100% private · no cloud</div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {activeTab === "chat" && (
          <>
            <div style={{ padding: "0.875rem 1.5rem", borderBottom: "1px solid #1e1e1e", background: "#0f0f0f", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: currentAgent ? AGENTS[currentAgent]?.color : "#4ade80", boxShadow: `0 0 8px ${currentAgent ? AGENTS[currentAgent]?.color : "#4ade80"}` }}></div>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>
                {currentAgent ? `${AGENTS[currentAgent].icon} ${AGENTS[currentAgent].name}` : "Local AI Suite"}
              </span>
              {status && <span style={{ fontSize: "12px", color: "#facc15", marginLeft: "4px" }}>{status}</span>}
              {docName && <span style={{ fontSize: "11px", color: "#4ade80", marginLeft: "auto", background: "#4ade9922", padding: "2px 8px", borderRadius: "4px" }}>📄 {docName}</span>}
              {!docName && <span style={{ marginLeft: "auto", fontSize: "11px", color: "#333" }}>private · local · eco friendly</span>}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {messages.length === 0 && !loading && (
                <div style={{ textAlign: "center", marginTop: "5rem" }}>
                  <div style={{ fontSize: "28px", marginBottom: "0.5rem" }}>🤖</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>Local AI Suite</div>
                  <div style={{ fontSize: "13px", color: "#444", marginBottom: "2rem" }}>Multi-agent system · 100% private · runs on your Mac</div>
                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                    {Object.entries(AGENTS).map(([key, agent]) => (
                      <div key={key} style={{ padding: "0.5rem 1rem", borderRadius: "20px", border: `1px solid ${agent.color}44`, color: agent.color, fontSize: "12px", background: agent.color + "11" }}>
                        {agent.icon} {agent.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: "4px" }}>
                  {m.agent && (
                    <div style={{ fontSize: "11px", color: m.color || "#555", paddingLeft: "4px", fontWeight: 600 }}>
                      {AGENTS[Object.keys(AGENTS).find(k => AGENTS[k].name === m.agent)]?.icon} {m.agent}
                    </div>
                  )}
                  <div style={{ maxWidth: "72%", padding: "0.875rem 1.125rem", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px", background: m.role === "user" ? "linear-gradient(135deg, #2563eb, #7c3aed)" : "#161616", border: m.role === "assistant" ? "1px solid #2a2a2a" : "none", lineHeight: 1.7, fontSize: "14px", color: "#f0f0f0", whiteSpace: "pre-wrap" }}>
                    {m.content}
                  </div>
                </div>
              ))}

              {loading && streamingContent && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                  {currentAgent && (
                    <div style={{ fontSize: "11px", color: AGENTS[currentAgent]?.color, paddingLeft: "4px", fontWeight: 600 }}>
                      {AGENTS[currentAgent]?.icon} {AGENTS[currentAgent]?.name}
                    </div>
                  )}
                  <div style={{ maxWidth: "72%", padding: "0.875rem 1.125rem", borderRadius: "4px 18px 18px 18px", background: "#161616", border: "1px solid #2a2a2a", lineHeight: 1.7, fontSize: "14px", color: "#f0f0f0", whiteSpace: "pre-wrap" }}>
                    {streamingContent}<span style={{ display: "inline-block", width: "2px", height: "14px", background: "#4ade80", marginLeft: "2px", animation: "blink 1s infinite", verticalAlign: "text-bottom" }} />
                  </div>
                </div>
              )}

              {loading && !streamingContent && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ padding: "0.875rem 1.125rem", borderRadius: "4px 18px 18px 18px", background: "#161616", border: "1px solid #2a2a2a", color: "#555", fontSize: "14px" }}>
                    <span style={{ display: "inline-flex", gap: "4px" }}>
                      <span style={{ animation: "bounce 1s infinite 0s" }}>●</span>
                      <span style={{ animation: "bounce 1s infinite 0.2s" }}>●</span>
                      <span style={{ animation: "bounce 1s infinite 0.4s" }}>●</span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #1e1e1e", background: "#0f0f0f", display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Ask anything — press Enter to send, Shift+Enter for new line..."
                rows={1}
                style={{ flex: 1, padding: "0.875rem 1rem", borderRadius: "12px", border: "1px solid #2a2a2a", background: "#161616", color: "#f0f0f0", fontSize: "14px", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5 }}
              />
              <button onClick={sendMessage} disabled={loading} style={{ padding: "0.875rem 1.25rem", borderRadius: "12px", background: loading ? "#1a1a1a" : "linear-gradient(135deg, #2563eb, #7c3aed)", color: loading ? "#444" : "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: "18px", fontWeight: 700, flexShrink: 0 }}>
                ↑
              </button>
            </div>

            <style>{`
              @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
              @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
            `}</style>
          </>
        )}

        {activeTab === "tests" && (
          <>
            <div style={{ padding: "0.875rem 1.5rem", borderBottom: "1px solid #1e1e1e", background: "#0f0f0f", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399" }}></div>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>🧪 Test Case Generator</span>
              {testStatus && <span style={{ fontSize: "12px", color: "#facc15", marginLeft: "8px" }}>{testStatus}</span>}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", gap: "1rem", overflowY: "auto" }}>
              <div style={{ fontSize: "13px", color: "#666" }}>Describe the feature you want to test:</div>
              <textarea value={featureDesc} onChange={e => setFeatureDesc(e.target.value)} placeholder="Example: A login form with email and password fields..." rows={5} style={inputStyle} />
              <button onClick={() => generateWithStream("mistral-nemo:latest", TEST_GEN_SYSTEM, `Generate test cases for:\n\n${featureDesc}`, setTestOutput, setTestLoading, setTestStatus, ["🔍 Analyzing feature...", "📝 Writing test cases...", "✍️ Adding edge cases..."])} disabled={testLoading || !featureDesc.trim()} style={btnStyle("#34d399", testLoading || !featureDesc.trim())}>
                {testLoading ? testStatus : "🧪 Generate Test Cases"}
              </button>
              {testOutput && <div style={cardStyle}>{testOutput}</div>}
            </div>
          </>
        )}

        {activeTab === "scripts" && (
          <>
            <div style={{ padding: "0.875rem 1.5rem", borderBottom: "1px solid #1e1e1e", background: "#0f0f0f", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa", boxShadow: "0 0 8px #a78bfa" }}></div>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>⌨️ Selenium Script Generator</span>
              {seleniumStatus && <span style={{ fontSize: "12px", color: "#facc15", marginLeft: "8px" }}>{seleniumStatus}</span>}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", gap: "1rem", overflowY: "auto" }}>
              <div style={{ fontSize: "13px", color: "#666" }}>Describe what you want to automate:</div>
              <textarea value={seleniumDesc} onChange={e => setSeleniumDesc(e.target.value)} placeholder="Example: A login form at https://the-internet.herokuapp.com/login..." rows={5} style={inputStyle} />
              <button onClick={() => generateWithStream("qwen2.5-coder:latest", SELENIUM_SYSTEM, `Generate Selenium script for:\n\n${seleniumDesc}`, setSeleniumOutput, setSeleniumLoading, setSeleniumStatus, ["🔍 Analyzing requirements...", "⌨️ Writing test functions...", "🔧 Adding assertions..."])} disabled={seleniumLoading || !seleniumDesc.trim()} style={btnStyle("#a78bfa", seleniumLoading || !seleniumDesc.trim())}>
                {seleniumLoading ? seleniumStatus : "⌨️ Generate Selenium Script"}
              </button>
              {seleniumOutput && <div style={{ ...cardStyle, fontFamily: "monospace", fontSize: "13px" }}>{seleniumOutput}</div>}
            </div>
          </>
        )}

        {activeTab === "bugs" && (
          <>
            <div style={{ padding: "0.875rem 1.5rem", borderBottom: "1px solid #1e1e1e", background: "#0f0f0f", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171", boxShadow: "0 0 8px #f87171" }}></div>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>🐛 Bug Report Generator</span>
              {bugStatus && <span style={{ fontSize: "12px", color: "#facc15", marginLeft: "8px" }}>{bugStatus}</span>}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", gap: "1rem", overflowY: "auto" }}>
              <div style={{ fontSize: "13px", color: "#666" }}>Describe the bug you found:</div>
              <textarea value={bugDesc} onChange={e => setBugDesc(e.target.value)} placeholder="Example: When clicking submit with valid credentials, nothing happens..." rows={5} style={inputStyle} />
              <button onClick={() => generateWithStream("mistral-nemo:latest", BUG_REPORT_SYSTEM, `Generate bug report for:\n\n${bugDesc}`, setBugOutput, setBugLoading, setBugStatus, ["🔍 Analyzing bug...", "📝 Structuring report...", "🐛 Adding recommendations..."])} disabled={bugLoading || !bugDesc.trim()} style={btnStyle("#f87171", bugLoading || !bugDesc.trim())}>
                {bugLoading ? bugStatus : "🐛 Generate Bug Report"}
              </button>
              {bugOutput && <div style={cardStyle}>{bugOutput}</div>}
            </div>
          </>
        )}

        {activeTab === "pipeline" && (
          <>
            <div style={{ padding: "0.875rem 1.5rem", borderBottom: "1px solid #1e1e1e", background: "#0f0f0f", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: pipelineLoading ? "#facc15" : pipelineTests ? "#4ade80" : "#555", boxShadow: pipelineLoading ? "0 0 8px #facc15" : pipelineTests ? "0 0 8px #4ade80" : "none" }}></div>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>🚀 Full QA Pipeline</span>
              {pipelineStep && <span style={{ fontSize: "12px", color: "#facc15", marginLeft: "8px" }}>{pipelineStep}</span>}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", gap: "1.25rem", overflowY: "auto" }}>
              <div style={{ fontSize: "13px", color: "#666" }}>Describe your feature — the pipeline generates everything automatically:</div>
              <textarea value={pipelineDesc} onChange={e => setPipelineDesc(e.target.value)} placeholder="Example: A login form with email and password fields. Users can log in with valid credentials, see error messages for invalid inputs, and reset their password via email." rows={4} style={inputStyle} />
              <button onClick={runPipeline} disabled={pipelineLoading || !pipelineDesc.trim()} style={{ padding: "1rem 2rem", borderRadius: "10px", background: pipelineLoading || !pipelineDesc.trim() ? "#1a1a1a" : "linear-gradient(135deg, #34d399, #a78bfa, #f87171)", color: pipelineLoading || !pipelineDesc.trim() ? "#444" : "#fff", border: "none", cursor: pipelineLoading || !pipelineDesc.trim() ? "not-allowed" : "pointer", fontSize: "15px", fontWeight: 700, alignSelf: "flex-start" }}>
                {pipelineLoading ? pipelineStep : "🚀 Run Full QA Pipeline"}
              </button>

              {pipelineTests && (
                <div>
                  <div style={{ fontSize: "12px", color: "#34d399", fontWeight: 700, marginBottom: "0.5rem", letterSpacing: "0.05em" }}>🧪 TEST CASES</div>
                  <div style={cardStyle}>{pipelineTests}</div>
                </div>
              )}
              {pipelineScript && (
                <div>
                  <div style={{ fontSize: "12px", color: "#a78bfa", fontWeight: 700, marginBottom: "0.5rem", letterSpacing: "0.05em" }}>⌨️ SELENIUM SCRIPT</div>
                  <div style={{ ...cardStyle, fontFamily: "monospace", fontSize: "13px" }}>{pipelineScript}</div>
                </div>
              )}
              {pipelineBug && (
                <div>
                  <div style={{ fontSize: "12px", color: "#f87171", fontWeight: 700, marginBottom: "0.5rem", letterSpacing: "0.05em" }}>🐛 BUG REPORT TEMPLATE</div>
                  <div style={cardStyle}>{pipelineBug}</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}