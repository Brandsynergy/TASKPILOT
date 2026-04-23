# TaskPilot

> Automate anything with one prompt. An AI-powered, mobile-friendly PWA alternative to Make.com, Zapier, and Vectorshift.

## What is this?

TaskPilot is a web app where you type a task in plain English (*"get me the top 5 Hacker News stories and summarise them"*) and an AI agent plans and executes it using a set of tools (HTTP requests, webpage reading, etc). It returns the answer, plus a full trace of every step it took.

## How it works (30-second version)

1. You type a prompt.
2. The browser sends it to `/api/run`.
3. The server calls OpenAI with a list of available **tools** (`http_request`, `fetch_webpage_text`, `current_time`).
4. The model decides which tools to call, calls them, reads the results, and repeats until it has an answer.
5. The final answer + execution trace is sent back to your browser.

No database needed. No OAuth needed (yet). Just a prompt in, a result out.

## Run it on your own computer

```bash
# 1. Install Node.js 22+ if you don't have it (https://nodejs.org).
# 2. In the project folder, install dependencies:
npm install

# 3. Create an env file with your OpenAI key:
cp .env.example .env.local
# then open .env.local in a text editor and paste your key after OPENAI_API_KEY=

# 4. Start the dev server:
npm run dev

# 5. Open http://localhost:3000 in your browser.
```

## Deploy it to Render.com (step by step)

You only need to do this once. After that, every `git push` automatically redeploys.

1. Push this repo to GitHub (see below).
2. Go to https://dashboard.render.com/blueprints and click **New Blueprint Instance**.
3. Connect your GitHub account when asked, and pick the `BRANDSYNERGY/taskpilot` repo.
4. Render reads `render.yaml` and shows one service: `taskpilot`.
5. Under **Environment**, paste your OpenAI key into `OPENAI_API_KEY`. Leave `OPENAI_MODEL` as `gpt-4o-mini`.
6. Click **Apply**. Render will build and deploy. First build takes ~3 minutes.
7. When done, Render gives you a URL like `https://taskpilot.onrender.com`. Open it. Done.

## Pushing to GitHub

```bash
# 1. Go to https://github.com/new and create an empty repo called `taskpilot`
#    under the BRANDSYNERGY account. Do NOT add a README or .gitignore on GitHub
#    because this repo already has them.
# 2. Back in your terminal, from inside the taskpilot folder, run:
git remote add origin https://github.com/BRANDSYNERGY/taskpilot.git
git branch -M main
git push -u origin main
# 3. When Git asks for a password, use a GitHub Personal Access Token
#    (Settings > Developer settings > Personal access tokens > Fine-grained tokens).
```

## Adding more tools

Edit `src/lib/tools.ts` and add a new entry to the `TOOLS` array. Each tool needs a name, description, JSON Schema for its parameters, and an `execute` function. The AI will auto-discover and use it.

## Cost

- OpenAI: roughly $0.001 per task with `gpt-4o-mini`. A $5 credit lasts thousands of tasks.
- Render: free tier is fine for getting started (the free web service sleeps after 15 minutes of inactivity — upgrade to Starter $7/mo to keep it always on).

## Roadmap

- Stripe paywall and subscription tiers
- User accounts (Clerk)
- Persistent workflow runs and scheduling
- Gmail / Slack / Google Sheets OAuth integrations
- Visual editor for tweaking generated plans

## License

MIT.
