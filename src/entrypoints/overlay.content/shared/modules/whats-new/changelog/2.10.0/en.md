# 2.10.0 Update: Enter the Workspace Agent & Quality of Life Tweaks

Hey old friends, it's time for another progress report!

I've been working my tail off to bring you version 2.10.0. This time, not only did I fix some long-standing pain points you've been reporting, but we also dropped a "big one"—the Workspace Agent. This is a crucial step towards turning this into a true "productivity monster", so let's get right into it.

---

## 🎁 Core Experience Upgrades for Everyone

When you use a tool every day, convenience is everything. I've packed several quality-of-life tweaks into the core version, just to make your workflow frictionless:

*   **Temporary Chats in AI Studio**: Some of you mentioned wanting to casually test a few prompts without leaving a trace. You got it! New chats won't be saved to the file tree anymore (though honestly, they still save to AI Studio Drive, we're just simulating a temp chat on the frontend). I also fixed a bug where Gemini temp chats were creating phantom entries in folders.
*   **Ultra-Clean "Compact Mode"**: If you're like me and want to clear every unnecessary button off the screen while working, you can now completely hide the sidebar icon bar! The UI instantly becomes cleaner, halving your cognitive load—perfect for deep work.
*   **Smoother Mouse & Keyboard Shortcuts**: The 'New Chat' button now supports middle-click to open in a new tab. Plus, muscle memory reigns supreme: you can finally press F2 to rename and Delete to trash files.
*   **Find Folders Instantly**: Added a search function to the folder selection popup. No matter how many folders you have, you can find the right one in a second.
*   **Squashed a Bug**: Fixed the smartscrollbar occasionally scrambling the order when you branch a chat in Gemini.

---

## 🔥 The Main Event: Workspace Agent (Let AI Do the Actual Work)

This is absolutely what I'm most excited about in this update! I've always felt that just chatting isn't enough; AI should actually do the work for me. So, the Workspace Agent is here!

**How to use it? Super easy:** It sits right alongside the classic BetterSidebar Agent. Just type a `>` symbol in the input box, select the Workspace Agent, and upload your files to the workspace.

Once uploaded, you can let the AI view and even edit your files. **So what can it actually do? Let me give you some real-world examples:**

*   **📝 The Paper/Report Savior (Supports Word `.docx`)**
    Drag in your 50-page `thesis.docx` and ask the AI to polish specific paragraphs. Here’s the kicker: it **won't just brutally overwrite your file**. It acts like a mentor, adding **comments** where there are issues, or using **Tracked Changes** to rewrite. Your hard-earned formatting and citations stay perfectly intact. You just click "Accept/Reject" in Word.
*   **📊 Data Crunching Master (Supports Excel `.xlsx` / `.csv`)**
    Toss `data.xlsx` its way for statistical analysis. It understands your headers and is smart enough to **insert new columns and write real Excel formulas**, rather than just dumping hardcoded numbers. Your charts and conditional formatting won't be touched.
*   **🎬 Video Creator's Best Friend (Supports Subtitles `.srt`, `.vtt`, `.ass`)**
    Have it translate or polish your subtitles. The brilliant part? It knows timestamps are sacred. After translation, **not a single millisecond of the timeline is altered**, so your lip-syncing remains flawless.
*   **📚 Literature Review & Annotation (Supports PDF)**
    Drag in a PDF. While it can't directly edit the body text (due to format limitations), it can extract info and even **highlight key points and add sticky notes** directly onto the PDF.
*   **🪧 Presentation Helper (Supports PPT `.pptx`)**
    It can read slide content, replace text, edit speaker notes, and even help you reorder the slides.
*   **💻 Developer & Writer Favorite (Supports plain text, `.md`, and code files)**
    This is actually the most common use case! Whether it's organizing Markdown notes, writing/fixing code, or tweaking complex config files, the Agent can easily read and accurately modify them—like having a dedicated, all-around assistant living right in your workspace.

**Notice a pattern? Its biggest advantage is: it absolutely preserves your formatting!** Thanks to specialized underlying document handling, whether it's Word or Excel, your original styling is protected. This is what a real productivity tool should look like.

*   **A Small Regret & A Promise**: Due to browser extension limitations, files currently must be uploaded to the workspace first, and we don't yet support previewing them directly in the sidebar. I've noted these inconveniences and will definitely find ways to fix them.
*   **Feedback Welcome**: This feature is currently in Beta. If you run into bugs or find something counterintuitive, let me know anytime and I promise lightning-fast fixes!

---

## 🚀 Power Users, Welcome (Regarding Powerpack)

If you're a hardcore productivity nerd who relies heavily on AI, the full form of Workspace Agent is a must-have.

*   **Unleashed**: In Powerpack, there are zero limits on the number of workspaces or files. Go wild.
*   **AI Studio Caught Up**: AI Studio now supports full Agent capabilities, bringing it exactly on par with the Gemini experience.
*   **Smarter Agent**: I've optimized the Agent's system instructions. It's much more interactive now—it will actually discuss things with you rather than just mindlessly executing tasks on its own, understanding your true intent much better.

🤫 **Self-serving tip (a little plug)**: The Workspace Agent is currently in Beta. Once the test concludes and the feature stabilizes, the price of Powerpack will go up. So, grabbing it now is a steal—you get early access and save money. Think of it as supporting my late-night coding sessions!

---

## 🎨 Finally, A New Look for Your Mood (Themes)

Sometimes, a nice theme is all it takes to make coding or reading docs a better experience.

*   **6 Gorgeous New Themes** (included in the Supportpack): Guaranteed to put you in a better mood while working.
*   **Convenient Color Picker**: No more digging through the settings panel. You can now select custom color styles directly from the folder dropdown menu.
*   **UI Polish**: Fixed a bug where the sidebar background color looked off in the AI Studio theme. It finally looks right. Also, added an account avatar display to the sidebar—a huge win for multi-account users, making it super easy to check login status and switch accounts.

That's everything for 2.10.0! Building this extension is a continuous process of tinkering and refining alongside you guys. If anything feels clunky, you know the drill—just holler at me!
