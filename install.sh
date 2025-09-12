#!/bin/bash

# GitHub Commit Titles Installer
# This script helps you install and set up the GitHub Commit Titles tool

set -e

echo "🚀 Installing GitHub Commit Titles..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    echo "   Please upgrade Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Make the script executable
chmod +x titles.js

echo "✅ Installation complete!"

# Check for GitHub CLI
if command -v gh &> /dev/null; then
    echo "🔍 GitHub CLI detected"
    if gh auth status &> /dev/null; then
        echo "✅ GitHub CLI is authenticated"
        echo "   You can now run: node titles.js --owner user --repo repo --start '7 days ago' --end 'today'"
    else
        echo "⚠️  GitHub CLI is not authenticated"
        echo "   Run 'gh auth login' to authenticate"
    fi
else
    echo "ℹ️  GitHub CLI not found"
    echo "   Install it for easier authentication: https://cli.github.com/"
    echo "   Or use GITHUB_TOKEN environment variable"
fi

echo ""
echo "📖 Usage examples:"
echo "   node titles.js --help"
echo "   node titles.js --owner user --repo repo --start '7 days ago' --end 'today'"
echo "   node titles.js --config config.example.json"
echo ""
echo "🎉 Happy commit hunting!"
