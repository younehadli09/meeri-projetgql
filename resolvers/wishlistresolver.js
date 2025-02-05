const User = require('../models/User');
const { Product} = require('../models/Product');
const { WishList } = require('../models/Wishlist');
const {verifyTokenModerator,GetidfromToken} = require('../helpers/verify')
const mongoose = require('mongoose'); 
const dotenv = require('dotenv');
dotenv.config();



const resolvers = {
    wishlistGET: async (args, context) => {
        try {
            const user = await verifyTokenModerator(context.req); 
            const wishlistList = await WishList.findOne({ user: user._id }) 
                .populate('user', 'username email') 
                .populate({
                    path: 'product',
                    model: 'Product', 
                    select: '_id name description Price', 
                });
    
            if (!wishlistList || !wishlistList.product || wishlistList.product.length === 0) {
                return {
                    wishlist: null,
                    message: 'No wishlist found.',
                };
            }
    
            return {
                wishlist: wishlistList,
                message: 'Wishlist retrieved successfully.',
            };
        } catch (error) {
            return {
                wishlist: null,
                message: `Error: ${error.message}`,
            };
        }
    },
    
    wishlistGETByuser: async (args, context) => {
        try {
            const user = await GetidfromToken(context.req); // Extract user ID from token
            const wishlist = await WishList.findOne({ user: user._id }) // Assuming one wishlist per user
                .populate('user', 'username email') // Populate user details
                .populate({
                    path: 'product',
                    model: 'Product',
                    select: '_id name description Price', // Only retrieve relevant fields
                });
    
            if (!wishlist) {
                return {
                    wishlist: {
                        user: null,
                        product: [],
                    },
                    message: 'No wishlist found.',
                };
            }
    
            return {
                wishlist: {
                    user: wishlist.user, // Populated user details
                    product: wishlist.product, // Populated product details
                },
                message: 'Wishlist retrieved successfully.',
            };
        } catch (error) {
            return {
                wishlist: {
                    user: null,
                    product: [],
                },
                message: `Error: ${error.message}`,
            };
        }
    },
    
    

    wishlistcreate: async (args, context) => {
        try {
            const user = await GetidfromToken(context.req);
    
            const product = await Product.findById(args.input.product);
            if (!product) {
                return { message: 'Product not found' };
            }
    
            let wishlist = await WishList.findOne({ user: user._id });
    
            if (wishlist) {
                if (wishlist.product.some(p => p.equals(args.input.product))) {
                    return { message: 'Product already exists in wishlist' };
                }
                wishlist.product.push(args.input.product);
            } else {
                // Create a new wishlist if it doesn't exist
                wishlist = new WishList({
                    user: user._id,
                    product: [args.input.product],
                });
            }
    
            // Save the wishlist
            const savedWishlist = await wishlist.save();
    
            // Populate the wishlist for the response
            const populatedWishlist = await WishList.findById(savedWishlist._id)
                .populate('user', 'username email') // Populate user details
                .populate('product'); // Populate product details
    
            return { wishlist: populatedWishlist, message: 'Wishlist updated successfully!' };
        } catch (err) {
            return { message: `Server Error: ${err.message}` };
        }
    },
    
    
    
    
};
module.exports = resolvers;

