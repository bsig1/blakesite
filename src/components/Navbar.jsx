import React from 'react';
import {Link} from 'react-router-dom';
import bslogo from "../assets/logo.svg";
import "./Navbar.css"

const Navbar=()=>{
    return (
        <nav>
            <div id='navContainer'>
                <ul className='navBar'>
                    <li id="logoLi">
                        <Link to="/">
                            <img src={bslogo} alt='logo' id="logo"/>
                        </Link>
                    </li>
                    <li id="logoLi">
                        <Link to="/Projects" className='nav-link'>
                            <div className='button'>
                                Projects
                            </div>
                        </Link>
                    </li>
                    <li className='Contact'>
                        <Link to="/Contact" className='nav-link'>
                            <div className='button'>
                                Contact
                            </div>
                        </Link>
                    </li>

                </ul>
            </div>
        </nav>
    )

}

export default Navbar;