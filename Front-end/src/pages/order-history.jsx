import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './order-history.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
function OrderHistory() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [emptyMessage, setEmptyMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPastOrders = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            try {
                
                const response = await fetch(`${API_BASE_URL}/orders`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Could not pull order archives');
                const data = await response.json();
                
                
                if (data.message) {
                    setEmptyMessage(data.message);
                } else {
                    setOrders(data);
                }
            } catch (err) {
                console.error("Error loading order logs:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPastOrders();
    }, [navigate]);

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    if (loading) return <div className="history-loading">Retrieving past order logs...</div>;

    return (
        <div className="history-page-container">
            <h2 className="history-main-title">Your Purchase History</h2>
            
            {(emptyMessage || orders.length === 0) ? (
                <div className="empty-history-card">
                    <p>{emptyMessage || "You haven't placed any orders yet."}</p>
                    <button onClick={() => navigate('/products')} className="start-shopping-btn">
                        Explore Products Catalog
                    </button>
                </div>
            ) : (
                <div className="orders-history-list">
                   
                    {orders.map((order, index) => (
                        <div key={index} className="order-history-card">
                            
                            
                            <div className="order-card-header">
                                <div>
                                    <span className="meta-label">ORDER PLACED</span>
                                    <span className="meta-val">{formatDate(order.order_date)}</span>
                                </div>
                                <div>
                                    <span className="meta-label">TOTAL AMOUNT</span>
                                    <span className="meta-val-price">${parseFloat(order.total_amount).toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="meta-label">STATUS</span>
                                    <span className={`status-pill ${order.status}`}>{order.status}</span>
                                </div>
                            </div>

                            
                            <div className="order-card-body">
                                <h4 className="purchased-items-title">Purchased Items:</h4>
                                <ul className="purchased-items-list">
                                    {order.items.map((item, itemIndex) => (
                                        <li key={itemIndex} className="purchased-item-row">
                                            <span className="purchased-item-name">📦 {item.product_name}</span>
                                            <span className="purchased-item-price">${parseFloat(item.price).toFixed(2)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default OrderHistory;