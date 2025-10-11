import React from 'react';
import {Link} from 'react-router-dom';
import bslogo from "../assets/logo.svg";
import "./Navbar.css"

const Navbar=()=>{
    return (
        <nav>
            <div id='navContainer'>
                <ul className='navBar'>
                    <li className="logoLi">
                        <Link to="/">
                            <img src={bslogo} alt='logo' id="logo"/>
                        </Link>
                    </li>
                    <li className="logoLi">
                        <Link to="/projects" className='nav-link'>
                            <div className='button'>
                                Projects
                            </div>
                        </Link>
                    </li>
                    <li className="logoLi">
                        <Link to="/contact" className='nav-link'>
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