import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode'; 
import './checkout.css';

function Checkout() {
    const navigate = useNavigate();
    const [cartItems, setCartItems] = useState([]);
    const [cartTotal, setCartTotal] = useState("0.00");
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phoneNumber: '',
        address: '',
        city: '',
        zipCode: '',
        paymentMethod: 'Credit Card'
    });

    useEffect(() => {
        const fetchCheckoutAndProfile = async () => {
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }

            try {
                
                const decoded = jwtDecode(token);
                const currentUserId = decoded.id;

                
                const profileRes = await fetch(`http://localhost:3000/customers/${currentUserId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    const cleanValue = (val) => {
                        if(!val || val === 'NA' || val === 'null') return '';
                        return val;
                    };
                    setFormData(prev => ({
                        ...prev,
                        fullName: profileData.username || '',
                        email: profileData.email || '',
                        phoneNumber: profileData.phone_number || '', 
                        address: profileData.address || '',          
                        city: profileData.city || '',
                        country: profileData.country || ''                
                    }));
                }

                
                const initRes = await fetch('http://localhost:3000/carts/mine', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!initRes.ok) throw new Error();
                const initData = await initRes.json();

                const cartRes = await fetch(`http://localhost:3000/carts/${initData.cartId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!cartRes.ok) throw new Error();
                const cartData = await cartRes.json();
                
                if (!cartData.items || cartData.items.length === 0) {
                    alert("Your cart is currently empty!");
                    navigate('/products');
                    return;
                }

                setCartItems(cartData.items);
                setCartTotal(cartData.total || "0.00");
            } catch (err) {
                console.error("Error setting up checkout view:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCheckoutAndProfile();
    }, [navigate]);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        const token = localStorage.getItem('token');

        try {
            
            const decoded = jwtDecode(token);
            const currentUserId = decoded.id;

            const updateProfileResponse = await fetch(`http://localhost:3000/customers/${currentUserId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    phone_number: formData.phoneNumber,
                    address: formData.address,
                    city: formData.city,
                    country: formData.country
                })
            })
          
            const response = await fetch('http://localhost:3000/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ paymentMethod: formData.paymentMethod })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Transaction failed.');

            alert(`🎉 ${data.message}!\nOrder Reference: ID-${data.orderId}`);
            window.dispatchEvent(new Event('authChange'));
            navigate('/');
        } catch (err) {
            alert(err.message || 'Something went wrong during checkout.');
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return <div className="checkout-loading-screen">Securing checkout parameters...</div>;

    return (
        <div className="checkout-page-container">
            <h2 className="checkout-page-title">Secure Checkout</h2>
            <div className="checkout-split-grid">
                
                <form className="checkout-billing-form" onSubmit={handleFormSubmit}>
                    <div className="form-section-header">Shipping Information</div>
                    <input type="text" name="fullName" placeholder="Full Name" required value={formData.fullName} onChange={handleInputChange} />
                    <input type="email" name="email" placeholder="Email Address" required value={formData.email} onChange={handleInputChange} />
                    <input type="text" name="phoneNumber" placeholder="Phone Number" value={formData.phoneNumber} onChange={handleInputChange} />
                    <input type="text" name="address" placeholder="Street Address" required value={formData.address} onChange={handleInputChange} />
                    
                    <div className="form-double-row">
                        <input type="text" name="city" placeholder="City" required value={formData.city} onChange={handleInputChange} />
                        <input type="text" name="country" placeholder="Country" required value={formData.country} onChange={handleInputChange}/>
                        <input type="text" name="zipCode" placeholder="ZIP Code" required value={formData.zipCode} onChange={handleInputChange} />
                    </div>

                    <div className="form-section-header">Payment Option Selection</div>
                    <select name="paymentMethod" className="payment-select-dropdown" value={formData.paymentMethod} onChange={handleInputChange}>
                        <option value="Credit Card">💳 Credit / Debit Card</option>
                        <option value="PayPal">🅿️ PayPal Account Transfer</option>
                        <option value="Crypto">🪙 Bitcoin Wallet Address</option>
                    </select>

                    <button type="submit" className="finalize-checkout-btn" disabled={isProcessing}>
                        {isProcessing ? 'Authorizing Payment...' : `Pay $${cartTotal}`}
                    </button>
                </form>

                <div className="checkout-summary-sidebar">
                    <h3 className="sidebar-summary-title">Review Items Bag</h3>
                    <div className="sidebar-items-scrollbox">
                        {cartItems.map((item) => (
                            <div key={item.product_id} className="sidebar-product-row">
                                <div className="sidebar-item-details">
                                    <span className="sidebar-item-name">{item.name}</span>
                                    <span className="sidebar-item-qty">Qty: {item.quantity}</span>
                                </div>
                                <span className="sidebar-item-price">${parseFloat(item.price).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                    <hr className="summary-card-divider" />
                    <div className="summary-calc-row"><span>Subtotal:</span> <span>${cartTotal}</span></div>
                    <div className="summary-calc-row"><span>Est. Shipping:</span> <span className="green-shipping-text">FREE</span></div>
                    <hr className="summary-card-divider" />
                    <div className="summary-calc-row ultimate-total"><span>Grand Total:</span> <span>${cartTotal}</span></div>
                </div>

            </div>
        </div>
    );
}

export default Checkout;