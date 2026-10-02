import { useAuth } from "../context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    // Define role hierarchy - higher roles can access routes requiring lower roles
    const roleHierarchy: { [key: string]: string[] } = {
      'hr': ['hr', 'assessor', 'employee'], // HR can access HR, assessor, and employee routes
      'assessor': ['assessor', 'employee'],  // Assessors can access assessor and employee routes
      'employee': ['employee']               // Employees can only access employee routes
    };

    // Check if user has any role that grants access to the required roles
    const hasAllowedRole = user.roles.some(userRole => {
      // Get all roles this user role has access to
      const accessibleRoles = roleHierarchy[userRole] || [userRole];
      // Check if any of the allowed roles are in the accessible roles
      return allowedRoles.some(allowedRole => accessibleRoles.includes(allowedRole));
    });

    if (!hasAllowedRole) {
      // Redirect to appropriate route based on user's role
      if (user.roles.includes('hr')) {
        return <Navigate to="/dashboard" replace />;
      } else if (user.roles.includes('assessor')) {
        return <Navigate to="/dashboard" replace />;
      } else {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  return <>{children}</>;
}