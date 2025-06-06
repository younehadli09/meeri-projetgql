const mongoose = require('mongoose');
const  {Order,Counter} = require('../models/Order');
const { OrderItem } = require('../models/Order_item'); 
const { Product } = require('../models/Product');
const {verifyTokenModerator,GetidfromToken} = require('../helpers/verify')
const moment = require('moment');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();
const sendOrderEmail = require('../Email/Order/ordermail')
const sendUpdateOrderEmail =require('../Email/Order/updateordermail')
const incrementOrderId = async () => {
    const counter = await Counter.findOneAndUpdate(
      { name: 'orderId' },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );
  
    // Generate a timestamp (e.g., YYYYMMDDHHmmss)
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  
    // Optionally add a prefix (e.g., 'ORD')
    const prefix = 'ORD';
  
    // Optionally add a random alphanumeric string (e.g., 4 characters)
    const randomString = Math.random().toString(36).substring(2, 6).toUpperCase();
  
    // Concatenate elements to create a complex order ID
    const complexOrderId = `${prefix}-${timestamp}-${counter.count}-${randomString}`;
  
    return complexOrderId;
  };
  
const resolvers = {
    orderGET: async (args,context) => {
        try {
          const user = await verifyTokenModerator(context.req);
  
          const orders = await Order.find({})
          .populate('user')
          .populate('orderitems.product');
        

                  
          return orders;
        } catch (error) {
          throw new Error('Error fetching orders: ' + error.message);
        }
      },
      createOrder: async (args, context) => {
        try {
          const userT = await GetidfromToken(context.req);
      
          const orderitems = args.input.orderitems;
      
          // Fetch product details to calculate total price and quantity
          const productIds = orderitems.map(item => item.product);
          const products = await Product.find({ _id: { $in: productIds } });
      
          // Calculate total quantity and total price
          let totalQuantity = 0;
          let totalPrice = 0;
      
          const orderItemsData = orderitems.map(item => {
            const quantity = Number(item.quantity); // Convert to number
            totalQuantity += quantity;
      
            const product = products.find(p => p._id.equals(item.product));
            const price = product ? product.Price : 0;
            totalPrice += price * quantity;
      
            return {
              quantity,
              product: item.product,
              color: item.color, // Add color from input
              size: item.size, 
              priceproduct: price * quantity, // Calculate priceproduct
            };
          });
      
          const orderId = await incrementOrderId();
          const order = new Order({
            firstname: userT.firstname || args.input.firstname,
            lastname: userT.lastname || args.input.lastname,
            email : userT.email ||args.input.email,
            orderitems: orderItemsData,
            adress: args.input.adress || userT.adress,
            wilaya : args.input.wilaya || userT.wilaya,
            commune: args.input.commune || userT.commune,
            phonenumber: args.input.phonenumber || userT.phonenumber,
            status: 'en cours de confirmation',
            totalprice: totalPrice + args.input.livprice,
            quantityOrder: totalQuantity,
            user: userT._id,
            idorder: orderId,
          });
      
          // Save the order
          const savedOrder = await order.save();
      
          if (!savedOrder) {
            return {
              message: 'The order cannot be created',
            };
          }
      
          const userF = await User.findById(userT._id);
      
          // Construct orderDetails using products data
          const orderDetails = orderitems.map((item) => {
            const product = products.find(p => p._id.equals(item.product));
            return {
              productName: product ? product.name : 'Unknown Product',
              quantity: item.quantity,
              price: product ? product.Price : 0,
              color: item.color, // Include color in order details
              size: item.size, // Include size in order details
            };
          });
      
          // Send order confirmation email
          await sendOrderEmail({
            idorder: orderId,
            recipient: userF.email,
            name: userF.username,
            orderDetails, // Pass the orderDetails array
            totalPrice,
          });
      
          return {
            user: userF,
            orderitems: orderItemsData,
            order: savedOrder,
            message: 'Order saved successfully',
          };
        } catch (error) {
          console.error('Error creating order:', error);
          throw new Error('An error occurred while creating the order.');
        }
      },
    createOrderAnonym : async (args, context) => {
        try {
          
          const orderitems = args.input.orderitems;
      
          // Fetch product details to calculate total price and quantity
          const productIds = orderitems.map(item => item.product);
          const products = await Product.find({ _id: { $in: productIds } });
      
          // Calculate total quantity and total price
          let totalQuantity = 0;
          let totalPrice = 0;
      
          const orderItemsData = orderitems.map(item => {
            const quantity = Number(item.quantity); // Convert to number
            totalQuantity += quantity;
      
            const product = products.find(p => p._id.equals(item.product));
            const price = product ? product.Price : 0;
            totalPrice += price * quantity;
      
            return {
              quantity,
              product: item.product,
              color: item.color, 
              size: item.size, 
            };
          });
      
          const orderId = await incrementOrderId();
          const order = new Order({
            firstname : args.input.firstname,
            lastname : args.input.lastname,
            email: args.input.email,
            orderitems: orderItemsData,
            adress: args.input.adress,
            wilaya: args.input.wilaya,
            commune: args.input.commune,
            phonenumber: args.input.phonenumber,
            status: 'en cours de confirmation',
            totalprice: totalPrice+args.input.livprice,
            quantityOrder: totalQuantity,
            idorder: orderId,
          });
      
          // Save the order
          const savedOrder = await order.save();
      
          if (!savedOrder) {
            return {
              message: 'The order cannot be created',
            };
          }
      

      
          return { 
             orderitems : orderItemsData,
             order: savedOrder,
             message: 'Order saved successfully' };
        } catch (error) {
          console.error('Error creating order:', error);
          throw new Error('An error occurred while creating the order.');
        }
      },
      
      
      
    
    orderDELETE: async (args, context) => {
        try {
            const user = await GetidfromToken(context.req); 
            const order = await Order.findById(args.input._id);  // Find the order by its ID
            
            if (!order) {
                return {
                    message: 'Order not found',
                };
            }
    
            // Check if the order's status is 'pending'
            if (order.status !== "pending") {
                return{
                    message: 'Cannot delete an order that is not pending'
                }
            }
    
            // Delete the order
            const deletedOrder = await Order.findByIdAndDelete(args.input._id);
            
            if (!deletedOrder) {
                return {
                    message: 'Order not found or already deleted',
                };
            }
    
            return {order :deletedOrder,
                message : 'Order deleted successfully'
            } 
    
        } catch (error) {
            console.error('Error in deleteOrder:', error.message);
            throw new Error('An error occurred while deleting the order.');
        }
    },
    updateOrderStatus: async (args, context) => {
        try {
            const user = await verifyTokenModerator(context.req); 
            const order = await Order.findById(args.input._id);  
    
            if (!order) {
                return {
                    message: 'Order not found',
                };
            }
    
            // Fetch the order items details
            const orderitemsData = await OrderItem.find({ _id: { $in: order.orderitems } });
            if (!orderitemsData.length) {
                return {
                    message: 'No valid order items found.',
                };
            }
    
            // Fetch product details to calculate the price
            const productIds = orderitemsData.map(item => item.product);
            const products = await Product.find({ _id: { $in: productIds } });
    
            // Calculate order details (product name, quantity, price)
            const orderDetails = orderitemsData.map(item => {
                const product = products.find(p => p._id.equals(item.product));
                return {
                    productName: product ? product.name : 'Unknown Product',
                    quantity: item.quantity,
                    price: product ? product.Price : 0,
                };
            });
    
            // Send email after updating the order status
            const orderupdated = await Order.findByIdAndUpdate(order._id, { status: args.input.status });
            const userF = await User.findById(user._id);
    
            await sendUpdateOrderEmail({
                orderid: order.idorder,  
                recipient: userF.email,
                name: userF.username,
                orderDetails: orderDetails, 
                totalPrice: order.totalPrice,  
                status: args.input.status,  
            });
            
    
            return {
                message: 'Order updated successfully',
            };
        } catch (error) {
            console.error('Error updating order status:', error);
            throw new Error('An error occurred while updating the order.');
        }
    },
    userorderGET : async(args,context)=>{
        try{
        const user = await GetidfromToken(context.req)
        const order = await Order.find({user: user._id}).populate('user', 'username').populate('orderitems.product');
        console.log(order)
        if(!order){
            return{
                message : 'No order found'
            }

        }
        return {
            order : order,
            message : 'Order fetched successfully'
         }   

    }catch(err){
        return {
            message : err.message
        }
    }
    }
    
}
module.exports = resolvers;
