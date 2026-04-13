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
});

app.use(express.json());

/*Basic starting route*/
app.get('/', (req, res) => {
    res.send('Hello World!')
});

/*Category routes */
app.get('/categories', (req, res) => {
  res.send();
});

/*Products routes*/
app.get('/products', (req, res) => {

});

/*Orders routes*/
app.get('/orders', (req, res) => {

});

/*Payments routes */
app.get('/payments', (req, res) => {

});

/*Customers routes*/
app.get('/customers', (req, res,) => {
  res.send();
});

/*path lets the user register with name, email, and a password(which is encrypted) and sends a message if successful */
app.post('/customers/register', async (req, res) => {
    const {name, email, password} = req.body;
    try{
       const saltRounds = 10;
       const hashedPassword = await bcrypt.hash(password, saltRounds);

       await pool.query(
        'INSERT INTO customers (name, email, password) VALUES ($1, $2, $3)',
        [name, email, hashedPassword]
       );
      res.send('User registered!');
    }catch(err){
       if(err.code === '23505'){
        return res.status(400).send('Error, user with that email already exists')
       }
       res.status(500).send('Server Error');
    }
});

/* */


/*Reviews routes*/
app.get('/reviews', (req, res) => {

});

app.listen(port, () => {
    console.log(`Running on port ${port}`)
});