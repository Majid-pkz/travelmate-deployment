import React from 'react';
import { Link } from 'react-router-dom';
import { FaGithub } from 'react-icons/fa';

import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="row">
          <div className="col-md-4">
            <h3 className="footer-section-title">About TravelMate</h3>
            <p className="footer-section-content">
              Find travel companions, plan a trip, and share your next adventure.
            </p>
          </div>
          <div className="col-md-4">
            <h3 className="footer-section-title">Explore</h3>
            <p className="footer-section-content"><Link to="/">Home</Link></p>
            <p className="footer-section-content"><Link to="/login">Log in</Link></p>
            <p className="footer-section-content"><Link to="/signup">Sign up</Link></p>
          </div>
          <div className="col-md-4">
            <h3 className="footer-section-title">Project</h3>
            <p className="footer-section-content">
              <a href="https://github.com/Majid-pkz/travelmate-deployment">
                <FaGithub className="footer-icon" aria-hidden="true" /> View source on GitHub
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
