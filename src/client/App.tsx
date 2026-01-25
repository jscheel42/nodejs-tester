import { Routes, Route, NavLink } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { isSentryEnabled } from './sentry';
import Dashboard from './components/Dashboard';
import UserList from './components/UserList';
import OrderHistory from './components/OrderHistory';
import ProductSearch from './components/ProductSearch';
import SlowQueryDemo from './components/SlowQueryDemo';
import ErrorDemo from './components/ErrorDemo';

function App() {
  const SentryRoutes = isSentryEnabled() ? Sentry.withSentryReactRouterV6Routing(Routes) : Routes;
  return (
    <div className="app">
      <header className="app-header">
        <h1>Sentry Test App</h1>
        <nav className="app-nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/users">Users</NavLink>
          <NavLink to="/orders">Orders</NavLink>
          <NavLink to="/products">Products</NavLink>
          <NavLink to="/slow-queries">Slow Queries</NavLink>
          <NavLink to="/errors">Error Tests</NavLink>
        </nav>
      </header>

      <main className="app-main">
        <SentryRoutes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<UserList />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/products" element={<ProductSearch />} />
          <Route path="/slow-queries" element={<SlowQueryDemo />} />
          <Route path="/errors" element={<ErrorDemo />} />
        </SentryRoutes>
      </main>

      <footer className="app-footer">
        <p>Sentry Integration Testing Application</p>
      </footer>
    </div>
  );
}

export default App;
