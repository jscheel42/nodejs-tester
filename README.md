# Node.js Sentry Testing Application

A comprehensive sample application for testing database performance and optional Sentry integration, with intentionally inefficient queries to demonstrate monitoring scenarios.

## Features

### Optional Sentry Integration
- **Error Tracking**: Automatic error capture with custom context
- **Performance Monitoring**: Transaction tracing with custom spans
- **Profiling**: CPU profiling for backend operations
- **Session Replay**: Visual debugging with session recording
- **User Feedback**: Integrated feedback widget
- **Breadcrumbs**: Automatic and custom breadcrumb trails
- **User Context**: Associate errors with specific users

Sentry is disabled by default; set `SENTRY_ENABLED=true` and provide DSNs to enable it.

### Intentionally Slow Queries (for testing)
- **N+1 Queries**: Loading users without eager loading
- **Missing Indexes**: Date range searches without indexes
- **LIKE with Leading Wildcard**: `%query%` pattern searches
- **Cartesian Joins**: Product reports without proper joins
- **Deep Nested Includes**: Orders with full user/product data
- **Memory Intensive**: Large data exports

## Quick Start

### Prerequisites
- Node.js 22+
- PostgreSQL 18 (or Docker)
- Sentry account with DSN (optional)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   cd nodejs-tester
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL
   # Optional: set SENTRY_ENABLED=true and add DSNs to enable Sentry
   ```

3. **Start PostgreSQL** (if not running):
   ```bash
   docker run -d \
     --name postgres-test \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=nodejs_tester \
     -p 5432:5432 \
     postgres:18
   ```

4. **Seed the database:**
   ```bash
   npm run seed          # Small: 100 users, 1k orders (resets DB)
   npm run seed:medium   # Medium: 1k users, 10k orders (appends)
   npm run seed:large    # Large: 100k users, 500k orders (appends)
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. **Open the app:** http://localhost:5173

### Kubernetes Deployment

1. **Build and push the Docker image:**
   ```bash
   ./build-and-push.sh
   ```

2. **Create the namespace and secret:**
   ```bash
   kubectl apply -f k8s/namespace.yaml
   
   # Edit secret.yaml.example with your DB password and optional Sentry DSNs, then:
   cp k8s/secret.yaml.example k8s/secret.yaml
   kubectl apply -f k8s/secret.yaml
   ```

3. **Deploy the application:**
   ```bash
   ./install-k8s.sh
   ```

   Notes:
   - The deployment uses a hostPath volume pinned to node `lima-k-2`.
   - PostgreSQL is exposed to the cluster on `nodejs-tester.nodejs-tester.svc.cluster.local:5432`.
   - `pg_stat_statements` is enabled via Postgres startup flags.

4. **Seed the database in the pod:**
   ```bash
   kubectl exec -it -n nodejs-tester deploy/nodejs-tester -c app -- npm run seed
   ```

5. **Access the app:** https://sentry-test.joshuascheel.com

## Project Structure

```
nodejs-tester/
├── src/
│   ├── client/                 # React frontend
│   │   ├── components/         # React components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── UserList.tsx
│   │   │   ├── OrderHistory.tsx
│   │   │   ├── ProductSearch.tsx
│   │   │   ├── SlowQueryDemo.tsx
│   │   │   └── ErrorDemo.tsx
│   │   ├── api.ts              # API client with Sentry breadcrumbs
│   │   ├── sentry.ts           # Frontend Sentry configuration (optional)
│   │   ├── main.tsx            # React entry point
│   │   ├── App.tsx             # Main app component
│   │   └── App.css             # Styles
│   │
│   ├── server/                 # Express backend
│   │   ├── models/             # Sequelize models
│   │   │   ├── User.ts
│   │   │   ├── Order.ts
│   │   │   ├── OrderItem.ts
│   │   │   ├── Product.ts
│   │   │   ├── Category.ts
│   │   │   └── index.ts
│   │   ├── routes/             # API routes
│   │   │   ├── users.ts        # N+1 queries, slow exports
│   │   │   ├── orders.ts       # Slow search, deep nesting
│   │   │   ├── products.ts     # LIKE queries, cartesian joins
│   │   │   ├── debug.ts        # Error/span testing endpoints
│   │   │   └── index.ts
│   │   ├── db.ts               # Database initialization
│   │   ├── seed.ts             # Faker-based seeding
│   │   ├── sentry.ts           # Backend Sentry configuration (optional)
│   │   ├── instrument.ts       # Sentry instrumentation entry (optional)
│   │   └── index.ts            # Express server
│   │
│   └── shared/
│       └── types.ts            # Shared TypeScript types
│
├── k8s/                        # Kubernetes manifests
│   ├── namespace.yaml
│   ├── deployment.yaml         # App + PostgreSQL sidecar
│   └── secret.yaml.example
│
├── Dockerfile                  # Multi-stage build
├── build-and-push.sh           # Image build/push helper
├── install-k8s.sh              # k8s install helper
├── package.json
├── tsconfig.json               # Frontend TS config
├── tsconfig.node.json          # Backend TS config
├── vite.config.ts              # Vite with API proxy
└── .env.example
```

## API Endpoints

### Users (`/api/users`)
| Endpoint | Method | Description | Performance |
|----------|--------|-------------|-------------|
| `/` | GET | Get all users (N+1) | 🔴 Slow |
| `/paginated` | GET | Get users with pagination | 🟢 Fast |
| `/:id` | GET | Get single user | 🟢 Fast |
| `/:id/orders` | GET | Get user orders (N+1) | 🔴 Slow |
| `/:id/orders-optimized` | GET | Get user orders (optimized) | 🟢 Fast |
| `/search/by-date` | GET | Search by date range (no index) | 🔴 Slow |
| `/export/all` | GET | Export all users | 🔴 Very Slow |

### Orders (`/api/orders`)
| Endpoint | Method | Description | Performance |
|----------|--------|-------------|-------------|
| `/` | GET | Get orders with pagination | 🟢 Fast |
| `/search` | GET | Search orders (slow) | 🟡 Medium |
| `/:id` | GET | Get single order | 🟢 Fast |
| `/:id/full` | GET | Get order with deep nesting | 🔴 Slow |
| `/report/daily` | GET | Daily aggregation report | 🔴 Slow |
| `/` | POST | Create new order | 🟢 Fast |

### Products (`/api/products`)
| Endpoint | Method | Description | Performance |
|----------|--------|-------------|-------------|
| `/` | GET | Get products with pagination | 🟢 Fast |
| `/search` | GET | Search with LIKE | 🔴 Slow |
| `/report` | GET | Product report (cartesian) | 🔴 Very Slow |
| `/report-optimized` | GET | Product report (optimized) | 🟢 Fast |
| `/categories` | GET | Get all categories | 🟢 Fast |
| `/:id` | GET | Get single product | 🟢 Fast |

### Debug (`/api/debug`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with Sentry status |
| `/error` | POST | Trigger a backend error |
| `/unhandled` | POST | Trigger unhandled promise rejection |
| `/slow` | GET | Slow endpoint with custom spans |
| `/memory` | GET | Memory-intensive operation |
| `/message` | POST | Send custom Sentry message |
| `/breadcrumbs` | POST | Test breadcrumb creation |
| `/user-context` | POST | Test user context |
| `/transaction` | GET | Test custom transaction |

## Testing Workflows

### 1. Compare Slow vs Fast Queries
Navigate to **Slow Queries** page and click:
- "N+1 (Slow)" vs "Paginated (Fast)" for users
- "Cartesian (Slow)" vs "Optimized (Fast)" for product reports

### 2. Test Error Tracking (when Sentry enabled)
Navigate to **Error Tests** page and:
- Trigger backend errors (Error, TypeError, ReferenceError)
- Trigger frontend errors (caught and uncaught)
- Send custom messages at various levels

### 3. Test User Context
In **Error Tests** page:
1. Fill in user details
2. Click "Set User"
3. Trigger an error
4. Check Sentry - error should be associated with the user

### 4. View Session Replay (when Sentry enabled)
1. Navigate around the app
2. Trigger an error
3. In Sentry, view the session replay to see what the user did

### 5. Test Performance Monitoring (when Sentry enabled)
1. Run slow queries from **Slow Queries** page
2. Check Sentry Performance for transaction traces
3. View spans to see database query timing

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `POSTGRES_PASSWORD` | Postgres password | Required (k8s) |
| `SENTRY_ENABLED` | Toggle Sentry on/off | `false` |
| `SENTRY_DSN` | Sentry DSN (backend) | Optional |
| `SENTRY_ENVIRONMENT` | Sentry environment tag | `development` |
| `SENTRY_RELEASE` | Sentry release tag | `nodejs-tester@1.0.0` |
| `VITE_SENTRY_DSN` | Sentry DSN (frontend) | Optional |
| `VITE_SENTRY_ENVIRONMENT` | Frontend environment | `development` |
| `VITE_SENTRY_RELEASE` | Frontend release | `nodejs-tester@1.0.0` |
| `VITE_SENTRY_ENABLED` | Frontend Sentry toggle (fallback) | `false` |
| `SEED_SIZE` | Seeding size (small/medium/large) | `small` |
| `SEED_RESET` | Drop tables before seeding | `true` |
| `SEED_RUN_ID` | Seed run identifier for uniqueness | Timestamp |
| `NODE_OPTIONS` | Node runtime flags | Optional |
| `K8S_*` | Kubernetes context (Downward API) | Auto-populated |

## Scripts

```bash
npm run dev           # Start dev server (frontend + backend)
npm run dev:client    # Start Vite dev server only
npm run dev:server    # Start Express dev server only
npm run build         # Build for production
npm run start         # Start production server
npm run seed          # Seed with small dataset
npm run seed:medium   # Seed with medium dataset
npm run seed:large    # Seed with large dataset
```

## License

MIT
