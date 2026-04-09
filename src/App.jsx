import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const API_URL = "http://localhost:11434/api/chat";

const AGENTS = {
  coding: {
    name: "Coding Agent",
    model: "qwen2.5-coder:latest",
    color: "#a78bfa",
    system: "You are an expert software engineer and coding specialist. You help with writing, debugging, and explaining code across all programming languages. Be concise and always include code examples."
  },
  qa: {
    name: "QA Agent",
    model: "mistral-nemo:latest",
    color: "#34d399",
    system: "You are an expert QA engineer with 15 years of experience at top tech companies including Apple. You specialize in test planning, test automation, bug reporting, and QA methodologies."
  },
  resume: {
    name: "Career Agent",
    model: "mistral-nemo:latest",
    color: "#fbbf24",
    system: "You are an expert career coach and resume specialist with deep knowledge of the tech industry. You give honest, accurate, personalized career advice based only on what the user shares with you."
  },
  general: {
    name: "General Agent",
    model: "mistral:latest",
    color: "#60a5fa",
    system: "You are a helpful, intelligent, and concise AI assistant. You answer questions clearly and accurately."
  }
};

const ROUTER_MODEL = "llama3.1:8b";
const ROUTER_PROMPT = `You are a routing agent. Based on the user's message, decide which agent should handle it.
Reply with ONLY one of these exact words: coding, qa, resume, general

Rules:
- coding: any programming, code, debugging, technical implementation questions
- qa: quality assurance, testing, test cases, bug reports, QA methodologies
- resume: career advice, job search, resume review, interview prep, salary
- general: everything else

User message: `;

const TEST_GEN_SYSTEM = `You are a world class QA engineer with 15 years of experience at Apple, Google, and Microsoft. 
When given a feature description, you generate comprehensive, professional test cases.

Always format your response exactly like this:

## Feature: [feature name]

### Functional Test Cases
| ID | Test Case | Steps | Expected Result | Severity |
|----|-----------|-------|-----------------|----------|
| TC001 | [name] | [steps] | [expected] | High/Medium/Low |

### Edge Cases
| ID | Test Case | Steps | Expected Result | Severity |
|----|-----------|-------|-----------------|----------|

### Negative Test Cases
| ID | Test Case | Steps | Expected Result | Severity |
|----|-----------|-------|-----------------|----------|

### Accessibility Test Cases
| ID | Test Case | Steps | Expected Result | Severity |
|----|-----------|-------|-----------------|----------|

### API Test Cases (if applicable)
| ID | Test Case | Endpoint | Method | Expected Result | Severity |
|----|-----------|----------|--------|-----------------|----------|

### Summary
- Total test cases: [number]
- High severity: [number]
- Medium severity: [number]  
- Low severity: [number]
- Recommended automation candidates: [list]`;

const SELENIUM_SYSTEM = `You are an expert QA automation engineer with 15 years of experience writing Selenium WebDriver test scripts in Python.

When given a feature description or test cases, generate complete, ready-to-run Python Selenium test scripts using pytest.

Always use this exact structure:

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
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )
    driver.implicitly_wait(10)
    yield driver
    driver.quit()

Then write individual test functions for each test case. Make the scripts complete, production-ready, and include comments explaining each test. Always end with instructions on how to run the tests.`;

export default function App() {
  const [activeTab, setActiveTab] = useState("chat");
  const [chats, setChats] = useState([{ id: 1, name: "New Chat", messages: [] }]);
  const [activeChatId, setActiveChatId] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [docText, setDocText] = useState("");
  const [docName, setDocName] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [manualAgent, setManualAgent] = useState("auto");
  const [featureDesc, setFeatureDesc] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [seleniumDesc, setSeleniumDesc] = useState("");
  const [seleniumOutput, setSeleniumOutput] = useState("");
  const [seleniumLoading, setSeleniumLoading] = useState(false);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const messages = activeChat?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const newChat = () => {
    const id = Date.now();
    setChats(prev => [...prev, { id, name: "New Chat", messages: [] }]);
    setActiveChatId(id);
    setDocText("");
    setDocName("");
    setCurrentAgent(null);
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

  const exportChat = () => {
    if (messages.length === 0) return;
    const text = messages.map(m => `${m.role === "user" ? "You" : `AI (${m.agent || "assistant"})`}: ${m.content}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeChat.name.slice(0, 30)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTests = () => {
    if (!testOutput) return;
    const blob = new Blob([testOutput], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-cases-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSelenium = () => {
    if (!seleniumOutput) return;
    const blob = new Blob([seleniumOutput], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test_script_${Date.now()}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateTests = async () => {
    if (!featureDesc.trim() || testLoading) return;
    setTestLoading(true);
    setTestOutput("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral-nemo:latest",
          messages: [
            { role: "system", content: TEST_GEN_SYSTEM },
            { role: "user", content: `Generate comprehensive test cases for this feature:\n\n${featureDesc}` }
          ],
          stream: false
        }),
      });
      const data = await res.json();
      setTestOutput(data.message.content);
    } catch (err) {
      console.error(err);
      setTestOutput("Error generating test cases. Make sure Ollama is running.");
    }
    setTestLoading(false);
  };

  const generateSelenium = async () => {
    if (!seleniumDesc.trim() || seleniumLoading) return;
    setSeleniumLoading(true);
    setSeleniumOutput("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen2.5-coder:latest",
          messages: [
            { role: "system", content: SELENIUM_SYSTEM },
            { role: "user", content: `Generate a complete Python Selenium test script for:\n\n${seleniumDesc}` }
          ],
          stream: false
        }),
      });
      const data = await res.json();
      setSeleniumOutput(data.message.content);
    } catch (err) {
      console.error(err);
      setSeleniumOutput("Error generating script. Make sure Ollama is running.");
    }
    setSeleniumLoading(false);
  };

  const routeMessage = async (message) => {
    if (manualAgent !== "auto") return manualAgent;
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ROUTER_MODEL,
          messages: [{ role: "user", content: ROUTER_PROMPT + message }],
          stream: false
        }),
      });
      const data = await res.json();
      const route = data.message.content.trim().toLowerCase();
      if (AGENTS[route]) return route;
      return "general";
    } catch {
      return "general";
    }
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
    setCurrentAgent(null);
    const agentKey = await routeMessage(input);
    const agent = AGENTS[agentKey];
    setCurrentAgent(agentKey);
    const docContext = docText ? `\n\nThe user has uploaded a document called "${docName}". Here is its content:\n\n${docText.slice(0, 8000)}` : "";
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: agent.model,
          messages: [{ role: "system", content: agent.system + docContext }, ...updated],
          stream: false
        }),
      });
      const data = await res.json();
      const reply = { role: "assistant", content: data.message.content, agent: agent.name };
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...updated, reply] } : c));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
    setCurrentAgent(null);
  };

  const tabStyle = (tab) => ({
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    background: activeTab === tab ? "#2563eb" : "transparent",
    color: activeTab === tab ? "#fff" : "#888",
    border: "none"
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0f0f0f", color: "#f0f0f0", fontFamily: "sans-serif" }}>
      <div style={{ width: "220px", background: "#111", borderRight: "1px solid #222", display: "flex", flexDirection: "column", padding: "1rem 0" }}>
        <div style={{ padding: "0 0.75rem 1rem", borderBottom: "1px solid #222", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button style={tabStyle("chat")} onClick={() => setActiveTab("chat")}>Chat</button>
          <button style={tabStyle("tests")} onClick={() => setActiveTab("tests")}>Tests</button>
          <button style={tabStyle("scripts")} onClick={() => setActiveTab("scripts")}>Scripts</button>
        </div>

        {activeTab === "chat" && (
          <>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #222" }}>
              <button onClick={newChat} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 500 }}>
                + New Chat
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
              {chats.map(c => (
                <div key={c.id} onClick={() => setActiveChatId(c.id)} style={{ padding: "0.6rem 0.75rem", borderRadius: "8px", cursor: "pointer", fontSize: "13px", marginBottom: "2px", background: c.id === activeChatId ? "#1e1e1e" : "transparent", color: c.id === activeChatId ? "#fff" : "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.name}
                </div>
              ))}
            </div>
            <div style={{ padding: "1rem", borderTop: "1px solid #222", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "11px", color: "#555", marginBottom: "2px" }}>Agent Mode</div>
              <select value={manualAgent} onChange={e => setManualAgent(e.target.value)} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", background: "#1e1e1e", color: "#4ade80", border: "1px solid #333", cursor: "pointer", fontSize: "13px", outline: "none" }}>
                <option value="auto">Auto Route</option>
                <option value="coding">Coding Agent</option>
                <option value="qa">QA Agent</option>
                <option value="resume">Career Agent</option>
                <option value="general">General Agent</option>
              </select>
              <button onClick={() => fileRef.current.click()} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", background: "#1e1e1e", color: docName ? "#4ade80" : "#888", border: "1px solid #333", cursor: "pointer", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {docLoading ? "Reading..." : docName ? `📄 ${docName}` : "Upload Document"}
              </button>
              {docName && (
                <button onClick={() => { setDocText(""); setDocName(""); }} style={{ width: "100%", padding: "0.4rem", borderRadius: "8px", background: "transparent", color: "#555", border: "1px solid #222", cursor: "pointer", fontSize: "12px" }}>
                  Remove Document
                </button>
              )}
              <button onClick={exportChat} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", background: "#1e1e1e", color: messages.length > 0 ? "#facc15" : "#333", border: "1px solid #333", cursor: messages.length > 0 ? "pointer" : "not-allowed", fontSize: "13px" }}>
                Export Chat
              </button>
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.pdf" onChange={handleFile} style={{ display: "none" }} />
            </div>
          </>
        )}

        {activeTab === "tests" && (
          <div style={{ flex: 1, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "12px", color: "#555" }}>Powered by Mistral Nemo</div>
            <button onClick={exportTests} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", background: "#1e1e1e", color: testOutput ? "#facc15" : "#333", border: "1px solid #333", cursor: testOutput ? "pointer" : "not-allowed", fontSize: "13px" }}>
              Export as Markdown
            </button>
            <div style={{ fontSize: "11px", color: "#444", marginTop: "auto", textAlign: "center" }}>100% private · no cloud</div>
          </div>
        )}

        {activeTab === "scripts" && (
          <div style={{ flex: 1, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "12px", color: "#555" }}>Powered by Qwen2.5 Coder</div>
            <button onClick={exportSelenium} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", background: "#1e1e1e", color: seleniumOutput ? "#facc15" : "#333", border: "1px solid #333", cursor: seleniumOutput ? "pointer" : "not-allowed", fontSize: "13px" }}>
              Export as .py file
            </button>
            <div style={{ fontSize: "11px", color: "#444", marginTop: "auto", textAlign: "center" }}>100% private · no cloud</div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {activeTab === "chat" && (
          <>
            <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #222", background: "#111", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: currentAgent ? AGENTS[currentAgent]?.color : "#4ade80" }}></div>
              <strong>Local AI — {currentAgent ? AGENTS[currentAgent]?.name : "Multi-Agent System"}</strong>
              {docName && <span style={{ fontSize: "12px", color: "#4ade80", marginLeft: "8px" }}>📄 {docName}</span>}
              <span style={{ marginLeft: "auto", fontSize: "12px", color: "#555" }}>100% private · no cloud · eco friendly</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", color: "#444", marginTop: "4rem" }}>
                  <div style={{ fontSize: "15px", marginBottom: "1rem" }}>Multi-Agent AI System</div>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                    {Object.entries(AGENTS).map(([key, agent]) => (
                      <div key={key} style={{ padding: "0.4rem 0.8rem", borderRadius: "20px", border: `1px solid ${agent.color}`, color: agent.color, fontSize: "12px" }}>
                        {agent.name}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: "13px", color: "#333", marginTop: "1rem" }}>Ask anything — the right agent responds automatically</div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.agent && <div style={{ fontSize: "11px", color: "#555", marginBottom: "4px", paddingLeft: "4px" }}>{m.agent}</div>}
                  <div style={{ maxWidth: "70%", padding: "0.75rem 1rem", borderRadius: "12px", background: m.role === "user" ? "#2563eb" : "#1e1e1e", border: m.role === "assistant" ? "1px solid #2a2a2a" : "none", lineHeight: 1.6, fontSize: "15px" }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start", flexDirection: "column" }}>
                  <div style={{ fontSize: "11px", color: "#555", marginBottom: "4px", paddingLeft: "4px" }}>
                    {currentAgent ? `${AGENTS[currentAgent]?.name} thinking...` : "Routing to best agent..."}
                  </div>
                  <div style={{ padding: "0.75rem 1rem", borderRadius: "12px", background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#555" }}>...</div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #222", background: "#111", display: "flex", gap: "0.75rem" }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Ask anything — the right agent responds automatically..." style={{ flex: 1, padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #333", background: "#1a1a1a", color: "#f0f0f0", fontSize: "15px", outline: "none" }} />
              <button onClick={sendMessage} disabled={loading} style={{ padding: "0.75rem 1.5rem", borderRadius: "8px", background: loading ? "#1a1a1a" : "#2563eb", color: loading ? "#555" : "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: "15px", fontWeight: 500 }}>
                {loading ? "..." : "Send"}
              </button>
            </div>
          </>
        )}

        {activeTab === "tests" && (
          <>
            <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #222", background: "#111", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399" }}></div>
              <strong>Automated Test Case Generator</strong>
              <span style={{ marginLeft: "auto", fontSize: "12px", color: "#555" }}>100% private · no cloud · eco friendly</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", gap: "1rem", overflowY: "auto" }}>
              <div style={{ fontSize: "14px", color: "#888" }}>Describe the feature you want to test:</div>
              <textarea value={featureDesc} onChange={e => setFeatureDesc(e.target.value)} placeholder="Example: A login form with email and password fields..." rows={6} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", color: "#f0f0f0", padding: "0.75rem 1rem", fontSize: "14px", resize: "vertical", outline: "none", fontFamily: "sans-serif" }} />
              <button onClick={generateTests} disabled={testLoading || !featureDesc.trim()} style={{ padding: "0.75rem 1.5rem", borderRadius: "8px", background: testLoading || !featureDesc.trim() ? "#1a1a1a" : "#34d399", color: testLoading || !featureDesc.trim() ? "#555" : "#000", border: "none", cursor: testLoading || !featureDesc.trim() ? "not-allowed" : "pointer", fontSize: "15px", fontWeight: 500, alignSelf: "flex-start" }}>
                {testLoading ? "Generating test cases..." : "Generate Test Cases"}
              </button>
              {testOutput && (
                <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "1.5rem", whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: 1.7, color: "#f0f0f0" }}>
                  {testOutput}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "scripts" && (
          <>
            <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #222", background: "#111", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#a78bfa" }}></div>
              <strong>Selenium Script Generator</strong>
              <span style={{ marginLeft: "auto", fontSize: "12px", color: "#555" }}>100% private · no cloud · eco friendly</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", gap: "1rem", overflowY: "auto" }}>
              <div style={{ fontSize: "14px", color: "#888" }}>Describe what you want to automate:</div>
              <textarea value={seleniumDesc} onChange={e => setSeleniumDesc(e.target.value)} placeholder="Example: A login form at https://the-internet.herokuapp.com/login with username 'tomsmith' and password 'SuperSecretPassword!'. Test valid login, invalid credentials, empty fields, and logout." rows={6} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", color: "#f0f0f0", padding: "0.75rem 1rem", fontSize: "14px", resize: "vertical", outline: "none", fontFamily: "sans-serif" }} />
              <button onClick={generateSelenium} disabled={seleniumLoading || !seleniumDesc.trim()} style={{ padding: "0.75rem 1.5rem", borderRadius: "8px", background: seleniumLoading || !seleniumDesc.trim() ? "#1a1a1a" : "#a78bfa", color: seleniumLoading || !seleniumDesc.trim() ? "#555" : "#fff", border: "none", cursor: seleniumLoading || !seleniumDesc.trim() ? "not-allowed" : "pointer", fontSize: "15px", fontWeight: 500, alignSelf: "flex-start" }}>
                {seleniumLoading ? "Generating script..." : "Generate Selenium Script"}
              </button>
              {seleniumOutput && (
                <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "1.5rem", whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: 1.7, color: "#f0f0f0", fontFamily: "monospace" }}>
                  {seleniumOutput}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}