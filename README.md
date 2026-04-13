# Local AI Suite

A private, multi-agent AI chat application built with React that runs 100% locally on your machine. No cloud, no data collection, no subscriptions — completely free and private forever.

## What This Is

A custom-built AI assistant with specialized agents for different tasks. The system automatically routes your messages to the most appropriate agent based on context, giving you expert-level responses across coding, QA engineering, career advice, and general knowledge.

## Features

- **Multi-Agent Routing** — automatically selects the best AI model for your query
- **Real-time Streaming** — responses appear word by word as the AI thinks
- **Test Case Generator** — describe any feature and generate professional QA test cases
- **Selenium Script Generator** — automatically writes Python Selenium automation scripts
- **Bug Report Generator** — creates structured professional bug reports
- **Full QA Pipeline** — one click generates test cases, Selenium scripts, and bug reports simultaneously
- **Apple QA Interview Prep** — practice with real Apple QA engineering interview questions and get scored feedback
- **Document Upload** — attach PDFs and text files for AI analysis
- **Export** — save conversations, test cases, scripts, and reports

## Agents

- **Coding Agent** — powered by Qwen2.5 Coder, specializes in code generation and debugging
- **QA Agent** — powered by Mistral Nemo, specializes in test planning and QA methodology
- **Career Agent** — powered by Mistral Nemo, specializes in career coaching and interview prep
- **General Agent** — powered by Mistral, handles all other queries

## Tech Stack

- React + Vite
- Ollama (local AI runtime)
- Mistral Nemo 12B
- Qwen2.5 Coder
- Llama 3.1 8B (routing)
- pdfjs-dist (PDF parsing)

## Privacy

Everything runs locally on your machine. No data is sent to any external server. No API keys required. No subscriptions.

## Setup

1. Install Ollama from ollama.com
2. Pull required models:

ollama pull mistral-nemo
ollama pull qwen2.5-coder
ollama pull llama3.1:8b
ollama pull mistral

3. Clone and run:

npm install
npm run dev

## Author

Built by Deandre Medrano