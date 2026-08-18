# 🤖 v2.9.0 — The Agent Has Landed

Remember what I promised in v2.8.0? *"The Agent is still in the oven."* Well, the timer just went off. 🔔

Two and a half months. A lot of coffee. An engine rewritten more times than I'd like to admit in public. **The AI Agent is officially live.**

Here's the thing I want you to understand about this release: every other sidebar extension out there gives you *buttons*. You click, it does one thing. This one gives you an **operator**. You describe what you want in plain English, and the AI actually goes and does it — reading your data, making decisions, executing multi-step work, and reporting back. Inside your own browser. Using your own Gemini session. No API keys, no extra tokens, no data leaving your machine.

Let me show you what that means.

## 🚀 The Headliner: AI Agent

Type `>` in the Gemini input box. That's it. That's the whole interface.

A list pops up: pick a **Skill**, or just hit the first option and let the AI figure out which skill fits your request. Then describe your task like you'd describe it to a competent intern, and watch it work.

**A few Skills ship in the box to get you started:**

*   **🗂️ Auto-Organize:** "Sort my last 200 chats into folders and tag them." It reads your titles, figures out the taxonomy, creates the folders, moves everything. Your 6-month backlog of untitled chaos, handled in one pass.
*   **🔄 Backfill Your Search Index:** Here's a thing you probably didn't know: a conversation's messages only get recorded while you have it open. Every chat you had *before* installing this extension is sitting in the database as a title with no content — which is exactly why full-text search sometimes comes up empty. This skill finds every one of them and syncs the actual messages in, so search and export finally see everything. Run it once, then run it again — and if a chat *still* has no messages after a real sync attempt, that means it doesn't exist on Google's side anymore. Ghost entry. Just tell the Agent to clean those up.
*   **📊 Query Your Own Data:** Ask questions about your conversation history like it's a database — because it is one. "Which folder has the most chats from last month?" It'll tell you.
*   **📝 Manage Prompts & Snippets:** Rewrite, reorganize, deduplicate, and refactor your Prompt Library and Snippets in bulk. Turn a messy pile into an actual library.
*   **🛠️ Write Your Own Skills:** Go to **Settings → Agent** and define custom Skills with your own instructions. If you can describe a repeatable workflow, you can teach it to the Agent — and it becomes a permanent one-click card.

### 🔓 But please don't stop at that list

Those Skills are **presets, not limits.** I want to be really clear about this, because it's the whole point.

Under the hood, the Agent has genuine query access to your extension's database — every conversation, message, folder, tag, prompt, and snippet, all of it queryable. It's not picking from a menu of five canned actions. It writes its own queries against your actual data, looks at what comes back, and decides what to do next. So the real answer to "what can it do?" is: **whatever you can describe about your own data.**

Which means the best way to find the ceiling is to go looking for it:

*   Just hit `>` and *ask* it. "What can you actually do with my data?" "What's messy in here that I haven't noticed?" It knows what tables it can see and what tools it has, so let it pitch you.
*   **Talk to it like a colleague, not a search box.** It's a real multi-turn conversation — it reports back, you push further. "Interesting, now break that down by month." "Okay, do the same for the ones I starred." "Actually, merge those two folders instead." Each round it already has the context from the last one.
*   Ask it things no feature I could design would cover: "Which topics do I keep coming back to?" "Find chats about the auth bug from March and pull them into one folder." "Which of my prompts have I never actually used?" "Summarize what I worked on last quarter."

Honestly, the coolest uses of this will be ones I never thought of. Go poke at it and tell me what you find.

**And here's the part I'm actually proud of — the safety rails:**

*   **🛑 You're always in the loop.** Anything that *writes* to your data asks for approval first. Reads run free. You decide the policy, and you can flip it per-session.
*   **⚡ Speed Mode** if you trust it. One toggle, and it stops asking. (With an undo, because I'm not a monster.)
*   **🎛️ The Agent Dock** lives right above your input box — it follows you even when the sidebar is closed. Status, Stop button, approvals, everything in one place. No more "wait, is it still running?"
*   **🔌 Circuit breakers everywhere.** If it loops, repeats itself, or stops making progress, the engine kills the run and tells you why. It also checks in with you after long unattended stretches instead of silently grinding away.

**💚 If you bought the Powerpack at the Early Bird price — this is yours, free, right now.** You bet on this before it existed. Thank you. Go type `>` and see what you paid for.

## ✨ Also Landing in This Release

*   **⚡ Gemini Spark Integration:** If Google has rolled Spark out to your account, it now shows up as a native tab in the sidebar. Nothing to configure — if you have it, it's there.
*   **🎨 A Cleaner, Calmer UI:** I went through the whole interface and turned down the noise. Tighter spacing rhythm, better contrast, refined themes. It just feels less busy now. Plus a smooth **animated transition when you switch themes**, because tiny delights matter.
*   **🎛️ Click the Extension Icon for Settings:** The browser toolbar icon now opens a real control panel — toggle platforms and features without digging through menus.
*   **⌨️ Slash Commands in AI Studio:** The `/` Prompt Library shortcut was Gemini-only. Now AI Studio has it too. Type `/`, pick a prompt, go.
*   **💾 Automatic Local Backups:** Your extension data now backs itself up on a schedule — and you can trigger a manual snapshot anytime. If something ever goes sideways, you can roll back to a previous state. Peace of mind, finally shipped.
*   **📜 Smart Scrollbar, Now Expandable:** Click to expand the scrollbar into a full list of your messages. Long conversations just became navigable. Scroll less, jump more.
*   **📁 Create Folders Without Leaving the Dialog:** The "Move to folder" dialog now has a **New Folder** button. Small thing. Fixes a genuinely annoying dead-end.

## 🐛 Fixes — And One Important One

*   **☁️ Google Drive sync no longer eats your data.** This is the big one, and I want to be straight with you: the old auto-merge logic could overwrite local data in bad ways. **It's gone.** Drive will never silently overwrite or merge into your local data again — restoring is now a deliberate, manual download that you initiate. Uploads still happen automatically if you've enabled sync. Your local data is the source of truth, full stop.
*   **🔍 Gemini conversation scanning fixed.** Scanning your chat list works reliably again.
*   **😴 No more "waking up dead."** If you left a tab open for hours and came back to a zombie sidebar — fixed. It reconnects properly now.
*   **📐 Gemini page no longer randomly shifts upward.** That intermittent layout jump is gone.
*   **⌨️ Spaces don't cancel renames anymore.** Typing a space while renaming no longer kicks you out of edit mode. Multi-word names are back on the menu.
*   **🕒 Correct timestamps.** Conversation creation time and last-active time now display accurately instead of making things up.
*   **💎 Gems & Notebooks detected on creation.** New Gems and Notebooks show up immediately instead of requiring a refresh ritual.
*   **⚪ No more dead grey dots.** Fixed the Smart Scrollbar occasionally rendering unclickable dots.

***

This one took a while, and it's the biggest thing I've built for this extension. The Agent isn't a demo — it's the engine I'll be building on for the next several releases, and it's going to get sharper fast.

So please: go break it. Point it at your messiest folder. Write a weird custom Skill. Then tell me what happened — Discord, email, wherever. Every bug report from you all made this version better than I could have made it alone.

Now go type `>` and let it cook. 🚀
