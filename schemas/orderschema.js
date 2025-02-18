const { buildSchema } = require('graphql');

const { GraphQLScalarType, Kind } = require('graphql');
const DateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Custom scalar type for Date',
  parseValue(value) {
    return new Date(value);
  },
  serialize(value) {
    return value.getTime(); 
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10));
    }
    return null;
  },
});

const GETschemma = buildSchema(`
      type Productsize{
    size : String
    stock : Int
    }
    

    type Productdetail{
    color : String
    sizes: [Productsize]

    }
      type Product{
        _id :String
        name: String
        description: String
        richDescription: String
        images: [String]
        brand: String
        Price: Int
        category:String
        CountINStock:Int
        rating: Int
        IsFeatured: Boolean
        productdetail: [Productdetail]
    }
  type OrderItem {
    _id: ID
    quantity: Int
    size : String
    color : String
    product: Product
    priceproduct :Int
    createdAt: Date
    updatedAt: Date
  }



  type User {
    _id: ID
    username: String
    phonenumber : String
  }

  scalar Date

  type Order {
    firstname : String
    lastname : String
    email: String
    _id: ID
    idorder: String 
    orderitems: [OrderItem]
    adress: String
    wilaya: String
    commune : String
    phonenumber: String
    status: String
    totalprice: Float
    quantityOrder: Int
    user: User
    dateordered: Date
    createdAt: Date
    updatedAt: Date
  }

  type response {
  order  : [Order]
  message : String
  }

  type Query {
    orderGETById(_id: ID!): Order
    orderGET: [Order]
    userorderGET: response 
  }
`);

const POSTschemma = buildSchema(`
   type Productsize{
    size : String
    stock : Int
    }
    

    type Productdetail{
    color : String
    sizes: [Productsize]

    }
      type Product{
        _id :String
        name: String
        description: String
        richDescription: String
        images: [String]
        brand: String
        Price: Int
        category:String
        CountINStock:Int
        rating: Int
        IsFeatured: Boolean
        productdetail: [Productdetail]
    }
  type OrderItem {
    _id: ID
    quantity: Int
    size : String
    color : String
    product: Product
    priceproduct :Int
    createdAt: Date
    updatedAt: Date
  }

  type User {
    _id: ID
    username: String
    phonenumber : String
  }

  scalar Date

  type Order {
    firstname : String
    lastname : String
    email : String
    _id: ID
    idorder: String 
    orderitems: [OrderItem]
    adress: String
    wilaya: String
    commune : String
    phonenumber: String
    status: String
    totalprice: Float
    quantityOrder: Int
    user: User
    dateordered: Date
    createdAt: Date
    updatedAt: Date
  }

  input OrderItemInput {
    quantity: Int
    product: ID
    color : String
    size : String
  }

  input OrderInput {
    livprice : Int
    orderitems: [OrderItemInput]
    adress: String
    wilaya: String
    commune : String
    phonenumber: String
    totalprice: Float
    quantityOrder: Int
  }

  input DeleteInput {
    _id: String
  }

  input statusINPUT {
    _id: String
    statusUpdate: String  
  }
    input OrderInputAnonym {
      livprice : Int
      firstname : String
      lastname : String
      email :String
      orderitems: [OrderItemInput]
      adress: String
      wilaya: String
      commune : String
      phonenumber: String
      totalprice: Float
      quantityOrder: Int
  }

  type Response {
   orderitems :[OrderItem]
    user : User
    order: Order
    message: String
  }

  type Query {
    _empty: String
  }

  type Mutation {
    createOrder(input: OrderInput): Response
    createOrderAnonym(input: OrderInputAnonym): Response

    updateOrderStatus(input: statusINPUT): Response
    orderDELETE(input: DeleteInput): Response
  }
`);

module.exports = { GETschemma, POSTschemma, DateScalar };
 
