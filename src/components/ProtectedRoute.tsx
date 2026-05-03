import { Navigate, Outlet } from 'react-router-dom';
import {
  dashboardPathFromStoredUser,
  getStoredUserRole,
} from '../lib/dashboardPath';

type Role = 'mentor' | 'student';

type ProtectedRouteProps = {
  /**
   * If provided, only users whose role is in this list may render the child route.
   * Users with a different valid role are redirected to their own dashboard.
   * Users without a stored role are redirected to `/login`.
   */
  allowedRoles?: Role[];
};

/**
 * Wrapper for protected routes. Renders child routes via Outlet, optionally
 * enforcing role-based access. Example: a `student` visiting `/mentor-dashboard`
 * is redirected back to `/student-dashboard`.
 */
function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const role = getStoredUserRole();

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={dashboardPathFromStoredUser()} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
