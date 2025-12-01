#!/bin/bash

# DA6 Form Generator - Supabase Quick Setup Script
# This script helps guide you through Supabase setup

echo "=========================================="
echo "DA6 Form Generator - Supabase Setup"
echo "=========================================="
echo ""
echo "This script will help you set up Supabase for the DA6 Form Generator."
echo ""

# Check if Supabase CLI is installed
if command -v supabase &> /dev/null; then
    echo "✓ Supabase CLI is installed"
    echo ""
    echo "Would you like to use Supabase CLI to create a project? (y/n)"
    read -r use_cli
    
    if [ "$use_cli" = "y" ] || [ "$use_cli" = "Y" ]; then
        echo ""
        echo "Logging in to Supabase..."
        supabase login
        
        echo ""
        echo "Creating a new Supabase project..."
        echo "You'll be prompted for project details."
        supabase projects create
        
        echo ""
        echo "Please note your project reference and API keys from the output above."
        echo ""
    fi
else
    echo "ℹ Supabase CLI is not installed."
    echo "  You can install it with: npm install -g supabase"
    echo "  Or set up manually via the web interface."
    echo ""
fi

echo "=========================================="
echo "Manual Setup Steps:"
echo "=========================================="
echo ""
echo "1. Go to https://app.supabase.com and sign up/login"
echo "2. Click 'New Project'"
echo "3. Fill in project details:"
echo "   - Name: da6-form-generator (or your choice)"
echo "   - Database Password: (create a strong password)"
echo "   - Region: (choose closest to you)"
echo "4. Wait for project to initialize (2-3 minutes)"
echo ""
echo "5. Get your API keys:"
echo "   - Go to Settings → API"
echo "   - Copy 'Project URL'"
echo "   - Copy 'anon public' key"
echo "   - Copy 'service_role' key (keep this secret!)"
echo ""
echo "6. Update your .env files:"
echo "   - Edit .env in the root directory"
echo "   - Edit client/.env"
echo "   - Replace the placeholder values with your actual keys"
echo ""
echo "7. Set up the database schema:"
echo "   - In Supabase dashboard, go to SQL Editor"
echo "   - Open database/schema.sql from this project"
echo "   - Copy and paste the entire contents"
echo "   - Click 'Run'"
echo ""
echo "8. Enable Google OAuth:"
echo "   - In Supabase dashboard, go to Authentication → Providers"
echo "   - Enable Google provider"
echo "   - Configure Google OAuth credentials in Google Cloud Console"
echo "   - Add redirect URI: https://your-project-ref.supabase.co/auth/v1/callback"
echo ""
echo "9. Restart your dev server:"
echo "   - Stop the current server (Ctrl+C)"
echo "   - Run: npm run dev"
echo ""
echo "=========================================="
echo "Setup complete! Check the README.md for more information."
echo "=========================================="

