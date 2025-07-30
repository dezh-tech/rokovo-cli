#!/bin/bash
set -e

echo "🚀 Starting npm package release process..."

# Navigate to project directory
cd /home/balthazar/codes/khodkar-cli

# Clean and build
echo "🧹 Cleaning and building..."
npm run clean
npm run build

# Dry run to check what will be published
echo "🔍 Performing dry run..."
npm publish --dry-run

# Ask for confirmation
echo "📦 Ready to publish. The dry run above shows what will be included."
read -p "Do you want to proceed with publishing? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Ask for version bump type
    echo "📈 Select version bump type:"
    select bump_type in "patch" "minor" "major"; do
        case $bump_type in
            patch|minor|major)
                echo "Bumping version ($bump_type)..."
                npm version $bump_type
                break
                ;;
            *) echo "Invalid option. Please select 1, 2, or 3.";;
        esac
    done
    
    # Publish
    echo "🚀 Publishing to npm..."
    npm publish
    
    echo "✅ Package published successfully!"
    echo "📋 You can now install it with: npm install -g khodkar-cli"
else
    echo "❌ Publishing cancelled."
fi