#!/bin/bash
echo ""
echo "===== Job Agent Setup ====="
echo ""
echo "Paste your Anthropic API key below."
echo "(Get it from: console.anthropic.com → API Keys)"
echo ""
read -rp "Your API key: " key

if [ -z "$key" ]; then
  echo "No key entered. Exiting."
  exit 1
fi

# Save to .env file
echo "ANTHROPIC_API_KEY=$key" > .env
echo ""
echo "Key saved! Now running job search..."
echo ""

ANTHROPIC_API_KEY=$key npx tsx agent.ts --search-only
