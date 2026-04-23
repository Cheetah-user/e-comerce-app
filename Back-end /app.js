require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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

//JWT middleware 
const verifyToken = (req, res, next) => {
  //reads authorization header from incomming request
    const authHeader = req.headers['authorization'];
  //extracts the token 
   const token = authHeader && authHeader.split(' ')[1];
  //checks if token exists
   if(!token) return res.status(401).send('Access Denied: No Token Provided');
   try{
  //Checks if the token is valid
    const verified = jwt.verify(token, process.env.JWT_SECRET);
  //If valid attaches user info in request object
    req.user = verified;
  //passes control
    next();
   }catch(err){
    res.status(400).send('Invalid Token');
   }
}

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
//Added jwt so it is more secure, so confirms it truly is that user.
      const token = jwt.sign(
        {id: user.id, username: user.username},
        process.env.JWT_SECRET,
        {expiresIn: '1h'}
      );
      res.json({message:`Welcome back, ${username}!`, token: token});
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

/*Retrieves all products or all products of a certain category */
app.get('/products', async (req, res) => {
  //will return products of a certain category with this route: /products?category=1
  const categoryId = req.query.category ? parseInt(req.query.category): null;
  try{
   const productQuery = await pool.query(
    `SELECT * FROM products
    WHERE ($1::INT IS NULL OR category_id = $1)`, [categoryId] || null
   );
   if(productQuery.rows.length === 0){
     return res.status(404).send('Error. No products found')
   }
   res.json(productQuery.rows);
  }catch(err){
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

//Categories routes 
//Retrieves all categories
app.get('/categories', async (req, res)=> {
    try{
      const result = await pool.query('SELECT * FROM category');
      res.json(result.rows)
    }catch(err){
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

/*Customers routes*/
//It retrieves customer info by id and displays it except password.
app.get('/customers/:id', verifyToken, async (req, res) => {
  const customerId = req.params.id;
  try{
    const customerResult = await pool.query(
      'SELECT * FROM customers WHERE id = $1', [customerId]
    );
    if(customerResult.rows.length === 0){
        return res.status(404).send('Error. Customer does not exist')
    }
    const {password, ...userWithoutPassword} = customerResult.rows[0];
    res.send(userWithoutPassword);
  }catch(err){
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

//Allows user to update info 
app.patch('/customers/:id', verifyToken, async (req, res) => {
   const customerId = req.params.id;
   
   if(req.user.id !== parseInt(customerId)){
    return res.status(403).send('Unauthorized: You can only update your own profile.');
   }

   const allowedFields = ['username', 'email', 'phone_number', 'address', 'city', 'country'];

   const columnsToUpdate = Object.keys(req.body).filter(key =>
    allowedFields.includes(key) && req.body[key] !== undefined
    );

   if(columnsToUpdate.length === 0){
    return res.status(400).send('No valid field provided for update');
   }
   try{
     const setClause = columnsToUpdate
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');

    const values = columnsToUpdate.map(key => req.body[key]);
    values.push(customerId);
    
    const queryText = `
       UPDATE customers
       SET ${setClause}
       WHERE id = $${values.length}
       RETURNING *`;

    const result = await pool.query(queryText, values);
     
     const {password, ...userWithoutPassword} = result.rows[0];
     res.json({
        message: "Profile updated successfully!",
        user: userWithoutPassword
     });
   }catch(err){
    if(err.code === '23505'){
        return res.status(400).send('Error: that email or username is already taken.')
    }
    console.error(err.message);
    res.status(500).send('Server Error');
   }
});


//Carts routes
//Get route that checks if person is the user, then displays cart data such as products and total price.
app.get("/carts/:id", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const cartId  = req.params.id;
  try{
//joins the products, carts, and cart_items tables 
   const cartData = await pool.query(
   `SELECT
     p.id AS product_id,
     p.name,
     p.price,
     p.description,
     ci.quantity,
      (p.price * ci.quantity) AS subtotal
    FROM cart_items ci
    JOIN carts c ON ci.cart_id = c.id
    JOIN products p ON ci.product_id = p.id
    WHERE c.id = $1 AND c.customer_id = $2`,
    [cartId, userId]
   );
//default response 
   if(cartData.rows.length === 0){
    return res.status(200).json({
        items: [], total: "0.00"
    });
   }
//returns cart details 
   const total = cartData.rows.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
   res.status(200).json({
    items: cartData.rows,
    total: total.toFixed(2)
  });
  }catch(err){
    console.log(err);
    res.status(500).json({error: 'Server Error'});
  }
});

//Route that lets user add and update items in cart 
app.post("/carts/:id/items", verifyToken, async(req, res) => {
  const cartId = req.params.id;
  const userId = req.user.id;
  const {productId, quantity} = req.body;
  try{
    const cartOwnerCheck = await pool.query(
        "SELECT customer_id FROM carts WHERE id = $1",
        [cartId]
    );
    //checks if cart exists, if doesn't throws error message
    if(cartOwnerCheck.rows.length === 0){
       return res.status(404).json({message: "Cart not found"});
    }
    //If not owner of the cart it returns an error
    if(cartOwnerCheck.rows[0].customer_id != userId){
       return res.status(403).json({message: "Unathorized: You do not own this cart."});
    }
    //Allows user to add items into cart, if item is already in cart it increases the quantity
  const cartQuery = await pool.query(`
    INSERT INTO cart_items (cart_id, product_id, quantity)
    VALUES ($1, $2, $3)
    ON CONFLICT (cart_id, product_id)
    DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
    RETURNING *`, [cartId, productId, quantity]);
    res.status(200).json(cartQuery.rows[0]);
  }catch(err){
    console.log(err);
    res.status(500).json({error: 'Internal Server Error'});
  }
});

//Route that lets user delete items from cart
app.delete("/carts/:id", verifyToken, async(req, res) => {

});

//Route that lets user clear the cart

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