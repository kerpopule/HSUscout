<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1j0Gk7O3RldOPvoWfZwYNUonz96vWQ8VM

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set runtime API keys as needed:
   - `GEMINI_API_KEY` in [.env.local](.env.local) (if used by your workflow)
   - `TBA_API_KEY` in your shell when starting the server for The Blue Alliance data (required for live event/team sync)
3. Run the app:
   `npm run dev`
