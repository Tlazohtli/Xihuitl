#!/bin/bash
KEY_FILE="./my-key.pem" # Update this path

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ SSH Key file not found!"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "❌ .env file missing!"
    exit 1
fi

echo "🛠️  Starting Build and Deploy process..."
make deploy