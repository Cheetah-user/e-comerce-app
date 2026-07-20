import { useEffect, useState } from "react";
import React from "react";
import './products.css';
import { Link } from "react-router-dom";

function Products(){
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    // 1. Changed 'All' to 'ALL' to match your bottom filter casing perfectly
    const [selectedCategory, setSelectedCategory] = useState('ALL'); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStoreData = async () => {
            try {
                const [productsRes, categoriesRes] = await Promise.all([
                    fetch('http://localhost:3000/products'),
                    fetch('http://localhost:3000/categories')
                ]);
                
                if(!productsRes.ok || !categoriesRes.ok){
                    throw new Error('Failed to load store inventory.');
                }
                
                const productsData = await productsRes.json();
                const categoriesData = await categoriesRes.json();

                setProducts(productsData);
                setCategories(categoriesData);

            } catch(err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchStoreData();
    }, []);

    const handleAddToCart = (productId) => {
        console.log(`Adding item ID ${productId} to cart!`);
    };

    const filteredProducts = selectedCategory === 'ALL' ? products 
     : products.filter(product => product.category_id === parseInt(selectedCategory) || product.category === selectedCategory);
    
    if(loading) return <div className="loader">Loading Inventory...</div>;
    if(error) return <div className="error-msg">{error}</div>;

    return (
        <div className="storefront-container">
            <div className="categories-filter-bar">
                <button 
                    className={`category-chip ${selectedCategory === 'ALL' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('ALL')}
                >
                    All Items
                </button>
                {/* 2. FIXED: Changed curly braces to parenthesis for implicit return */}
                {categories.map((category) => (
                    <button
                        key={category.id}
                        className={`category-chip ${selectedCategory === String(category.id) || selectedCategory === category.name ? 'active': ''}`}
                        onClick={() => setSelectedCategory(category.id)}
                    >
                        {category.name}
                    </button>
                ))}
            </div>
            
            <h2 className="storefront-title">Our Products</h2>

            <div className="products-grid">
                {filteredProducts.length === 0 ? (
                    <p className="no-items-msg">No products found in this category</p>
                ) : (
                    /* 3. FIXED: Parameter name changed to single 'product' and swapped to normal parenthesis */
                    filteredProducts.map((product) => (
                        <div key={product.id} className="product-card">
                            <Link to={`/products/${product.id}`} className="product-details-link">
                                <img
                                    src={product.img_url}
                                    alt={product.name}
                                    className="product-image"
                                />
                            </Link>
                            <div className="product-info">
                                <Link to={`/products/${product.id}`} className="product-title-link">
                                    <h3 className="product-name">{product.name}</h3>
                                </Link>
                                <p className="product-desc">{product.description}</p>
                                <div className="product-footer">
                                    <span className="product-price">${parseFloat(product.price).toFixed(2)}</span>
                                    <button className="add-to-cart-btn" onClick={() => handleAddToCart(product.id)}>
                                        Add To Cart
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default Products;