import React from 'react';
import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom';
import Logo from '../../assets/logo.png';
import MenuIcon from '@mui/icons-material/Menu';
import './Header.css'

import Auth from '../../utils/auth';

const Header = () => {
  const [showNavbar, setShowNavbar] = useState(false)

  const handleShowNavbar = () => {
    setShowNavbar(!showNavbar)
  }
  const logout = (event) => {
    event.preventDefault();
    Auth.logout();
    window.location.assign('/');
  };

  return (
    <header className="navbar">
      <div className="container">
        <div className='logo'>
          <NavLink className="text-light" to="/">
            <img src={Logo} height={150} alt="Logo" />
          </NavLink>
        </div>
        <button
          type="button"
          className="menu-icon"
          onClick={handleShowNavbar}
          aria-label={showNavbar ? 'Close navigation' : 'Open navigation'}
          aria-expanded={showNavbar}
          aria-controls="navigation-links"
        >
          <MenuIcon />
        </button>
        <div id="navigation-links" className={`nav-elements  ${showNavbar && 'active'}`}>
          {Auth.loggedIn() ? (
            <ul>
              <li>
                <NavLink className="home" onClick={handleShowNavbar} to="/">
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink onClick={handleShowNavbar} to="/create-profile">
                  {/* {Auth.getProfile().data.firstname}'s profile */}
                  Profile
                </NavLink>
              </li>
              <li>
                <NavLink to="/new-trip" onClick={handleShowNavbar}>
                  Start a New Trip
                </NavLink>
              </li>
              <li>
                <NavLink to="/my-upcoming-trips" onClick={handleShowNavbar}>
                  My trips
                </NavLink>
              </li>
              <li>
                <Link to="/" onClick={logout}>
                  Logout
                </Link>
              </li>
            </ul>
          ) : (
            <div className={`nav-elements  ${showNavbar && 'active'}`}>
              <ul>
                <li>
                  <NavLink className="home" onClick={handleShowNavbar} to="/">
                    Home
                  </NavLink>
                </li>
                <li>
                  <NavLink className="login" onClick={handleShowNavbar} to="/login">
                    Login
                  </NavLink>
                </li>
                <li>
                  <NavLink className="signup" onClick={handleShowNavbar} to="/signup">
                    Signup
                  </NavLink>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
