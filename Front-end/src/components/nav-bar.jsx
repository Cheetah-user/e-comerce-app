import React from "react";
import { useNavigate, Link } from "react-router-dom";
import './nav-bar.css';
import { useState, useEffect } from "react";

function Navbar() {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    
    const checkLoginState = () => {
        const token = localStorage.getItem('token');
        setIsLoggedIn(!!token); 
    };

    useEffect(() => {
        checkLoginState();
        window.addEventListener('authChange', checkLoginState);
        return () => {
          window.removeEventListener('authChange', checkLoginState);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token'); //Clears the JWT token
        setIsLoggedIn(false);
        navigate('/login'); //Redirects to login page
    };

    return (
      <nav className="navbar">
        <div className="navbar-logo">
            <Link to='/'>🛍️ Store</Link>
        </div>
        <ul className="navbar-links">
            <li><Link to='/products'>Products</Link></li>
            <li><Link to='/cart'>Cart</Link></li>
            {isLoggedIn ?(
                <>
                  <li className="navbar-item-user">Welcome!</li>
                   <li>
                     <button onClick={handleLogout} className="logoutbtn">
                        Sign Out
                     </button>
                   </li>
                </>
            ): (
                <>
                  <li><Link to='/login'>Log In</Link></li>
                  <li><Link to='/registration' className='register-btn'>Register</Link></li>
                </>
            )
            }
        </ul>
      </nav>
    );
}
export default Navbar;
