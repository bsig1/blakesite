// src/auth/RequireAuth.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';

export default function RequireAuth({ children}) {
    const { authStatus } = useAuthenticator();
    const location = useLocation();

    // gate
    if (authStatus !== 'authenticated') {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }
    return children;
}
