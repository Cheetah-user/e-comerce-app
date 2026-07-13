
import './App.css'
import { Routes, Route } from 'react-router' 
import Register from './pages/register';

function App() {
  return (
   <Routes>
      <Route path='/' element={<h1>Home page</h1>}/>
      <Route path='/login' element={<h1>Login page</h1>}/>
      <Route path='/registration' element={<Register/>}/>
      <Route path='/products' element={<h1>Products page</h1>}/>
      <Route path='/categories' element={<h1>Categories page</h1>}/>
   </Routes>
  );
}

export default App;
