import express from 'express';
import { Pool } from 'postgres-pool';
import dotenv from 'dotenv';
import Stripe from 'stripe';

const router = express.Router();
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


//Route to get all products
router.get("/products", async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products');
        res.json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});

//route to get product by id
router.get('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        if (result.rows.length == 0) {
            return res.status(404).json({error: 'Product not found'});
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

//route to get product by category id
router.get('/products/category/:categoryId', async (req, res) => {
    const { categoryId } = req.params;
    try {
        const result = await pool.query('SELECT * FROM products WHERE category_id = $1', [categoryId]);
        if (result.rows.length === 0) {
            return res.status(404).json({error: 'No products found for this category'});
        }
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching products by category ID:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

//route to delete a product
router.delete('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({error: 'Product not found'});
        }
        res.json({message: 'Product deleted successfully'});
    } catch (error) {
        console.error('Error deleting product', error);
        res.status(500).json({error: 'Internal Server error'});
    }
})

//route to create a product
router.post('/products', async (req, res) => {
    const { name, description, price, category_id, stock, image_url } = req.body;

    if (!name || !price) {
        return res.status(400).json({error: 'Name and price are required.'});
    }
    try {
        const result = await pool.query(
            'INSERT INTO products (name, description, price, category_id, stock, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, description, price, category_id, stock, image_url]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

//route to update a product
router.put('/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, price, category_id, stock } = req.body;
    try {
        const result = await pool.query(
            'UPDATE products SET name = $1, description = $2, price = $3, category_id = $4, stock = $5 WHERE id = $6 RETURNING *', 
            [name, description, price, category_id, stock, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({error: 'Product not found'});
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

//route for a checkout
router.post('/create-checkout-session', async (req, res) => {
    const { cartItems } = req.body;

    console.log('Received cart items:', cartItems); // Log the cart data

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({ error: 'Invalid cart items' });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: cartItems.map((item) => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name,
                        images: item.image_url ? [item.image_url] : [],
                    },
                    unit_amount: Math.round(item.price * 100), // Price in cents
                },
                quantity: item.quantity || 1, 
            })),
            mode: 'payment',
            success_url: 'http://localhost:3000/success',
            cancel_url: 'http://localhost:3000/cancel',
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error); // Log full error
        res.status(500).json({ error: error.message });
    }
});



export default router;