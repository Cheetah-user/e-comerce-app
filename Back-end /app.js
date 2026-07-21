require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 3000;
//importing google auth library
const {OAuth2Client} = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

//swagger setup
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
//swagger configuration options
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'E-comerce API',
            version: '1.0.0',
            description: 'API documentation for an e-commerce application for a codecademy project',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: ['./app.js'], 
}
//initialize swagger specification
const swaggerSpec = swaggerJSDoc(swaggerOptions)
//set up swagger UI route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(cors());

//Set up PostgreSQL connection pool 
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
/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new customer
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: john_doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: P@ssword123
 *     responses:
 *       200:
 *         description: User registered!
 *       400:
 *         description: Error, user with that email already exists
 *       500:
 *         description: Server Error
 */
app.post('/register', async (req, res) => {
    const {username, email, password} = req.body;
    try{
       const saltRounds = 10;
       const hashedPassword = await bcrypt.hash(password, saltRounds);

       const result = await pool.query(
        'INSERT INTO customers (username, email, password) VALUES ($1, $2, $3) RETURNING id, username',
        [username, email, hashedPassword]
       );
      const newUser = result.rows[0];
      //generates a jwt token when a user registers
      const token = jwt.sign(
        {id: newUser.id, username: newUser.username},
        process.env.JWT_SECRET,
        {expiresIn: '4h'}
      );

      res.json({
        message: 'User Registered successfully',
        token: token,
        user: {id: newUser.id, username: newUser.username}
      });

    }catch(err){
       if(err.code === '23505'){
        return res.status(400).send('Error, user with that email already exists')
       }
       res.status(500).send('Server Error');
    }
});

/*path that allows the user to login to their account using username and password */
/**
 * @swagger
 * /login:
 *   post:
 *     summary: Log in a user and return a JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: john_doe
 *               password:
 *                 type: string
 *                 format: password
 *                 example: P@ssword123
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Welcome back, john_doe!
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Invalid username or password
 *       500:
 *         description: Server Error
 */
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
        {expiresIn: '4h'}
      );
      res.json({message:`Welcome back, ${username}!`, token: token});
    }catch(err){
       console.error(err.message);
       res.status(500).send('Server Error');
    }
});

//login with google route 
app.post('/auth/google', async (req, res) => {
  try {
    const { googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({ message: "Google token is missing" });
    }

    // 1. Verify the token directly against Google's servers
    const ticket = await googleClient.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID, 
    });

    // 2. Extract user details safely from the verified payload
    const payload = ticket.getPayload();
    const { email, name } = payload;

    // 3. Check if this customer already exists in your Postgres database
    let userResult = await pool.query('SELECT * FROM customers WHERE email = $1', [email]);
    let customer = userResult.rows[0];

    if (!customer) {
      // Generate a completely unbreakable password
      const randomPassword = Math.random().toString(36) + 'GOOGLE_AUTH_SECURE_BYPASS_' + Date.now();

      const salt = await bcrypt.genSalt(10);
      const secureHashedPassword = await bcrypt.hash(randomPassword, salt);

      // 4. Automatic Sign-up: If they don't exist, create a baseline profile instantly
      // We pass an empty string or dummy password since they authenticate via Google!
      const newCustomerResult = await pool.query(
        `INSERT INTO customers (username, email, password, phone_number, address, city, country) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, username, email`,
        [name, email, secureHashedPassword, 'N/A', 'N/A', 'N/A', 'N/A']
      );
      customer = newCustomerResult.rows[0];
    }

    // 5. Generate your native app JWT token
    const appToken = jwt.sign(
      { id: customer.id, email: customer.email }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    // 6. Return your native token to the client
    res.status(200).json({
      token: appToken,
      user: { id: customer.id, username: customer.username },
      message: "Successfully signed in via Google!"
    });

  } catch (err) {
    res.status(500).json({ message: "Google authentication failed", error: err.message });
  }
});


/*Products routes*/
/*Gets products by their id */
/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get a product by its ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique ID of the product
 *     responses:
 *       200:
 *         description: Product details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 price:
 *                   type: number
 *       404:
 *         description: Error. Product does not exist
 *       500:
 *         description: Server Error
 */
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
/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products or filter by category
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *         required: false
 *         description: The ID of the category to filter products by
 *     responses:
 *       200:
 *         description: A list of products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   category_id:
 *                     type: integer
 *                   price:
 *                     type: number
 *       404:
 *         description: Error. No products found
 *       500:
 *         description: Server Error
 */
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
/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Get all product categories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: A list of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   name:
 *                     type: string
 *                     example: Electronics
 *       500:
 *         description: Server Error
 */
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
/**
 * @swagger
 * /customers/{id}:
 *   get:
 *     summary: Get customer profile by ID
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique ID of the customer
 *     responses:
 *       200:
 *         description: Customer profile retrieved successfully (excluding password)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *       401:
 *         description: Unauthorized - Token missing or invalid
 *       404:
 *         description: Error. Customer does not exist
 *       500:
 *         description: Server Error
 */
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
/**
 * @swagger
 * /customers/{id}:
 *   patch:
 *     summary: Update specific fields of a customer profile
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique ID of the customer to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               phone_number:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               country:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully!
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: No valid fields provided or data conflict (duplicate email/username)
 *       403:
 *         description: Unauthorized - You can only update your own profile
 *       401:
 *         description: Unauthorized - Token missing or invalid
 *       500:
 *         description: Server Error
 */
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

app.get("/carts/mine", verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    // Look up if a cart exists for this customer
    let cartResult = await pool.query(
        "SELECT id FROM carts WHERE customer_id = $1", [userId]
    );

    let cartId;
    if (cartResult.rows.length === 0) {
        // Create an empty cart layout if they don't have one yet
        const newCart = await pool.query(
            "INSERT INTO carts (customer_id) VALUES ($1) RETURNING id", [userId]
        );
        cartId = newCart.rows[0].id;
    } else {
        cartId = cartResult.rows[0].id;
    }

    // Hand back the clear cart ID without touching the item table
    res.status(200).json({ cartId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
});
//Route to add and update items in user's cart, creating cart if needed 
/**
 * @swagger
 * /carts/items:
 *   post:
 *     summary: Add an item to the cart (Creates a cart automatically if none exists)
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: integer
 *                 example: 101
 *               quantity:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Item added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Cart created and item added
 *                 item:
 *                   type: object
 *       401:
 *         description: Unauthorized - Token missing or invalid
 *       500:
 *         description: Internal Server Error
 */
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
/**
 * @swagger
 * /carts/{id}:
 *   get:
 *     summary: Get all items in a specific cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique ID of the cart
 *     responses:
 *       200:
 *         description: Cart details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       product_id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       price:
 *                         type: number
 *                       quantity:
 *                         type: integer
 *                       subtotal:
 *                         type: number
 *                 total:
 *                   type: string
 *                   example: "45.99"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server Error
 */
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
    WHERE c.id = $1 AND c.customer_id = $2 AND ci.quantity > 0`,
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
/**
 * @swagger
 * /carts/{cartId}/items/{productId}:
 *   delete:
 *     summary: Decrease item quantity or remove item from cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cartId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the cart
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the product to remove or decrement
 *     responses:
 *       200:
 *         description: Operation successful (Returns "Quantity decreased" or "Success")
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Quantity decreased
 *       403:
 *         description: Unauthorized - You do not own this cart
 *       404:
 *         description: Cart or Item not found
 *       500:
 *         description: Internal server error
 */
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
/**
 * @swagger
 * /carts/{cartId}:
 *   delete:
 *     summary: Clear all items from a cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cartId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the cart to empty
 *     responses:
 *       200:
 *         description: Cart items deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Cart items deleted
 *       403:
 *         description: Unauthorized - You do not own this cart
 *       404:
 *         description: Cart not found
 *       500:
 *         description: Internal Server Error
 */
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
/**
 * @swagger
 * /checkout:
 *   post:
 *     summary: Checkout and place an order
 *     description: Converts cart items into an order, records payment, and clears the cart using a database transaction.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 example: "Credit Card"
 *                 description: The method used for payment (e.g., Credit Card, PayPal).
 *     responses:
 *       201:
 *         description: Order successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Order successful"
 *                 orderId:
 *                   type: integer
 *                   example: 55
 *       400:
 *         description: Bad Request - Cart is empty
 *       401:
 *         description: Unauthorized - Token missing or invalid
 *       500:
 *         description: Checkout failed - Internal Server Error
 */
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
/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all previous orders for the logged-in user
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of orders with their associated products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   order_date:
 *                     type: string
 *                     format: date-time
 *                   status:
 *                     type: string
 *                   total_amount:
 *                     type: number
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         product_name:
 *                           type: string
 *                         price:
 *                           type: number
 *       500:
 *         description: Internal Server Error
 */
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


//Route that lets user see details of a specific order
/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get detailed information for a specific order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique ID of the order
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order_id:
 *                   type: integer
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 status:
 *                   type: string
 *                 total:
 *                   type: number
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       price:
 *                         type: number
 *                       description:
 *                         type: string
 *                       quantity:
 *                         type: integer
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
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
//Route that gets all reviews for a specific product. It also show username, date of review, and rating.
/**
 * @swagger
 * /reviews/products/{id}:
 *   get:
 *     summary: Get all reviews for a specific product
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique ID of the product
 *     responses:
 *       200:
 *         description: A list of product reviews
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rating:
 *                         type: integer
 *                         example: 5
 *                       comment:
 *                         type: string
 *                         example: "Excellent product, highly recommend!"
 *                       review_date:
 *                         type: string
 *                         format: date-time
 *                       username:
 *                         type: string
 *                         example: "happy_shopper"
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "No reviews for this product yet."
 *       500:
 *         description: Internal Server Error
 */
app.get('/reviews/products/:id', async (req, res) => {
  const productId = req.params.id;
  try{
  const result = await pool.query(
    `SELECT r.rating, r.comment, r.review_date, c.username 
    FROM reviews r
    JOIN customers c on r.customer_id = c.id
    WHERE r.product_id = $1`, [productId]
  );
  if(result.rows.length === 0){
    return res.status(200).json({message: 'No reviews for this product yet.'});
  }
  res.status(200).json(result.rows);
  }catch(err){
    console.log(err);
    res.status(500).json({error: 'Internal Server Error'});
  }
});


//Route that allows users to create a review for a product they have purchased.
/**
 * @swagger
 * /reviews/products/{id}:
 *   post:
 *     summary: Submit a review for a product
 *     description: Allows a user to post a rating and comment only if they have previously purchased the product.
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the product to review
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *               - comment
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: "Great quality, fits perfectly!"
 *     responses:
 *       201:
 *         description: Review submitted successfully!
 *       403:
 *         description: Forbidden - You can only review products you have purchased
 *       401:
 *         description: Unauthorized - Token missing or invalid
 *       500:
 *         description: Internal Server Error
 */
app.post('/reviews/products/:id', verifyToken, async (req, res) => {
    const productId = req.params.id;
    const userId = req.user.id;
    const {rating, comment} = req.body;
    try{
      //Sees if user purchased item 
      const purchaseCheck = await pool.query(
        `SELECT * from orders
        JOIN order_product op ON orders.id = op.order_id
        WHERE orders.customer_id = $1 AND op.product_id = $2`,
        [userId, productId]
      );
      if(purchaseCheck.rows.length === 0){
        return res.status(403).json({message: 'You can only review products you have purchased.'});
      };
      //Inserts reviews into the database
      await pool.query(
        'INSERT INTO reviews (product_id, customer_id, rating, comment, review_date) VALUES ($1, $2, $3, $4, NOW())',
        [productId, userId, rating, comment]
      );
      res.status(201).json({message: 'Review submitted successfully!'}); 
    }catch(err){
        console.log(err);
        res.status(500).json({error: 'Internal Server Error'});
    }
});

//Route that lets the user update or delete their reviews
/**
 * @swagger
 * /reviews/{id}:
 *   patch:
 *     summary: Update or Delete a review
 *     description: Updates the rating/comment using COALESCE. If both are null, the review is deleted.
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique ID of the review
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 nullable: true
 *                 example: 4
 *               comment:
 *                 type: string
 *                 nullable: true
 *                 example: "Actually, it was pretty good!"
 *     responses:
 *       200:
 *         description: Successfully updated or deleted the review
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Review updated
 *       404:
 *         description: Review not found or you are not the owner
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
app.patch('/reviews/:id', verifyToken, async (req, res) => {
    const reviewId = req.params.id;
    const userId = req.user.id;
    const {rating, comment} = req.body;
    try{ 
      const reviewsCheck = await pool.query(
        'SELECT * FROM reviews WHERE id = $1 AND customer_id = $2',
        [reviewId, userId]
      );
      //Checks to see if review exists
      if(reviewsCheck.rows.length === 0){
        return res.status(404).json({message: 'Review not found'});
      }
      //If both rating and comment are null delete.
      if(rating === null && comment === null){
        await pool.query(
            'DELETE FROM reviews WHERE id = $1 AND customer_id = $2',
            [reviewId, userId]
        );
        return res.status(200).json({message: 'Review deleted'});
      }
      //If either rating or comment is not null, just updates the one that is not null and leaves the null one the same. 
      if(rating !== null || comment !== null){
        await pool.query(
            `UPDATE reviews SET 
            rating = COALESCE($1, rating),
            comment = COALESCE($2, comment)
            WHERE id = $3 AND customer_id = $4`,
            [rating, comment, reviewId, userId]
        );
        return res.status(200).json({message: 'Review updated'});
      }

    }catch(err){
        console.log(err);
        res.status(500).json({error: 'Internal Server Error'});
    }
});

app.listen(port, () => {
    console.log(`Running on port ${port}`)
});