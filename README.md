# Local AI Multi-Agent Chat App

A private, eco-friendly AI chat application built with React that runs 100% locally on your machine. No cloud, no data collection, no subscriptions — forever free.

## What This Is

This is a custom-built AI chat interface inspired by Apple's internal "Enchanté" tool. It features a multi-agent system that automatically routes your questions to the most qualified AI model.

## Features

- Multi-agent routing — automatically sends questions to the best specialist
- Coding Agent (Qwen2.5 Coder) — code generation and debugging
- QA Agent (Mistral Nemo) — testing methodologies and quality assurance
- Career Agent (Mistral Nemo) — resume advice and interview prep
- General Agent (Mistral 7B) — everything else
- Document upload — analyze PDFs and text files locally
- Chat history — multiple conversation sessions
- Custom system prompts — change AI personality on the fly
- Export conversations — download chats as text files
- Model switching — swap between models in the UI
- 100% private — nothing ever leaves your machine

## Tech Stack

- React + Vite
- Ollama (local LLM runtime)
- Mistral Nemo 12B, Llama 3.1 8B, Qwen2.5 Coder, Mistral 7B
- pdfjs-dist for PDF parsing
- Runs entirely on Apple Silicon (M1/M2/M3/M4)

## Prerequisites

- Mac with Apple Silicon (M1 or later recommended)
- Ollama installed (ollama.ai)
- Node.js 18+

## Setup

1. Install Ollama from ollama.ai
2. Pull the required models:

ollama pull mistral-nemo
ollama pull llama3.1:8b
ollama pull qwen2.5-coder
ollama pull mistral

3. Clone this repo and install dependencies:

git clone https://github.com/9j77k8ffzw-coder/local-ai-chat.git
cd local-ai-chat
npm install

4. Start the app:

npm run dev

5. Open http://localhost:5173 in your browser

## How It Works

When you send a message the Router Agent (Llama 3.1 8B) reads it and automatically decides which specialist should respond. Coding questions go to Qwen2.5 Coder, QA questions go to Mistral Nemo, career questions go to the Career Agent, and everything else goes to the General Agent. You can also manually select an agent from the dropdown.

## Privacy

All AI inference runs locally on your machine using your Apple Silicon Neural Engine. No data is ever sent to external servers. The app works completely offline after initial model downloads.

## Author

Built by Deandre Medrano