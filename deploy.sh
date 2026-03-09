#!/bin/bash

# Radar Deployment Script
set -e

echo "🚀 Starting Radar deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please copy .env.production to .env and fill in your API keys:"
    echo "  cp .env.production .env"
    echo "  nano .env  # Edit with your actual values"
    exit 1
fi

# Check if required environment variables are set
echo "🔍 Checking environment variables..."
source .env

required_vars=("APOLLO_API_KEY" "RESEND_API_KEY" "BASIC_AUTH_PASSWORD")
for var in "${required_vars[@]}"; do
    val="${!var}"
    if [ -z "$val" ] || [ "$val" = "your_apollo_api_key_here" ] || [ "$val" = "your_resend_api_key_here" ] || [ "$val" = "your_secure_password_here" ]; then
        echo "❌ Please set $var in .env file"
        exit 1
    fi
done

echo "✅ Environment variables configured"

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build and start containers
echo "🔨 Building and starting containers..."
docker-compose up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check backend health
echo "🔍 Checking backend health..."
max_attempts=30
attempt=1
while [ $attempt -le $max_attempts ]; do
    if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy"
        break
    fi
    echo "Attempt $attempt/$max_attempts: Backend not ready yet..."
    sleep 2
    attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ Backend failed to start properly"
    echo "Check logs with: docker-compose logs backend"
    exit 1
fi

# Check frontend health
echo "🔍 Checking frontend health..."
if curl -f http://localhost/ > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend failed to start properly"
    echo "Check logs with: docker-compose logs frontend"
    exit 1
fi

echo ""
echo "🎉 Deployment successful!"
echo ""
echo "📱 Application URLs:"
echo "   Frontend: http://localhost"
echo "   Backend API: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "🔐 Login credentials:"
echo "   Username: ${BASIC_AUTH_USERNAME}"
echo "   Password: ${BASIC_AUTH_PASSWORD}"
echo ""
echo "📊 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart services: docker-compose restart"
echo "   Update deployment: ./deploy.sh"
echo ""