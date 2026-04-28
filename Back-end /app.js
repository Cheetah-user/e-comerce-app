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
//Route to add and update items in user's cart, creating cart if needed 
app.post("/carts/items", verifyToken, async(req, res) => {
  const userId = req.user.id;
  const {productId, quantity} = req.body;
  const client = await pool.connect();

  try{
    //start a transaction
    await client.query('BEGIN');
    //checks if user already has a cart
    let cartResult = await client.query(
        "SELECT id FROM carts WHERE customer_id = $1",
        [userId]
    );
    let cartId;
    //if no cart exists, create one and get its ID
    if(cartResult.rows.length === 0){
        const newCart = await client.query(
            "INSERT INTO carts (customer_id) VALUES ($1) RETURNING id",
            [userId]
        );
       cartId = newCart.rows[0].id;
    }else{
        //if cart exists, use its ID
        cartId = cartResult.rows[0].id;
    }
    //Allows user to add items into cart, if item is already in cart it increases the quantity
  const cartQuery = await client.query(`
    INSERT INTO cart_items (cart_id, product_id, quantity)
    VALUES ($1, $2, $3)
    ON CONFLICT (cart_id, product_id)
    DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
    RETURNING *`, [cartId, productId, quantity]);
   //commit transaction
    await client.query('COMMIT');
    //Send a response indicating what happened
    res.status(200).json({
        message: cartResult.rows.length === 0 ? "Cart created and item added" : "Item added to cart",
        item: cartQuery.rows[0]
    });
  }catch(err){
    //rollback transaction on error
    await client.query('ROLLBACK');
    console.log(err);
    res.status(500).json({error: 'Internal Server Error'});
  }finally{
    //release the database client
    client.release();
  }
});

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


//Route that lets user delete items from cart
app.delete("/carts/:cartId/items/:productId", verifyToken, async(req, res) => {
  const cartId = req.params.cartId;
  const productId = req.params.productId;
  const userId = req.user.id;
  try{
    const cartOwnerCheck = await pool.query(
        'SELECT customer_id FROM carts WHERE id = $1', [cartId]
    );
    //Checks if cart exists
    if(cartOwnerCheck.rows.length === 0){
        return res.status(404).json({message: 'Cart not found.'});
    }
    //Checks to see if user owns cart if not sends error
    if(cartOwnerCheck.rows[0].customer_id !== userId){
        return res.status(403).json({message: 'Unauthorized: You do not own this cart'});
    }
    //Selects quantity from the database 
    const quantityQuery = await pool.query(
        `SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2`,
        [cartId, productId]
    );
    if(quantityQuery.rows.length === 0){
       return res.status(404).json({message: 'Item not found'});
    }
   //Checks to see if more than one of same item if there is reduces quantity
    const currentQuantity = quantityQuery.rows[0].quantity;
    if(currentQuantity > 1){
      await pool.query(
        'UPDATE cart_items SET quantity = quantity - 1 WHERE cart_id = $1 AND product_id = $2',
        [cartId, productId]
      );
      return res.status(200).json({message: 'Quantity decreased'});
    }else{
        //Deletes the item
        await pool.query(
            'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2',
            [cartId, productId]
        );
    res.status(200).json({message: 'Success'});
    }
  }catch(err){
    console.log(err);
    res.status(500).json({error: 'Internal server error'});
  }
});

//Route that lets user clear the cart
app.delete('/carts/:cartId', verifyToken, async(req, res) => {
  const cartId = req.params.cartId;
  const userId = req.user.id;
  try{
    const cartOwnerCheck = await pool.query(
        'SELECT * FROM carts WHERE id = $1 AND customer_id = $2',
        [cartId, userId]
    );
    if(cartOwnerCheck.rows.length === 0){
        res.status(404).json({message: 'Cart not found'});
        return;
    }
    if(cartOwnerCheck.rows[0].customer_id !== userId){
        return res.status(403).json({message: 'Unauthorized: You do not own this cart'});
    }
   await pool.query(
    'DELETE FROM cart_items WHERE cart_id = $1',
    [cartId]
   );
   res.status(200).json({message: 'Cart items deleted'})
  }catch(err){
    console.log(err);
    res.status(500).json({error: 'Internal Server Error'});
  }
});


/*Checkout route */
//Checks user's cart and creates new order
app.post('/checkout', verifyToken, async(req, res) => {
  const userId = req.user.id;
  const { paymentMethod } = req.body;
  const client = await pool.connect();

  try{
    //start database transaction
    await client.query('BEGIN');

    //get all in the user's cart, including price
    const cartItems = await client.query(
        `SELECT ci.product_id, ci.quantity, p.price, c.id AS cart_id
        FROM cart_items ci
        JOIN carts c ON ci.cart_id = c.id
        JOIN products p ON ci.product_id = p.id
        WHERE c.customer_id = $1`, [userId]
    );
    //checks to see if cart is empty
    if(cartItems.rows.length === 0){
        return res.status(400).json({message: 'Your cart is empty'});
    };
    
    //calculates total amount of order
    const totalAmount = cartItems.rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartId = cartItems.rows[0].cart_id;

    //creates a new order in the orders table
    const orderResult = await client.query(
       'INSERT INTO orders (customer_id, order_date, status, total_amount) VALUES ($1, NOW(), $2, $3) RETURNING id',
       [userId, 'completed', totalAmount]
    );
    const orderId = orderResult.rows[0].id;
    
    //Add each product from cart to order_product table
    for(const item of cartItems.rows){
        await client.query(
            'INSERT INTO order_product (order_id, product_id, quantity) VALUES ($1, $2, $3)',
            [orderId, item.product_id, item.quantity]
        );
    }
    
    //Record payment in payment table
    await client.query(
        `INSERT INTO payments (amount, payment_method, status, payment_date, order_id, customer_id)
        VALUES ($1, $2, 'success', NOW(), $3, $4)`,
        [totalAmount, paymentMethod, orderId, userId]
    );
    //Clear user's cart after successful order and payment
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    //commit transaction
    await client.query('COMMIT');
    res.status(201).json({message: 'Order successful', orderId});
  }catch(err){
    //rollback transaction if any errors occur
    await client.query('ROLLBACK');
    console.log(err);
    res.status(500).json({error: 'Checkout failed'})
  }finally{
    client.release();
  }
});



/*Orders routes*/
//Route that creates a history of user's orders
app.get('/orders', verifyToken, async (req, res) => {
  const userId = req.user.id;
  //joins the orders, order_product and products tables together and organizes by order date
  try{
    const result = await pool.query(
        `SELECT 
        o.id AS order_id,
        o.order_date,
        o.status,
        o.total_amount,
        p.name AS product_name,
        p.price
        FROM orders o
        JOIN order_product op ON o.id = op.order_id
        JOIN products p ON op.product_id = p.id
        WHERE customer_id = $1
        ORDER BY o.order_date DESC`,
        [userId]
    );
    //if there is no previous orders will show this message
    if(result.rows.length === 0){
        return res.status(200).json({message: "You haven't placed an order yet."});
    }
   //Groups results so that each order is one object with list of products.
    const orders = result.rows.reduce((acc, row) => {
        const {order_id, order_date, status, total_amount, product_name, price} = row;
        //checks to make sure that there isn't an order with the same id already...
        if(!acc[order_id]){
            //creates new order entry if no existing id
            acc[order_id] = { order_date, status, total_amount, items: []};
        }
        //pushes current product name into items array
        acc[order_id].items.push({product_name, price});
        return acc;
    }, {});
    res.status(200).json(Object.values(orders));
  }catch(err){
    console.log(err);
    res.status(500).json({error: 'Internal Server Error'});
  }
});

app.get('/orders/:id', verifyToken, async (req, res) => {
  const orderId = req.params.id;
  const userId = req.user.id;
  try{
    const orderData = await pool.query(
        `SELECT
        o.id, o.order_date, o.status, o.total_amount,
        p.name AS product_name, p.price, p.description, op.quantity
        FROM orders o
        JOIN order_product op ON o.id = op.order_id
        JOIN products p ON op.product_id = p.id
        WHERE o.id = $1 AND o.customer_id = $2`,
        [orderId, userId]
    );
    if(orderData.rows.length === 0){
        return res.status(404).json({error: 'Order not found'});
    }
    const orderDetails = {
        order_id: orderData.rows[0].id,
        date: orderData.rows[0].order_date,
        status: orderData.rows[0].status,
        total: orderData.rows[0].total_amount,
        items: orderData.rows.map(row => ({
            name: row.product_name,
            price: row.price,
            description: row.description,
            quantity: row.quantity
        }))
    };
    res.status(200).json(orderDetails);
  }catch(err){
    console.log(err);
    res.status(500).json({error: 'Internal Server Error'});
  }
});

/*Reviews routes*/
app.get('/reviews', (req, res) => {

});

app.listen(port, () => {
    console.log(`Running on port ${port}`)
});