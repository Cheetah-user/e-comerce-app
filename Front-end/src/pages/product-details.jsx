import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import './product-details.css';

function ProductDetails(){
    const {id} = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdding, adding] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchProductDetails = async () => {
            try{
                const response = await fetch(`http://localhost:3000/products/${id}`);

                if(!response.ok){
                    if(response.status === 404) throw new Error('Product not found');
                    throw new Error('Server error loading product details');
                }

                const data = await response.json();
                setProduct(data);
            }catch(err){
                setError(err.message);
            }finally{
                setLoading(false);
            }
        };

        fetchProductDetails();
    }, [id]);

    const handleAddToCart =  async () => {
        const token = localStorage.getItem('token');
        if(!token){
            navigate('/login');
            return;
        }

        adding(true);
        setSuccessMessage('');

        try{
            const response = await fetch('http://localhost:3000/carts/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    productId: product.id,
                    quantity: 1
                })
            });

            if(!response.ok){
                throw new Error('Could not add item to cart');
            }
            const data = await response.json();
            setSuccessMessage('✓ Added to Shopping Bag!');
            setTimeout(() => setSuccessMessage(''), 3000);
        }catch(err){
          alert(err.message || 'Something went wrong');
        }finally{
            adding(false);
        }
    };


    if(loading) return <div className="details-loader">Loading item specifics...</div>;
    if(error) return <div className="details-error-msg">{error}<button onClick={() => navigate('/products')}>Back to Store</button></div>;
    if(!product) return null;

    return(
        <div className="details-container">
            <button className="back-btn" onClick={() => navigate('/products')}>
                ← Back to Products
            </button>
            <div className="details-wrapper">
                <div className="details-image-section">
                    <img
                      src={product.img_url}
                      alt={product.name}
                      className="details-main-image"
                    />
                </div>
                <div className="details-info-section">
                    <h1 className="details-product-name">{product.name}</h1>
                    <p className="details-product-price">${parseFloat(product.price).toFixed(2)}</p>
                    <hr className="details-divider"/>
                    <h3 className="details-section-label">Description</h3>
                    <p className="details-product-desc">{product.description}</p>

                    <button className="details-add-btn" onClick={handleAddToCart} disabled={isAdding}>
                         {isAdding ? 'Adding...' : 'Add to Shopping Bag'}
                    </button>


                    {successMessage && (
                        <p style={{ color: 'green', fontWeight: 'bold', marginTop: '10px', textAlign: 'center' }}>
                        {successMessage}
                        </p>
                    )}

                </div>
            </div>
        </div>
    );
}

export default ProductDetails;