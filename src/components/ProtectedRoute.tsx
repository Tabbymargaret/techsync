import { Outlet } from 'react-router-dom';

/**
 * Wrapper for protected routes. Renders child routes via Outlet.
 * Auth guard (e.g. redirect to /login) can be added here later.
 */
function ProtectedRoute() {
  return <Outlet />;
}

export default ProtectedRoute;
