# Radar Deployment Guide

This guide covers deploying Radar using Docker for production use.

## Prerequisites

- Docker and Docker Compose installed
- Apollo.io API key
- Resend API key (for email notifications)
- Domain name (optional, for production)

## Quick Start

1. **Clone and navigate to the project:**
   ```bash
   git clone https://github.com/Aviral1303/Radar.git
   cd Radar
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.production .env
   nano .env  # Edit with your actual API keys and credentials
   ```

3. **Deploy:**
   ```bash
   ./deploy.sh
   ```

4. **Access the application:**
   - Frontend: http://localhost
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Environment Configuration

Edit `.env` file with your actual values:

```env
# Required: Apollo API key for profile data
APOLLO_API_KEY=your_apollo_api_key_here

# Required: Resend API key for email notifications  
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM=notifications@yourdomain.com
EMAIL_TO=admin@yourdomain.com

# Required: Change default password
BASIC_AUTH_USERNAME=admin
BASIC_AUTH_PASSWORD=your_secure_password_here
```

## Deployment Options

### Option 1: Docker Compose (Recommended)

```bash
# Deploy with automatic health checks
./deploy.sh

# Or manually:
docker-compose up --build -d
```

### Option 2: Individual Services

**Backend only:**
```bash
cd backend
docker build -t radar-backend .
docker run -d -p 8000:8000 --env-file ../.env radar-backend
```

**Frontend only:**
```bash
cd frontend
docker build -t radar-frontend .
docker run -d -p 80:80 radar-frontend
```

## Production Considerations

### 1. Database Migration

For production, consider using PostgreSQL:

```env
DATABASE_URL=postgresql://user:password@host:port/database
```

### 2. Reverse Proxy

For production with SSL, use nginx or Traefik:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Monitoring

Monitor container health:
```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Check resource usage
docker stats
```

### 4. Backups

Backup the database volume:
```bash
docker run --rm -v radar_backend_data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data
```

Restore from backup:
```bash
docker run --rm -v radar_backend_data:/data -v $(pwd):/backup alpine tar xzf /backup/backup.tar.gz -C /
```

## Cloud Deployment

### AWS ECS/Fargate

1. Push images to ECR
2. Create ECS task definitions
3. Set up Application Load Balancer
4. Configure RDS for database

### Google Cloud Run

1. Build and push to Container Registry
2. Deploy backend and frontend as separate services
3. Configure Cloud SQL for database

### DigitalOcean App Platform

1. Connect GitHub repository
2. Configure build settings
3. Set environment variables
4. Deploy with managed database

## Troubleshooting

### Backend Issues

```bash
# Check backend logs
docker-compose logs backend

# Check database connection
docker-compose exec backend python -c "from app.database import engine; print('DB OK' if engine else 'DB Error')"

# Run migrations manually
docker-compose exec backend alembic upgrade head
```

### Frontend Issues

```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend only
docker-compose up --build frontend
```

### Network Issues

```bash
# Check container networking
docker network ls
docker-compose exec frontend ping backend

# Check port bindings
docker-compose port frontend 80
docker-compose port backend 8000
```

## Updating

To update to the latest version:

```bash
git pull origin main
./deploy.sh
```

## Security

- Change default Basic Auth credentials
- Use HTTPS in production
- Regularly update dependencies
- Monitor API key usage
- Set up proper firewall rules
- Consider using secrets management (AWS Secrets Manager, etc.)

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Verify environment variables
3. Check API key validity
4. Review network connectivity