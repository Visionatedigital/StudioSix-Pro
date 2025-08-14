#!/bin/bash

# StudioSix Pro Deployment Script
# This script commits and pushes changes to trigger automatic deployment

echo "🚀 Starting StudioSix Pro deployment preparation..."

# Navigate to the repository root
cd "$(dirname "$0")/.."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check git status
echo "📋 Current git status:"
git status --porcelain

# Add all changes
echo "📝 Adding all changes to git..."
git add .

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "✅ No changes to commit"
else
    # Commit changes
    echo "💾 Committing changes..."
    git commit -m "Deploy: Update StudioSix Pro for production

- Configure DigitalOcean deployment
- Update API endpoints for production
- Add production build configuration
- Update Calendly links
- Prepare for automatic deployments

🚀 Ready for DigitalOcean App Platform"

    # Push to main branch
    echo "🌐 Pushing to main branch..."
    git push origin main

    echo "✅ Deployment preparation complete!"
    echo "🔗 Next steps:"
    echo "   1. Go to https://cloud.digitalocean.com/apps"
    echo "   2. Create a new app from your GitHub repository"
    echo "   3. Follow the DEPLOYMENT_GUIDE.md for detailed setup"
fi

echo "🎉 Ready for DigitalOcean deployment!"