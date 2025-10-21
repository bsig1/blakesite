import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchUserAttributes , deleteUser} from 'aws-amplify/auth';
import bslogo from "../assets/logo.svg";
import "./Navbar.css";

const Navbar = () => {
    const { authStatus, signOut } = useAuthenticator((ctx) => [ctx.authStatus]);
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState(null);

    // ✅ Fetch the current user's display name or email
    useEffect(() => {
        (async () => {
            if (authStatus === 'authenticated') {
                try {
                    const attrs = await fetchUserAttributes();
                    setDisplayName(
                        attrs.preferred_username ?? attrs.email ?? attrs.sub?.slice(0, 8)
                    );
                } catch (err) {
                    console.error('Failed to fetch user attributes:', err);
                }
            } else {
                setDisplayName(null);
            }
        })();
    }, [authStatus]);

    useEffect(() => {
        if (authStatus !== 'authenticated') {
            const existingGuest = localStorage.getItem('guestName');
            if (existingGuest) {
                setDisplayName(existingGuest);
            } else {
                // generate fun random name
                const adjectives = ['Swift', 'Calm', 'Brave', 'Clever', 'Lucky'];
                const animals = ['Fox', 'Otter', 'Hawk', 'Panda', 'Wolf'];
                const name = `${adjectives[Math.floor(Math.random() * adjectives.length)]}${animals[Math.floor(Math.random() * animals.length)]}${Math.floor(Math.random() * 1000)}`;
                localStorage.setItem('guestName', name);
                setDisplayName(name);
            }
        }
    }, [authStatus]);

    const handleAuthClick = () => {
        if (authStatus === 'authenticated') {
            signOut();
            navigate('/');
        } else {
            navigate('/login');
        }
    };
    async function handleDelete() {
        if (confirm("Are you sure you want to permanently delete your account?")) {
            await deleteUser();
            alert("Your account has been deleted.");
        }
    }
    return (
        <nav>
            <div id="navContainer">
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        isActive ? "nav-link active" : "nav-link"
                    }
                    end
                >
                    <img src={bslogo} alt="logo" id="logo" />
                </NavLink>

                <ul className="navBar">
                    <li className="logoLi">
                        <NavLink
                            to="/projects"
                            className={({ isActive }) =>
                                isActive ? "nav-link active" : "nav-link"
                            }
                        >
                            <div className="button">Projects</div>
                        </NavLink>
                    </li>

                    <li className="logoLi">
                        <NavLink
                            to="/contact"
                            className={({ isActive }) =>
                                isActive ? "nav-link active" : "nav-link"
                            }
                        >
                            <div className="button">Contact</div>
                        </NavLink>
                    </li>
                </ul>

                <div className="authSection">
                    {authStatus === 'authenticated' && displayName && (
                        <span className="username">Hi, {displayName}</span>
                    )}
                    <span id={"account-options"}>
                    <button onClick={handleAuthClick} className="button" id={authStatus === 'authenticated' ? 'signout' : 'login'}>
                        {authStatus === 'authenticated' ? 'Sign Out' : 'Login'}
                    </button>
                    {authStatus === 'authenticated' && (
                        <button onClick={handleDelete} className="button" id="deletebutton">
                            Delete Account
                        </button>
                    )}
                    </span>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
