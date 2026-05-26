# Quick Docker Commands Reference

## Login to Docker Hub
```bash
docker login
```

## Build Images Locally

### API
```bash
docker build -f ./docker/Dockerfile.api -t ailaeclass/api:latest .
```

### Dashboard
```bash
docker build -f ./docker/Dockerfile.dashboard -t ailaeclass/dashboard:latest .
```

## Push to Docker Hub

### API
```bash
docker push ailaeclass/api:latest
```

### Dashboard
```bash
docker push ailaeclass/dashboard:latest
```

## All in One Script
```bash
# Make script executable (first time only)
chmod +x docker-push.sh

# Run the script
./docker-push.sh

# With custom username
DOCKERHUB_USERNAME=your-username ./docker-push.sh

# With version tag
VERSION=v1.0.0 ./docker-push.sh
```

## Pull Published Images
```bash
docker pull ailaeclass/api:latest
docker pull ailaeclass/dashboard:latest
```

## Run Published Images
```bash
# API
docker run -d -p 3081:3081 \
  -e PUBLIC_SUPABASE_ANON_KEY=your_key \
  -e PUBLIC_SUPABASE_URL=your_url \
  ailaeclass/api:latest

# Dashboard
docker run -d -p 3082:3082 \
  -e PUBLIC_SUPABASE_ANON_KEY=your_key \
  -e PUBLIC_SUPABASE_URL=your_url \
  ailaeclass/dashboard:latest
```

## Useful Commands

### Check local images
```bash
docker images | grep ailaeclass
```

### Remove local images
```bash
docker rmi ailaeclass/api:latest
docker rmi ailaeclass/dashboard:latest
```

### View image details
```bash
docker inspect ailaeclass/api:latest
```

### Check image size
```bash
docker images ailaeclass/api:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

