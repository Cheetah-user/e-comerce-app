import React from "react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import './cart.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
function Cart() {
   const navigate = useNavigate();
   const [cartId, setCartId] = useState(null);
   const [cartItems, setCartItems] = useState([]);
   const [cartTotal, setCartTotal] = useState("0.00");
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState('');

   const token = localStorage.getItem('token');

   useEffect (() => {
    //Redirects user to login if they are not already
     if(!token){
        navigate('/login');
        return;
     }
     
     const initializeAndFetchCart = async () => {
       try {
       // Hit our new route which will never write dummy 0 values
       const initRes = await fetch(`${API_BASE_URL}/carts/mine`, {
           method: 'GET',
           headers: {
               'Authorization': `Bearer ${token}` 
           }
       });

       if(!initRes.ok) throw new Error('Failed to synchronize cart with server');
       const initData = await initRes.json();
       
       // Grabs the clean cartId property from the response
       const activeCartId = initData.cartId;
       setCartId(activeCartId);
        
       // Now this fetch is completely isolated from race conditions
       await fetchCartDetails(activeCartId);

     } catch(err) {
      setError(err.message);
     } finally {
       setLoading(false);
    }
     };
     initializeAndFetchCart();
   }, [token, navigate]);

   const fetchCartDetails = async (id) => {
    const response = await fetch(`${API_BASE_URL}/carts/${id}`, {
        headers: {'Authorization': `Bearer ${token}`}
    });
    const data = await response.json();
    setCartItems(data.items || []);
    setCartTotal(data.total || "0.00");
   };

   const handleDecreaseQuantity = async (productId) => {
    try{
        const response = await fetch(`${API_BASE_URL}/carts/${cartId}/items/${productId}`, {
            method: 'DELETE',
            headers: {'Authorization': `Bearer ${token}`}
        });

        if(response.ok){
            await fetchCartDetails(cartId);
        }
        window.dispatchEvent(new Event('authChange'));
    }catch(err){
        console.error('Error modifying item quantity');
    }
   };

   const handleIncrement = async (productId, currentQuantity) => {
     const token = localStorage.getItem('token');
     try{
        const response = await fetch(`${API_BASE_URL}/carts/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                productId: productId,
                quantity: 1
            })
        });

        if(!response.ok){
            throw new Error('Could not update successfully');
        }
        
        if(cartId){
            await fetchCartDetails(cartId);
        }
        window.dispatchEvent(new Event('authChange'));
     }catch(err){
        alert(err.message || 'Something went wrong');
     }
   }

   const handleClearCart = async () => {
     try{
       const response = await fetch(`${API_BASE_URL}/carts/${cartId}`, {
        method: 'DELETE',
        headers: {'Authorization': `Bearer ${token}`}
       });

       if(response.ok){
        setCartItems([]);
        setCartTotal("0.00");
       }
       window.dispatchEvent(new Event('authChange'));
     }catch(err){
       console.error('Error clearing cart:', err);
     }
   };

   if(loading) return <div className="cart-loader">Loading...</div>;
   if(error) return <div className="cart-error">{error}</div>;

   return(
    <div className="cart-container">
        <h2>🛒 Shopping Cart</h2>
        {cartItems.length === 0 ? (
            <div className="empty-cart-view">
                <p>Your shopping cart is currently empty</p>
                <button onClick={() => navigate('/products')} className="shop-btn">
                    Go Shopping
                </button>
            </div>
        ): (
            <div className="cart-wrapper">
                <div className="cart-items-section">
                    <button onClick={handleClearCart} className="clear-cart-btn">
                      Clear All Items
                    </button>
                    
                    {cartItems.map((item) => (
                        <div key={item.product_id} className="cart-item-card">
                            <div className="cart-item-details">
                                <h3>{item.name}</h3>
                                <p className="cart-item-desc">{item.description}</p>
                                <p className="cart-item-price">${parseFloat(item.price).toFixed(2)} each</p>
                            </div>
                            <div className="cart-item-actions">
                                <div className="quantity-controls">
                                    <button onClick={() => handleDecreaseQuantity(item.product_id)}>-</button>
                                    <span>{item.quantity}</span>
                                    <button className="quantity-btn-plus" onClick={() => handleIncrement(item.product_id, item.quantity)}>+</button>
                                </div>
                                <span className="item-subtotal">${parseFloat(item.subtotal).toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="cart-summary-section">
                    <h3>Order Summary</h3>
                    <div className="summary-row">
                        <span>Subtotal</span>
                        <span>${cartTotal}</span>
                    </div>
                    <div className="summary-row">
                        <span>Shipping</span>
                        <span style={{color: 'green', fontWeight: 'bold'}}>FREE</span>
                    </div>
                    <hr />
                    <div className="summary-row total-row">
                        <span>Total</span>
                        <span>${cartTotal}</span>
                    </div>
                    <button className="checkout-btn" onClick={() => navigate('/checkout')}>
                        Proceed to Checkout
                    </button>
                </div>

            </div>
        )}

    </div>
   );
};

export default Cart;