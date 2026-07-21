
import './App.css'
import { Routes, Route } from 'react-router' 
import Register from './pages/register';
import Login from './pages/login';
import Navbar from './components/nav-bar';
import Products from './pages/products';
import ProductDetails from './pages/product-details';
import Cart from './pages/cart';

function App() {
  return (
   <div>
    <Navbar/>
    <Routes>
        <Route path='/' element={<h1>Home page</h1>}/>
        <Route path='/login' element={<Login/>}/>
        <Route path='/registration' element={<Register/>}/>
        <Route path='/products' element={<Products/>}/>
        <Route path='/products/:id' element={<ProductDetails/>}/>
        <Route path='/cart' element={<Cart/>}/>
    </Routes>
   </div>
  );
}

export default App;
