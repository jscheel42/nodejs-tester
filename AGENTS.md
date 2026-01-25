# AGENTS

## Update npm packages
- npx npm-check-updates -u

# Session Summary: nodejs-tester Performance Testing Application

## Overview

This is a comprehensive performance testing application built with Express + React that demonstrates optional Sentry features. The app intentionally includes inefficient queries and various error scenarios to showcase monitoring capabilities when Sentry is enabled.

## What Was Built

### Project Architecture
- **Single package structure** - Frontend and backend in one repository
- **Stack**: Express 5 + Sequelize 6 + React 19 + Vite + TypeScript
- **Database**: PostgreSQL 18 (via Docker or sidecar in k8s)
- **Testing**: Faker.js for realistic test data generation
- **Deployment**: Docker + Kubernetes with Traefik ingress

### Files Created During This Session

#### React Frontend (`src/client/`)
- `main.tsx` - React entry with Sentry ErrorBoundary wrapper
- `App.tsx` - Main app with React Router + Sentry routing instrumentation
- `App.css` - Complete CSS styling with Sentry purple theme and responsive design
- `sentry.ts` - Frontend Sentry config (replay, feedback widget, browser tracing)
- `api.ts` - API client with automatic Sentry breadcrumbs for all requests

#### React Components (`src/client/components/`)
- **Dashboard.tsx** - Main dashboard with health status, quick links, Sentry feature overview
- **UserList.tsx** - Toggle between paginated (fast) vs unpaginated (slow N+1) user loading
- **OrderHistory.tsx** - Order search with filters, slow/missing index queries, daily reports
- **ProductSearch.tsx** - Product search with LIKE queries, slow/fast report comparison
- **SlowQueryDemo.tsx** - Run performance tests, compare slow vs fast implementations
- **ErrorDemo.tsx** - Trigger errors, messages, breadcrumbs, user context, custom transactions

#### Deployment & Configuration
- `Dockerfile` - Multi-stage build (Node 22 Alpine) with health checks
- `build-and-push.sh` - Image build/push helper
- `install-k8s.sh` - k8s install helper (forces rollout restart)
- `k8s/namespace.yaml` - Kubernetes namespace definition
- `k8s/deployment.yaml` - App + PostgreSQL 18 sidecar, hostPath volume, nodeSelector `k-1`, Recreate strategy, pg_stat_statements, Postgres Service on 5432
- `k8s/secret.yaml.example` - Template for Sentry DSN and Postgres password
- `.env.example` - All environment variables with documentation
- `README.md` - Complete documentation with API reference and testing workflows

### Previous Work (Already Existed)
- Express server with Sentry profiling integration
- Sequelize models: User, Order, OrderItem, Product, Category
- API routes with intentionally inefficient queries
- Database seeding script with configurable data sizes
- TypeScript configs, Vite configuration, package.json

## Sentry Features Demonstrated

### Error Tracking
- **Backend**: Automatic error capture, custom error context, different error types
- **Frontend**: Error boundaries, caught/uncaught errors, error context
- **User Context**: Associate errors with specific users
- **Feedback Widget**: Bottom-right corner for user-submitted bug reports

### Performance Monitoring
- **Transaction Tracing**: API requests with automatic spans
- **Custom Spans**: Manual span creation for complex operations
- **Database Queries**: Timing for all database operations
- **Profiling**: Backend CPU profiling for deep performance analysis

### Session Replay
- Visual debugging with full session recording
- Configurable masking for privacy (disabled for testing)
- Automatic capture on errors

### Breadcrumbs
- **Automatic**: HTTP requests, console logs, navigation
- **Custom**: Manual breadcrumb creation for app-specific events
- **Rich Context**: Include timing, data, and user information

### Kubernetes Integration
- **Downward API**: Automatic tagging with pod/node information
- **Sidecar Architecture**: PostgreSQL 18 running alongside application
- **Persistent HostPath**: Data stored on node `k-1` with `Recreate` strategy
- **pg_stat_statements**: Enabled via Postgres startup flags
- **Health Checks**: Liveness and readiness probes

## Intentional Performance Issues

### Database Query Problems
1. **N+1 Queries** - Users loading without eager loading
2. **Missing Indexes** - Date range searches without proper indexing
3. **LIKE with Leading Wildcards** - `%query%` pattern searches
4. **Cartesian Joins** - Product reports without proper joins
5. **Deep Nested Includes** - Orders loading full user+product hierarchies
6. **Memory Intensive** - Large data exports to test memory profiling

### Frontend Performance
- Large data tables without virtualization
- Synchronous operations that block UI
- Inefficient re-renders to test React Profiler

## Environment Variables

### Required Variables
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_PASSWORD` - Postgres password (k8s secret)

### Optional Variables
- `SENTRY_ENABLED` - Toggle Sentry on/off
- `SENTRY_DSN` - Backend Sentry DSN
- `VITE_SENTRY_DSN` - Frontend Sentry DSN
- `SENTRY_ENVIRONMENT` - Environment tag (development/staging/production)
- `SENTRY_RELEASE` - Release tag for version tracking
- `SEED_SIZE` - Database seeding size (small/medium/large)
- `SEED_RESET` - Drop tables before seeding (default true)
- `SEED_RUN_ID` - Seed run identifier for uniqueness
- `K8S_*` - Kubernetes context (auto-populated via Downward API)

## Testing Scenarios

### Performance Testing
1. **Slow vs Fast Comparison** - Use "Slow Queries" page
2. **Load Testing** - Generate large datasets with `npm run seed:large`
3. **Memory Profiling** - Trigger memory-intensive operations
4. **Database Analysis** - View query timing in Sentry Performance

### Error Testing
1. **Error Types** - Trigger Error, TypeError, ReferenceError
2. **User Context** - Set user and trigger errors
3. **Unhandled Rejections** - Test promise rejection handling
4. **Frontend Errors** - Test caught vs uncaught errors
5. **Custom Messages** - Send info/warning/error messages

### Session Replay Testing
1. **User Journey** - Navigate through multiple pages
2. **Error Flow** - Trigger error and observe replay context
3. **Feedback Widget** - Submit user feedback

## Development Workflows

### Local Development
```bash
cd nodejs-tester
npm install
cp .env.example .env  # Add DB URL, optionally enable Sentry
# Start PostgreSQL (Docker or local)
npm run seed          # Seed database
npm run dev           # Start dev servers
```

### Kubernetes Deployment
```bash
# Build and push image
./build-and-push.sh

# Deploy to k8s
kubectl apply -f k8s/namespace.yaml
cp k8s/secret.yaml.example k8s/secret.yaml  # Add your DB password and optional Sentry DSNs
kubectl apply -f k8s/secret.yaml
./install-k8s.sh

# Seed database in pod
kubectl exec -it -n nodejs-tester deploy/nodejs-tester -c app -- npm run seed
```

## Testing Guidelines for Future Work

### When Adding New Features
1. **If Sentry enabled, include breadcrumbs** for all user interactions
2. **If Sentry enabled, add custom spans** for complex operations
3. **If Sentry enabled, set user context** when relevant
4. **Test both slow and fast implementations** for performance comparison
5. **Trigger errors intentionally** to verify error handling

### When Debugging Issues
1. **Check Sentry dashboard** for error events and traces
2. **Review session replays** to understand user journeys
3. **Analyze performance traces** for slow operations
4. **Look at breadcrumb trails** for debugging context
5. **Check user context** for attribution

### Performance Optimization
1. **Use SlowQueryDemo page** to test query optimizations
2. **Compare transaction traces** before and after changes
3. **Monitor memory usage** during large operations
4. **Check database query timing** in Sentry performance

## Key Design Decisions

### Architecture
- **Single Package**: Frontend and backend in one repository for simplicity
- **Sidecar Database**: PostgreSQL runs in same pod with hostPath storage pinned to node `k-1`
- **Vite Proxy**: Frontend dev server proxies API calls to backend
- **Sequelize ORM**: User's choice over Prisma, provides SQL visibility

### Sentry Integration
- **Optional by default**: `SENTRY_ENABLED=false` unless explicitly enabled
- **100% Sampling**: High sampling rates for comprehensive testing
- **All Integrations**: Error tracking, performance, replay, feedback, profiling
- **Rich Context**: Automatic k8s pod information and user context
- **Manual Instrumentation**: Custom spans and breadcrumbs for key operations

### Testing Strategy
- **Intentional Inefficiency**: Deliberate performance issues for demonstration
- **Configurable Data Sizes**: Small/medium/large datasets for different testing scenarios
- **Multiple Error Types**: Different error types to test Sentry categorization
- **Performance Comparison**: Side-by-side slow vs fast implementations

## Common Issues & Solutions

### Database Connection Issues
- **Local Dev**: Ensure PostgreSQL is running on port 5432
- **Kubernetes**: PostgreSQL sidecar takes time to start, app may need retry logic
- **HostPath Storage**: Pod must remain on node `k-1` to keep data

### Sentry Not Capturing
- **Enabled**: Set `SENTRY_ENABLED=true` and provide DSNs
- **Check DSN**: Verify both backend and frontend DSNs are set correctly
- **Environment**: Ensure environment variables are properly passed in k8s
- **Sampling**: Check sampling rates (set to 1.0 for testing)

### Slow Performance in K8s
- **Resource Limits**: App now requests 768Mi and limits 1Gi memory
- **PostgreSQL Sidecar**: Shared resources can cause performance issues

### Frontend Build Issues
- **Dependencies**: All dependencies listed in package.json, run `npm ci` if issues
- **TypeScript**: Check tsconfig.json settings for proper module resolution

## Next Steps / Future Enhancements

### Potential Improvements
1. **Database Optimization**: Add proper indexes to fix slow queries
2. **Authentication**: Add user login system for better user context testing
3. **API Versioning**: Support multiple API versions for testing upgrade scenarios
4. **Load Testing**: Integration with k6 or similar for stress testing
5. **Monitoring Dashboards**: Grafana dashboards for app-specific metrics
6. **Alerting**: Sentry alerts for specific error patterns or performance issues

### Testing Enhancements
1. **E2E Tests**: Playwright or Cypress tests for user workflows
2. **Performance Tests**: Automated performance regression testing
3. **Security Testing**: OWASP ZAP or similar security scanning
4. **Chaos Engineering**: Chaos Mesh integration for resilience testing

## Contact & Context

This application is part of the k3s lab environment and serves as a comprehensive testing ground for Sentry features. It's designed to be both a learning tool and a practical example of Sentry integration in a modern Node.js application.

The deployment target is the Lima k3s cluster with Traefik ingress at `sentry-test.joshuascheel.com`.

---

**Last Updated**: 2026-01-25  
**Status**: Complete - All features implemented and tested
