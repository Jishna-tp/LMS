# Absentra Deployment Guide

## Table of Contents
1. [Deployment Overview](#deployment-overview)
2. [Prerequisites](#prerequisites)
3. [Supabase Setup](#supabase-setup)
4. [Environment Configuration](#environment-configuration)
5. [Database Migration](#database-migration)
6. [Frontend Deployment](#frontend-deployment)
7. [Production Configuration](#production-configuration)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)
10. [Scaling Considerations](#scaling-considerations)

## Deployment Overview

Absentra is a full-stack application that requires:
- **Frontend**: React application (static files)
- **Backend**: Supabase (PostgreSQL + API)
- **Authentication**: Custom implementation
- **Storage**: Database only (no file storage required)

### Architecture Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Supabase      │    │   Database      │
│   (React/Vite)  │───▶│   (API Layer)   │───▶│   (PostgreSQL)  │
│   Static Files  │    │   Auth & RLS    │    │   Tables & RLS  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **npm**: 8.x or higher
- **Git**: Latest version
- **Supabase Account**: Free or paid tier

### Development Tools
```bash
# Verify Node.js version
node --version  # Should be 18.x+

# Verify npm version
npm --version   # Should be 8.x+

# Install global dependencies (optional)
npm install -g @supabase/cli  # For local development
```

### Access Requirements
- Supabase project access
- Domain/hosting platform access
- SSL certificate (for production)
- Environment variable management

## Supabase Setup

### 1. Create Supabase Project

**Step-by-Step Process**:
1. Go to [supabase.com](https://supabase.com)
2. Sign in or create account
3. Click "New Project"
4. Fill project details:
   - **Name**: `absentra-production`
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to users
5. Wait for project creation (2-3 minutes)

### 2. Configure Project Settings

**Database Configuration**:
```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

**Authentication Settings**:
1. Go to Authentication → Settings
2. **Site URL**: Set to your domain
3. **Redirect URLs**: Add your domain
4. **Email Auth**: Disable (using custom auth)
5. **Phone Auth**: Disable
6. **Third-party Auth**: Disable all providers

**API Settings**:
1. Go to Settings → API
2. Note down:
   - **Project URL**
   - **Anon Public Key**
   - **Service Role Key** (keep secure)

### 3. Database Security

**Row Level Security (RLS)**:
```sql
-- Enable RLS on all tables (done in migrations)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
-- ... etc for all tables
```

**Security Policies**:
All policies are defined in migration files and will be applied automatically.

## Environment Configuration

### 1. Environment Variables

**Production Environment Variables**:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Application Configuration
VITE_APP_NAME=Absentra
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=production

# Optional: Analytics/Monitoring
VITE_ANALYTICS_ID=your-analytics-id
```

**Security Considerations**:
- Never commit `.env` files to version control
- Use platform-specific environment variable management
- Rotate keys regularly
- Use different keys for staging/production

### 2. Platform-Specific Configuration

**Vercel**:
```bash
# Install Vercel CLI
npm i -g vercel

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

**Netlify**:
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Set environment variables via dashboard or CLI
netlify env:set VITE_SUPABASE_URL "your-url"
netlify env:set VITE_SUPABASE_ANON_KEY "your-key"
```

**AWS S3 + CloudFront**:
```bash
# Build application
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## Database Migration

### 1. Migration Files

All migration files are located in `supabase/migrations/`. They must be applied in order:

```bash
# List migration files
ls -la supabase/migrations/

# Example files:
20250928121716_snowy_bar.sql          # Initial schema
20250928143444_fierce_desert.sql      # Employee tables
20250928160622_tender_water.sql       # Leave request tables
20250928160931_crimson_flower.sql     # Policies and balances
20250929162736_fancy_hat.sql          # Notifications
20250929162743_sunny_oasis.sql        # Holidays
20250929162751_restless_base.sql      # Workflow history
20251001143505_polished_voice.sql     # Additional features
20251001144448_scarlet_bridge.sql     # Departments
20251002142957_fancy_stream.sql       # Functions and triggers
20251002183812_silent_bar.sql         # Final optimizations
20251005051945_rapid_salad.sql        # Latest updates
```

### 2. Apply Migrations

**Using Supabase Dashboard**:
1. Go to SQL Editor in Supabase dashboard
2. Copy content from each migration file
3. Execute in chronological order
4. Verify each migration completes successfully

**Using Supabase CLI** (if available):
```bash
# Initialize Supabase locally
supabase init

# Link to remote project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

**Manual Application**:
```sql
-- Example: Apply first migration
-- Copy content from 20250928121716_snowy_bar.sql
-- Paste and execute in SQL Editor

-- Verify migration
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public';
```

### 3. Verify Migration Success

**Check Tables**:
```sql
-- Verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables:
-- departments
-- employee_leave_balances
-- employees
-- holidays
-- leave_policies
-- leave_requests
-- leave_workflow_history
-- notifications
-- users
```

**Check Functions**:
```sql
-- Verify functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Expected functions:
-- set_employee_id
-- update_updated_at
-- validate_leave_request
-- etc.
```

**Check RLS Policies**:
```sql
-- Verify RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Frontend Deployment

### 1. Build Process

**Local Build**:
```bash
# Install dependencies
npm install

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Build for production
npm run build

# Verify build output
ls -la dist/
```

**Build Optimization**:
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable for production
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['lucide-react']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react']
  }
})
```

### 2. Platform Deployment

#### Vercel Deployment

**Automatic Deployment**:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# Deploy to production
vercel --prod
```

**vercel.json Configuration**:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

#### Netlify Deployment

**netlify.toml Configuration**:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
```

#### AWS S3 + CloudFront

**Deployment Script**:
```bash
#!/bin/bash
# deploy.sh

# Build application
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "*.html" \
  --exclude "service-worker.js"

# Upload HTML files with no cache
aws s3 sync dist/ s3://your-bucket-name \
  --cache-control "public, max-age=0, must-revalidate" \
  --include "*.html" \
  --include "service-worker.js"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"

echo "Deployment complete!"
```

## Production Configuration

### 1. Security Headers

**Content Security Policy**:
```html
<!-- In index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               connect-src 'self' https://*.supabase.co;">
```

**Additional Security Headers**:
```javascript
// For Express.js server (if using)
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})
```

### 2. Performance Optimization

**Caching Strategy**:
```nginx
# Nginx configuration
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location ~* \.(html)$ {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

**Compression**:
```nginx
# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/javascript
    application/xml+rss
    application/json;
```

### 3. Monitoring Setup

**Error Tracking**:
```typescript
// Add to main.tsx
import * as Sentry from '@sentry/react'

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: 'your-sentry-dsn',
    environment: 'production'
  })
}
```

**Analytics**:
```typescript
// Add Google Analytics
import { gtag } from 'ga-gtag'

if (import.meta.env.PROD) {
  gtag('config', 'GA_MEASUREMENT_ID')
}
```

## Monitoring & Maintenance

### 1. Health Checks

**Application Health Check**:
```typescript
// src/lib/health.ts
export const healthCheck = async () => {
  try {
    // Test database connection
    const { data, error } = await supabase
      .from('employees')
      .select('count')
      .limit(1)
    
    if (error) throw error
    
    return {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}
```

**Monitoring Dashboard**:
- Supabase Dashboard for database metrics
- Vercel/Netlify analytics for frontend performance
- Custom monitoring for business metrics

### 2. Backup Strategy

**Database Backups**:
```sql
-- Supabase provides automatic backups
-- Additional manual backup
pg_dump -h your-host -U postgres -d your-database > backup.sql
```

**Application Backups**:
- Source code in Git repository
- Environment variables documented
- Configuration files versioned

### 3. Update Process

**Application Updates**:
```bash
# 1. Test in staging environment
npm run build
npm run test

# 2. Deploy to production
vercel --prod

# 3. Verify deployment
curl -f https://your-domain.com/health

# 4. Monitor for issues
# Check error rates and performance metrics
```

**Database Updates**:
```sql
-- Create new migration file
-- Test in staging environment
-- Apply to production during maintenance window
-- Verify data integrity
```

## Troubleshooting

### Common Deployment Issues

#### Build Failures
```bash
# Issue: TypeScript errors
# Solution: Fix type errors
npm run typecheck

# Issue: Missing dependencies
# Solution: Install dependencies
npm install

# Issue: Environment variables
# Solution: Check .env configuration
echo $VITE_SUPABASE_URL
```

#### Database Connection Issues
```typescript
// Issue: Supabase connection fails
// Solution: Verify configuration
const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('count')
      .limit(1)
    
    console.log('Connection test:', { data, error })
  } catch (error) {
    console.error('Connection failed:', error)
  }
}
```

#### Authentication Problems
```typescript
// Issue: Custom auth not working
// Solution: Check user table and policies
const debugAuth = async () => {
  // Check if users table exists
  const { data: users } = await supabase
    .from('users')
    .select('count')
  
  console.log('Users table:', users)
  
  // Check RLS policies
  const { data: policies } = await supabase
    .rpc('get_policies')
  
  console.log('RLS policies:', policies)
}
```

### Performance Issues

#### Slow Database Queries
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_leave_requests_employee_status 
ON leave_requests(employee_id, status);
```

#### Frontend Performance
```typescript
// Use React DevTools Profiler
// Implement lazy loading
const LazyComponent = React.lazy(() => import('./Component'))

// Optimize bundle size
import { specific } from 'library' // Instead of entire library
```

## Scaling Considerations

### Database Scaling

**Supabase Scaling Options**:
- **Free Tier**: 500MB database, 2 CPU cores
- **Pro Tier**: 8GB database, dedicated resources
- **Enterprise**: Custom scaling options

**Optimization Strategies**:
```sql
-- Partitioning for large tables
CREATE TABLE leave_requests_2024 PARTITION OF leave_requests
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Read replicas for reporting
-- Connection pooling
-- Query optimization
```

### Frontend Scaling

**CDN Configuration**:
- Use CloudFront or similar CDN
- Cache static assets globally
- Optimize image delivery

**Code Splitting**:
```typescript
// Route-based code splitting
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'))
const Reports = lazy(() => import('./components/reports/Reports'))

// Component-based splitting
const HeavyComponent = lazy(() => import('./HeavyComponent'))
```

### Monitoring at Scale

**Metrics to Track**:
- Response times
- Error rates
- Database performance
- User engagement
- System resource usage

**Alerting Setup**:
```typescript
// Set up alerts for:
// - High error rates (>5%)
// - Slow response times (>2s)
// - Database connection issues
// - High memory usage (>80%)
```

---

This deployment guide provides comprehensive instructions for deploying Absentra to production. Follow the steps carefully and test thoroughly in a staging environment before deploying to production.

For additional support, refer to the platform-specific documentation and the Absentra troubleshooting guide.