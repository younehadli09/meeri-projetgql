const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Order } = require('../models/Order');
const { OrderItem } = require('../models/Order_item'); 
const { Product } = require('../models/Product');
const { createHandler } = require("graphql-http/lib/use/express");
const {GETschemma,POSTschemma} = require('../schemas/orderschema');
const resolvers = require('../resolvers/orderresolver')
const {verifyTokenModerator,GetidfromToken} = require('../helpers/verify')
const fs = require('fs'); 
const path = require('path'); 



router.get('/countorders', async (req, res) => {
    try {
        const user = await  verifyTokenModerator(req)
        const countorders = await Order.countDocuments();
        res.status(200).send({ success: true, count: countorders });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/countordersconfirm', async (req, res) => {
    try {
        const user = await  verifyTokenModerator(req)
        const countorders = await Order.countDocuments({status : "confirmé"});
        res.status(200).send({ success: true, count: countorders });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/totalprice', async (req, res) => {
    try {
        const user = await verifyTokenModerator(req);

        const totalPrice = await Order.aggregate([
            {
                $group: {
                    _id: null, // Group all documents together
                    total: { $sum: "$totalprice" }, // Sum the `totalprice` field
                }
            }
        ]);

        // Extract the total price value from the result
        const total = totalPrice.length > 0 ? totalPrice[0].total : 0;

        res.status(200).send({ success: true, totalPrice: total });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const deliveryFilePath = path.join(__dirname, '../Data/delivery.json');

// Read the JSON file
let deliveryData;
try {
  const rawData = fs.readFileSync(deliveryFilePath);
  deliveryData = JSON.parse(rawData);
} catch (err) {
  console.error('Error reading delivery.json:', err);
  process.exit(1); 
}

router.get('/delivery', (req, res) => {
  // Combine delivery_prices and delivery_addresses into a single array
  const combinedData = deliveryData.delivery_prices.map(price => {
    const address = deliveryData.delivery_addresses.find(addr => addr.code === price.code);
    return {
      code: price.code,
      wilaya: price.wilaya,
      a_domicile: price.a_domicile,
      stop_desk: price.stop_desk,
      retour: price.retour,
      commune : price.communes,
      address: address ? address.address : null 
    };
  });

  res.json(combinedData);
});


/**
 * @desc GET Product 
 * @method get
 * @route /api/products
 * @access public
 */
router.use('/orderGET', 
    (req, res) => {
    createHandler({
        schema: GETschemma,
        rootValue: resolvers,
        context: { req,res }
    })(req, res);}
 );

/**
 * @desc POST Product 
 * @method POST 
 * @route /api/products
 * @access public
 */
router.use(
    '/orderPOST',
    (req, res) => {
        createHandler({
            schema: POSTschemma,
            rootValue: resolvers,
            context: { req,res }, 
        })(req, res); 
    }
);
/**
 * @desc get  all orders
 * @method get
 * @route /api/orders
 * @access public
 */
router.get('/GetALLOrders', async (req, res) => {
    const user = await  verifyTokenModerator(req)

    const Orderlist = await Order.find().populate('user','username -_id').populate('orderitems','product quantity -_id')
    if (!Orderlist) {
        return res.status(500).json({ success: false });
    }
    res.send(Orderlist);
});


/**
 * @desc create order
 * @method post
 * @route /api/orders
 * @access public
 */

router.post('/Createorder', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        // Validate products and quantities first
        const productUpdates = [];
        const orderItems = [];
        let totalPrice = 0;
        let totalQuantity = 0;

        // Phase 1: Validation
        for (const item of req.body.orderitems) {
            const product = await Product.findById(item.product).session(session);
            if (!product) {
                await session.abortTransaction();
                return res.status(400).send(`Product ${item.product} not found`);
            }

            if (product.stock < item.quantity) {
                await session.abortTransaction();
                return res.status(400).send(`Insufficient stock for product ${product.name}`);
            }

            productUpdates.push({
                updateOne: {
                    filter: { _id: product._id },
                    update: { $inc: { stock: -item.quantity } }
                }
            });

            const itemPrice = product.Price * item.quantity;
            totalPrice += itemPrice;
            totalQuantity += item.quantity;

            orderItems.push({
                quantity: item.quantity,
                product: product._id,
                price: product.Price
            });
        }

        // Phase 2: Execute all updates atomically
        await Product.bulkWrite(productUpdates, { session });

        // Create order items
        const createdItems = await OrderItem.insertMany(orderItems, { session });

        // Create the order
        const order = new Order({
            orderitems: createdItems.map(item => item._id),
            adress: req.body.adress,
            city: req.body.city,
            postalcode: req.body.postalcode,
            phonenumber: req.body.phonenumber,
            status: 'pending', // Default status
            totalprice: totalPrice,
            quantityOrder: totalQuantity,
            user: req.body.user,
        });

        await order.save({ session });
        await session.commitTransaction();

        res.status(201).json(order);
    } catch (error) {
        await session.abortTransaction();
        console.error('Order creation failed:', error);
        res.status(500).send('Order creation failed');
    } finally {
        session.endSession();
    }
});
router.put('/statuschange/:id', async (req, res) => {
    try {
        // 1. Verify moderator authentication
        const user = await verifyTokenModerator(req);
        if (!user) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        // 2. Validate status value
        const validStatuses = [
            'en cours de confirmation',
            'confirmé', 
            'en livraison',
            'livré',
            'annulé'
        ];
        
        if (!validStatuses.includes(req.body.status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        // 3. Find and update the order
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { 
                status: req.body.status,
                $push: { statusHistory: { status: req.body.status, changedAt: new Date() } }
            },
            { new: true }
        );

        // 4. Return the updated order
        res.json({
            success: true,
            order: updatedOrder
        });

    } catch (error) {
        console.error('Status update error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error',
            error: error.message 
        });
    }
});

    module.exports = router;
