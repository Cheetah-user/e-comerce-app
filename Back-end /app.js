require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: false
});

app.use(express.json());

/*Basic starting route*/
app.get('/', (req, res) => {
    res.send('Hello World!')
});

/*Register and login path */
/*path lets the user register with name, email, and a password(which is encrypted) and sends a message if successful */
app.post('/register', async (req, res) => {
    const {username, email, password} = req.body;
    try{
       const saltRounds = 10;
       const hashedPassword = await bcrypt.hash(password, saltRounds);

       await pool.query(
        'INSERT INTO customers (username, email, password) VALUES ($1, $2, $3)',
        [username, email, hashedPassword]
       );
      res.send('User registered!');
    }catch(err){
       if(err.code === '23505'){
        return res.status(400).send('Error, user with that email already exists')
       }
       res.status(500).send('Server Error');
    }
});

/*path that allows the user to login to their account using username and password */
app.post('/login', async (req, res) => {
    const {username, password} = req.body;
    try{
      const userResult = await pool.query(
        'SELECT * FROM customers WHERE username = $1',
        [username]);
      if(userResult.rows.length === 0){
        return res.status(401).send('Invalid username or password');
      }
      
      const user = userResult.rows[0];

      const isMatch = await bcrypt.compare(password, user.password);
      if(!isMatch){
        return res.status(401).send('Invalid username or password');
      }
      res.send(`Welcome back, ${username}!`);
    }catch(err){
       console.error(err.message);
       res.status(500).send('Server Error');
    }
});



/*Products routes*/
/*Gets products by their id */
app.get('/products/:id', async (req, res) => {
  const productId = req.params.id;
  try{
   const productResult = await pool.query(
    'SELECT * FROM products WHERE id = $1', [productId]
   );
   if(!productResult.rows[0]){
    return res.status(404).send('Error. Product does not exist')
   }
   res.send(productResult.rows[0]);
  }catch(err){
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/*Retrieves all products of a certain category */
app.get('/products', async (req, res) => {
  const categoryId = req.query.category;
  try{
   const categoryResult = await pool.query(
    'SELECT * FROM products WHERE category_id = $1', [categoryId]
   );
   if(categoryResult.rows.length === 0){
     return res.status(404).send('Error. Category does not exist')
   }
   res.send(categoryResult.rows);
  }catch(err){
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});



/*Customers routes*/
/*Retrieves all customers */
app.get('/customers', async (req, res,) => {
  try{
    const customers = await pool.query(
      'SELECT * FROM customers'
    );
    if(customers.rows.length === 0){
      return res.status(404).send('Error. Customers do not exist')
    }
    res.send(customers.rows);
  }catch(err){
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});




/*Orders routes*/
app.get('/orders', (req, res) => {

});

/*Payments routes */
app.get('/payments', (req, res) => {

});


/*Reviews routes*/
app.get('/reviews', (req, res) => {

});

app.listen(port, () => {
    console.log(`Running on port ${port}`)
});