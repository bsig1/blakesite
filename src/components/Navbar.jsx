import React from 'react';
import { NavLink } from 'react-router-dom';
import bslogo from "../assets/logo.svg";
import "./Navbar.css";

const Navbar = () => {
    return (
        <nav>

            <div id='navContainer'>
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        isActive ? "nav-link active" : "nav-link"
                    }
                    end   // ensures exact match for "/"
                >
                    <img src={bslogo} alt='logo' id="logo" />
                </NavLink>
                <ul className='navBar'>
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
            </div>
        </nav>
    );
};

export default Navbar;
