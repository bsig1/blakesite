import {ThemeProvider, Authenticator, createTheme, useAuthenticator} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import {useEffect} from "react";
import {useLocation, useNavigate} from "react-router-dom";

const darkTheme = createTheme({
    name: 'blake-dark',
    overrides: [
        {
            colorMode: 'dark',
            tokens: {
                colors: {
                    background: {
                        primary: { value: '#0e1117' },   // page/card backgrounds
                        secondary: { value: '#161b22' }, // inputs/sections
                    },
                    font: {
                        primary: { value: '#e6edf3' },
                        secondary: { value: '#aab4c8' },
                    },
                    border: {
                        primary: { value: '#2b3440' },
                    },
                    brand: {
                        primary: { 80: '#5aa9e6', 90: '#89cff0' },
                    },
                },
                radii: { medium: '12px' },
            },
        },
    ],
});

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname ?? '/'; // fallback redirect
    const { authStatus } = useAuthenticator();
    useEffect(() => {
        if (authStatus === 'authenticated') {
            navigate(from, { replace: true });
        }
    }, [authStatus, from, navigate]);

    if (authStatus === 'authenticated') return null;

    return (
        <ThemeProvider colorMode="dark" theme={darkTheme}>
            <div style={{ maxWidth: 420, margin: '48px auto' }}>
                <Authenticator
                    loginMechanisms={['email']}
                    signUpAttributes={['email','preferred_username']}
                    formFields={{
                        signIn: {
                            username: { label: 'Email', placeholder: 'you@example.com' },
                        },
                        signUp: {
                            preferred_username: { label: 'Username (display name)' },
                        },
                    }}
                />
            </div>
        </ThemeProvider>
    );
}