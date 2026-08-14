import React from "react";
import { useNavigate, Link } from "react-router-dom";
import './nav-bar.css';
import { useState, useEffect } from "react";

function Navbar() {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [cartCount, setCartCount] = useState(0);

    const checkStatusAndCart = async () => {
      const token = localStorage.getItem('token');
      setIsLoggedIn(!!token);

      if(!token) {
        setCartCount(0);
        return;
      }

      try{
        //Gets the current user's cart
        const initRes = await fetch('http://localhost:3000/carts/mine', {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if(!initRes.ok) return;
        const initData = await initRes.json();
        
        //Fetch cart content using cart id
        const cartRes = await fetch(`http://localhost:3000/carts/${initData.cartId}`, {
          headers: {'Authorization': `Bearer ${token}`}
        });
        if(!cartRes.ok) return;
        const cartData = await cartRes.json();

        //Sum up amount of individual items 
        const totalItems = (cartData.items || []).reduce((sum, item) => sum + item.quantity, 0);
        setCartCount(totalItems);
      }catch(err){
        console.error('Error updating navbar cart badge:', err);
      }
    };

    useEffect(() => {
        checkStatusAndCart();
        window.addEventListener('authChange', checkStatusAndCart);
        return () => {
          window.removeEventListener('authChange', checkStatusAndCart);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token'); //Clears the JWT token
        setIsLoggedIn(false);
        setCartCount(0);
        window.dispatchEvent(new Event('authChange'));
        navigate('/login'); //Redirects to login page
    };

    return (
      <nav className="navbar">
        <div className="navbar-logo">
            <Link to='/'>🛍️ Store</Link>
        </div>
        <ul className="navbar-links">
            <li><Link to='/'>Home</Link></li>
            <li><Link to='/products'>Products</Link></li>
            <li><Link to='/cart' className="navbar-cart-link">
              🛒 Cart {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </Link></li>
            
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
