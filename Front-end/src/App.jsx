
import './App.css'
import { Routes, Route } from 'react-router' 

function App() {
  return (
   <Routes>
      <Route path='/' element={<h1>Home page</h1>}/>
      <Route path='/login' element={<h1>Login page</h1>}/>
      <Route path='/register' element={<h1>Register page</h1>}/>
      <Route path='/products' element={<h1>Products page</h1>}/>
      <Route path='/categories' element={<h1>Categories page</h1>}/>
   </Routes>
  );
}

export default App;
