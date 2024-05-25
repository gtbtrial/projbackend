const express = require('express');
const app = express();
const port = 9000

app.use(express.urlencoded({extended:false}))//req.body capability
app.use(express.json())//reading json format from body

var cors = require('cors')
app.use(cors())

const bcrypt = require('bcrypt');
const saltRounds = 10;

require('dotenv').config()

const multer  = require('multer');

const fs = require('fs');
const uuid = require('uuid');

var jwt = require('jsonwebtoken');

let mystorage = multer.diskStorage({
    destination: (req, file, cb) => 
    {
      cb(null, "public/uploads");//we will have to create folder ourselves
    },
    filename: (req, file, cb) => 
    {
        var picname = Date.now() + file.originalname;//1711956271167oil3.webp
      //milliseconds will be added with original filename and name will be stored in picname variable
        cb(null, picname);
    }
  });
  let upload = multer({ storage: mystorage });



const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service : 'hotmail',
    auth : {
        user : `${process.env.SMTP_UNAME}`,
        pass : `${process.env.SMTP_PASS}`
    }
  })

  function verifytoken(req,res,next)
  {
    if(!req.headers.authorization)
    {
      return res.status(401).send('Unauthorized Request')
    }
    let token = req.headers.authorization
    if(token=='null')
    {
      return res.status(401).send('Unauthorized request')
    }
    let payload = jwt.verify(token, process.env.TOKEN_SECRET_KEY)
    if(!payload)
    {
      return res.status(401).send('Unauthorized Request')
    }
    next()
  }


const mongoose = require('mongoose');


// mongoose.connect('mongodb://127.0.0.1:27017/projdb').then(() => console.log('Connected to MongoDB!'));

mongoose.connect('mongodb+srv://projdbuser:projdbpass123@cluster0.2aycpdc.mongodb.net/projdb?retryWrites=true&w=majority&appName=Cluster0').then(() => console.log('Connected to MongoDB!'));

var registerSchema = new mongoose.Schema({
    name:String,
    phone:String,
    username:{type:String,unique:true},
    password:String,
    usertype:String,
    activated:Boolean,
    actcode:String},
    {versionKey:false})

const registerModel = mongoose.model("register",registerSchema,"register");// internal model name, schema_name, real collection_name

app.post("/api/signup",async(req,res)=>
{
    try
    {
        const hash = bcrypt.hashSync(req.body.pass, saltRounds);
        var token = uuid.v4();
        var newrecord = new registerModel({name:req.body.pname,phone:req.body.phone,username:req.body.uname,password:hash, usertype:"normal",activated:false,actcode:token})

        var result = await newrecord.save();
        if(result)
        {
            const mailOptions = 
            {
            from: 'groceryplanet@hotmail.com',
            to: req.body.uname,
            subject: 'Activate your account :: SuperMarket.com',
            text: `Dear ${req.body.pname}\n\n Thanks for signing up on our website. Click on the following link to activate your account\n\n http://localhost:3000/activate?token=${token}`
            };
        
            // Use the transport object to send the email
            transporter.sendMail(mailOptions, (error, info) => 
            {
                if (error) 
                {
                    console.log(error);
                    res.status(200).send({statuscode:-2,msg:'Error sending email'})
                } 
                else 
                {
                    res.status(200).send({statuscode:1})
                    console.log('Email sent: ' + info.response);
                    res.send({msg:"Message sent successfully"});
                }
            });   
            
        }
        else
        {
            res.status(500).send({statuscode:0,msg:"Signup not successfull"})
        }
    }
    catch(e)
    {
        console.log(e.message);
        res.status(500).send({statuscode:-1,msg:"Error Occured try again"})
    }
})
app.get("/api/activateaccount/:token", async (req, res)=>
{
    try
        {
        var updateresult = await registerModel.updateOne({actcode: req.params.token }, { $set: {activated:true}});

        if(updateresult.modifiedCount===1)
        {
            res.send({statuscode:1});
        }
        else
        {
            res.send({statuscode:0})
        }
    }
    catch(e)
    {
        res.status(500).send({statuscode:-1})
    }
  });


app.post("/api/createadmin",async(req,res)=>
{
    try
    {
        const hash = bcrypt.hashSync(req.body.pass, saltRounds);

        var newrecord = new registerModel({name:req.body.pname,phone:req.body.phone,username:req.body.uname,password:hash, usertype:"admin"})

        var result = await newrecord.save();
        if(result)
        {
            res.status(200).send({statuscode:1,msg:"Admin created successfully"})
        }
        else
        {
            res.status(500).send({statuscode:0,msg:"Admin not created successfully"})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})


app.get("/api/login",async(req,res)=>
{
    try
    {
        var result = await registerModel.findOne({username:req.query.un})
        var result2 = await registerModel.findOne({username:req.query.un}).select("-password").select("-phone");
        if(result)
        {
            var passhash = result.password;
            if(bcrypt.compareSync(req.query.pass, passhash))
            {
                if(result.activated===true)
                {
                    if(result.usertype==="admin")
                    {
                        //token issue
                        let token = jwt.sign({data: result._id}, process.env.TOKEN_SECRET_KEY, { expiresIn: '1h' });
                        res.status(200).send({statuscode:1,userdata:result2,jtoken:token})
                    }
                    else
                    {
                        res.status(200).send({statuscode:1,userdata:result2})
                    }
                }
                else
                {
                    res.status(200).send({statuscode:2})
                }
            }
            else
            {
                res.status(200).send({statuscode:0,msg:"Username/Password Incorrect"})
            }
        }
        else
        {
            res.status(200).send({statuscode:0,msg:"Username/Password Incorrect"})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.get("/api/fetchuserbyid/:uid",async(req,res)=>
{
    try
    {
        var result = await registerModel.findOne({_id:req.params.uid}).select("-password").select("-phone");
        if(result)
        {
            if(result.usertype==="admin")
            {
                //token issue
                let token = jwt.sign({data: result._id}, process.env.TOKEN_SECRET_KEY, { expiresIn: '1h' });
                res.status(200).send({statuscode:1,userdata:result,jtoken:token})
            }
            else
            {
                res.status(200).send({statuscode:1,userdata:result})
            }          
        }
        else
        {
            res.status(200).send({statuscode:0,msg:"Username/Password Incorrect"})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.get("/api/searchuser",async(req,res)=>
{
    try
    {
        var result = await registerModel.findOne({username:req.query.un}).select("-password");
        console.log(result);
        if(result)
        {
            res.status(200).send({statuscode:1,udata:result})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

var resetPasswordSchema = new mongoose.Schema({username:String,token:String,exptime:String}, { versionKey: false } );
var resetpassModel = mongoose.model("resetpass",resetPasswordSchema,"resetpass");

app.get("/api/forgotpassword",async(req,res)=>
{
    try
    {
        var result = await registerModel.findOne({username:req.query.un});
        console.log(result);
        if(result)
        {
            var resettoken = uuid.v4();
            var minutesToAdd=15;
            var currentDate = new Date();
            var futureDate = new Date(currentDate.getTime() + minutesToAdd*60000);
        
            var newreset = new resetpassModel({username:req.query.un,token:resettoken,exptime:futureDate});
            let saveresult = await newreset.save();
        
            if(saveresult)
            {
                const resetLink = `http://localhost:3000/resetpassword?token=${resettoken}`;
                const mailOptions = {
                from: 'groceryplanet@hotmail.com',
                to: req.query.un,
                subject: 'Reset your password::ShoppingPlaza.com',
                text: `Hi ${result.name},\n\n Please click on the following link to reset your password: \n\n ${resetLink}`
                };
                // Use the transport object to send the email
                transporter.sendMail(mailOptions, (error, info) => 
                {
                    if (error) 
                    {
                        console.log(error);
                        res.status(500).send({msg:'Error sending email'});
                    } 
                    else 
                    {
                        console.log('Email sent: ' + info.response);
                        res.status(200).send({msg:"Please check your mail to reset your password"});
                    }
                });
            }
            else
            {
                res.send({msg:"Error, try again"});
            }
        }
        else
        {
            res.status(200).send({msg:"Invalid Username"})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})


app.get('/api/verifytoken', async (req, res) => 
{
  const resetdata = await resetpassModel.findOne({ token: req.query.token });
  if (!resetdata) 
  {
    return res.send({statuscode:-1,msg:'Invalid reset link. Try Again'});
  }
  else
  {
    console.log(resetdata);
    var exptime = new Date(resetdata.exptime);//Thu Apr 25 2024 11:17:22 GMT+0530 (India Standard Time)
    var currenttime = new Date();//Thu Apr 25 2024 11:11:22 GMT+0530 (India Standard Time)

    if(currenttime<exptime)
    {
      res.send({statuscode:1,username:resetdata.username})
    }
    else
    {
      return res.send({statuscode:0,msg:'Link Expired. It was valid for 15 mins only. Request new link'});
    }
  }
});

app.get("/api/fetchusers",async(req,res)=>
{
    try
    {
        var result = await registerModel.find().select("-password");;
        console.log(result);
        if(result)
        {
            res.status(200).send({statuscode:1,allusers:result})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.delete("/api/deluser/:uid",async(req,res)=>
{
    try
    {
        var result = await registerModel.findByIdAndDelete(req.params.uid);//{ acknowledged: true, deletedCount: 1 }
        console.log(result);
        if(result.deletedCount===1)
        {
            res.status(200).send({statuscode:1})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1})
    }
})


app.put("/api/changepass",async(req,res)=>
{
    try
    {
        var result = await registerModel.findOne({username:req.body.uname})
        if(result)
        {
            var passhash = result.password;
            if(bcrypt.compareSync(req.body.currpass, passhash))
            {
                const encpass = bcrypt.hashSync(req.body.newpass, 10);
                var updateresult = await registerModel.updateOne({ username: req.body.uname }, { $set: {password:encpass}});
                console.log(updateresult);
                if(updateresult.modifiedCount===1)
                {
                    res.status(200).send({statuscode:1,msg:"Password changed successfully"})
                }
                else
                {
                    res.status(200).send({statuscode:0,msg:"Problem while changing password"})
                }
            }
            else
            {
                res.status(200).send({statuscode:0,msg:"Current Password Incorrect"})
            }
        }
        else
        {
            res.status(200).send({statuscode:0,msg:"Username Incorrect"})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.put("/api/resetpass",async(req,res)=>
{
    try
    {

        const encpass = bcrypt.hashSync(req.body.newpass, 10);
        var updateresult = await registerModel.updateOne({ username: req.body.uname }, { $set: {password:encpass}});
        console.log(updateresult);
        if(updateresult.modifiedCount===1)
        {
            res.status(200).send({statuscode:1,msg:"Password changed successfully"})
        }
        else
        {
            res.status(200).send({statuscode:0,msg:"Problem while changing password"})
        }
           
      
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})


var catSchema = new mongoose.Schema({
    catname:String,
    picture:String},
    {versionKey:false})

const catModel = mongoose.model("category",catSchema,"category");// internal model name, schema_name, real collection_name

app.post("/api/savecategory",verifytoken,upload.single('picture'),async(req,res)=>
{
    try
    {
        var picturename;
        if(!req.file)
        {
            picturename="defaultpic.jpg";
        }
        else
        {
            picturename=req.file.filename;
        }

        var newrecord = new catModel({catname:req.body.cname,picture:picturename})
        var result = await newrecord.save();
        if(result)
        {
            res.status(200).send({statuscode:1})
        }
        else
        {
            res.status(500).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.get("/api/fetchallcat",async(req,res)=>
{
    try
    {
        var result = await catModel.find();
        console.log(result);
        if(result)
        {
            res.status(200).send({statuscode:1,data:result})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.put("/api/updatecategory",upload.single('picture'),async(req,res)=>
{
    try
    {
        var picturename;
        if(!req.file)
        {
            picturename=req.body.oldpicname;
        }
        else
        {
            picturename=req.file.filename;
            if(req.body.oldpicname!=="defaultpic.jpg")
            {
                fs.unlinkSync(`public/uploads/${req.body.oldpicname}`);
            }
        }

        var updateresult = await catModel.updateOne({ _id: req.body.catid }, { $set: {catname:req.body.cname,picture:picturename}});

        if(updateresult.modifiedCount===1)
        {
            res.status(200).send({statuscode:1})
        }
        else
        {
            res.status(500).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})


var subcatSchema = new mongoose.Schema({
    catid:String,
    subcatname:String,
    picture:String},
    {versionKey:false})

const subcatModel = mongoose.model("subcategory",subcatSchema,"subcategory");// internal model name, schema_name, real collection_name

app.post("/api/savesubcategory",upload.single('picture'),async(req,res)=>
{
    try
    {
        var picturename;
        if(!req.file)
        {
            picturename="defaultpic.jpg";
        }
        else
        {
            picturename=req.file.filename;
        }

        var newrecord = new subcatModel({catid:req.body.catid,subcatname:req.body.scname,picture:picturename})
        var result = await newrecord.save();
        if(result)
        {
            res.status(200).send({statuscode:1})
        }
        else
        {
            res.status(500).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.get("/api/fetchsubcat/:cid",async(req,res)=>
{
    try
    {
        var result = await subcatModel.find({catid:req.params.cid});
        if(result.length>0)
        {
            res.status(200).send({statuscode:1,data:result})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.put("/api/updatesubcategory",upload.single('picture'),async(req,res)=>
{
    try
    {
        var picturename;
        if(!req.file)
        {
            picturename=req.body.oldpicname;
        }
        else
        {
            picturename=req.file.filename;
            if(req.body.oldpicname!=="defaultpic.jpg")
            {
                fs.unlinkSync(`public/uploads/${req.body.oldpicname}`);
            }
        }

        var updateresult = await subcatModel.updateOne({ _id: req.body.subcatid }, { $set: {catid:req.body.catid,subcatname:req.body.scname,picture:picturename}});

        if(updateresult.modifiedCount===1)
        {
            res.status(200).send({statuscode:1})
        }
        else
        {
            res.status(500).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

var productSchema = new mongoose.Schema({
    catid:String,
    subcatid:String,
    prodname:String,
    rate:Number,
    discount:Number,
    description:String,
    stock:Number,
    featured:String,
    addedon:String,
    picture:String},
    {versionKey:false})

const productModel = mongoose.model("product",productSchema,"product");// internal model name, schema_name, real collection_name

app.post("/api/saveproduct",upload.single('picture'),async(req,res)=>
{
    try
    {
        var picturename;
        if(!req.file)
        {
            picturename="defaultpic.jpg";
        }
        else
        {
            picturename=req.file.filename;
        }

        var newrecord = new productModel({catid:req.body.catid,
            subcatid:req.body.subcatid,
            prodname:req.body.pname,
            rate:req.body.rate,
            discount:req.body.dis,
            description:req.body.desc,
            stock:req.body.stock,
            featured:req.body.featured,
            addedon:new Date(),
            picture:picturename})
        var result = await newrecord.save();
        if(result)
        {
            res.status(200).send({statuscode:1})
        }
        else
        {
            res.status(500).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.get("/api/fetchprodsbysubcat/:scid",async(req,res)=>
{
    try
    {
        var result = await productModel.find({subcatid:req.params.scid});
        if(result.length>0)
        {
            res.status(200).send({statuscode:1,data:result})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})
app.get("/api/fetchproddetailsbyid/:pid",async(req,res)=>
{
    try
    {
        var result = await productModel.findById(req.params.pid);
        console.log(result);
        if(result)
        {
            res.status(200).send({statuscode:1,data:result})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.put("/api/updateproduct",upload.single('picture'),async(req,res)=>
{
    try
    {
        var picturename;
        if(!req.file)
        {
            picturename=req.body.oldpicname;
        }
        else
        {
            picturename=req.file.filename;
            if(req.body.oldpicname!=="defaultpic.jpg")
            {
                fs.unlinkSync(`public/uploads/${req.body.oldpicname}`);
            }
        }

        var updateresult = await productModel.updateOne({ _id: req.body.pid }, { $set: {catid:req.body.catid,
            subcatid:req.body.subcatid,
            prodname:req.body.pname,
            rate:req.body.rate,
            discount:req.body.dis,
            description:req.body.desc,
            stock:req.body.stock,
            featured:req.body.featured,
            picture:picturename}});

        if(updateresult.modifiedCount===1)
        {
            res.status(200).send({statuscode:1})
        }
        else
        {
            res.status(500).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

var cartSchema = new mongoose.Schema({
    prodid:String,
    picture:String,
    pname:String,
    rate:Number,
    qty:Number,
    totalcost:Number,
    username:String},
    {versionKey:false})
const cartModel = mongoose.model("cart",cartSchema,"cart");// internal model name, schema_name, real collection_name
app.post("/api/addtocart",async(req,res)=>
{
    try
    {
        var newrecord = new cartModel({ prodid:req.body.prodid,
            picture:req.body.picname,
            pname:req.body.prodname,
            rate:req.body.remcost,
            qty:req.body.qty,
            totalcost:req.body.tc,
            username:req.body.uname})

        var result = await newrecord.save();
        if(result)
        {
            res.status(200).send({statuscode:1})
        }
        else
        {
            res.status(500).send({statuscode:0,msg:"Error while adding to cart"})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})
app.get("/api/fetchcart/:uname",async(req,res)=>
{
    try
    {
        var result = await cartModel.find({username:req.params.uname})
        console.log(result);
        if(result.length>0)
        {
            res.status(200).send({statuscode:1,data:result})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})


var orderSchema = new mongoose.Schema({
    address:String,
    state:String,
    city:String,
    pmode:String,
    cardno:String,
    hname:String,
    exp:String,
    cvv:String,
    username:String,
    OrderDate:String,
    Status:String,
    OrderAmount:Number,
    OrderItems:[Object]},
    {versionKey:false})

const OrderModel = mongoose.model("finalorder",orderSchema,"finalorder");// internal model name, schema_name, real collection_name

app.post("/api/saveorder",async(req,res)=>
{
    try
    {
        var newrecord = new OrderModel({address:req.body.saddr,
            state:req.body.state,city:req.body.city,pmode:req.body.pmode,cardno:req.body.cardno,
            hname:req.body.hname,exp:req.body.exp,cvv:req.body.cvv,
            username:req.body.uname,
            OrderDate:new Date(),
            Status:"Order Received, Processing",
            OrderAmount:req.body.oamt,
            OrderItems:req.body.cartdata})

        var result = await newrecord.save();
        if(result)
        {
            let updateresp=false;
            var updatelist=req.body.cartdata;//updatelist becomes an array becoz we are saving an json array into it
            for(let x=0;x<updatelist.length;x++)
            {
                var updateresult = await productModel.updateOne({_id:updatelist[x].prodid},{$inc: {"stock":-updatelist[x].qty}});
                if(updateresult.modifiedCount===1)
                {
                    updateresp=true;
                }
                else
                {
                    updateresp=false;
                }
            }

            if(updateresp==true)
            {
                var delres = cartModel.deleteMany({username:req.body.uname})
                if((await delres).deletedCount>=1)
                {
                    res.json({statuscode:1});
                }
                else
                {
                    res.json({statuscode:0});
                }
            }
            else
            {
                res.json({statuscode:0});
            }
        }
        else
        {
            res.status(500).send({statuscode:0,msg:"Error while placing order"})
        }
    }
    catch(e)
    {
        console.log(e.message);
        res.status(500).send({statuscode:-1,msg:e.message})
    }
})

app.get("/api/fetchorderid",async (req,res)=>
{
    var result = await OrderModel.findOne({username:req.query.un}).sort({"OrderDate":-1});
    console.log(result)
    if(!result)
    {
        res.send({statuscode:0})
    }
    else
    {
        res.send({statuscode:1,data:result})
    }   
})

app.get("/api/fetchorders",async(req,res)=>
{
    try
    {
        var result = await OrderModel.find().sort({"OrderDate":-1});
        if(result.length>0)
        {
            res.status(200).send({statuscode:1,data:result})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})
app.get("/api/fetchorderitems/:oid",async(req,res)=>
{
    try
    {
        var result = await OrderModel.findOne({_id:req.params.oid})
        if(result)
        {
            res.status(200).send({statuscode:1,data:result.OrderItems})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.put("/api/updatestatus",async(req,res)=>
{
    try
    {
        var updateresult = await OrderModel.updateOne({ _id: req.body.oid}, { $set: {Status:req.body.newstatus}});

        if(updateresult.modifiedCount===1)
        {
            res.status(200).send({statuscode:1})
        }
        else
        {
            res.status(500).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.get("/api/fetchuserorders/:un",async(req,res)=>
{
    try
    {
        var result = await OrderModel.find({username:req.params.un}).sort({"OrderDate":-1});
        if(result.length>0)
        {
            res.status(200).send({statuscode:1,data:result})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})

app.get("/api/searchproduct/:term", async(req, res)=>
{
  var searchtext=req.params.term;

  var result = await productModel.find({prodname: { $regex: '.*' + searchtext ,$options:'i' }});
    if (result.length===0)
    {
        res.json({statuscode:0})
    }
    else
    {     
        res.send({statuscode:1,data:result});
    }
});

app.get("/api/fetchfeatprods",async(req,res)=>
{
    try
    {
        var result = await productModel.find({featured:"yes"}).limit(6);
        if(result.length>0)
        {
            res.status(200).send({statuscode:1,data:result})
        }
        else
        {
            res.status(200).send({statuscode:0})
        }
    }
    catch(e)
    {
        console.log(e);
        res.status(500).send({statuscode:-1,msg:"Some error occured"})
    }
})


app.post("/api/contactus",async (req, res)=> 
  {
      const mailOptions = 
      {
      from: 'groceryplanet@hotmail.com',
      to: 'groceryplanet@hotmail.com',
      subject: 'Message from Website - Contact Us',
      text: `Name:- ${req.body.name}\nPhone:-${req.body.phone}\nEmail:-${req.body.email}\nMessage:-${req.body.msg}`
    };
  
    // Use the transport object to send the email
    transporter.sendMail(mailOptions, (error, info) => 
    {
      if (error) {
        console.log(error);
        res.send({msg:'Error sending email'});
      } 
      else 
      {
        console.log('Email sent: ' + info.response);
        res.send({msg:"Message sent successfully"});
      }
    });
  
  });

  const ProdImagesSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    imageNames: [String]
  },{versionKey: false});
  
  const ProdImagesModel = mongoose.model('prodpics', ProdImagesSchema,"prodpics");

  app.post('/api/prodimages', upload.array('images'), async (req, res) => {
    try 
    {
        const { productId } = req.body;
        let existingRecord = await ProdImagesModel.findOne({productId});
        if (!existingRecord) 
        {
            const imageNames = req.files.map(file => file.filename);
            const record = await ProdImagesModel.create({ productId, imageNames });
            if (record) 
            {
                res.json({ statuscode: 1 });
            }
            else 
            {
                res.json({ statuscode: 0 });
            }
        }
        else 
        {
            const newImageNames = req.files.map(file => file.filename);
            const updatedImageNames = existingRecord.imageNames.concat(newImageNames);

            existingRecord.productId = productId;
            existingRecord.imageNames = updatedImageNames;

            const updatedRecord = await existingRecord.save();
            if(updatedRecord)
            {
                res.json({ statuscode: 1 });
            }
            else
            {
                res.json({ statuscode: 0 });
            }
        }
    } 
    catch (e) 
    {
        console.error('Error updating product images:', e);
        res.status(500).json({ statusCode: 0, error: 'Server error' });
    }
});

//   app.post('/api/prodimages', upload.array('images'), async (req, res) => 
//   {
//     const { productId } = req.body;
//     try 
//     {
//         const imageNames = req.files.map(file => file.filename);
        
//         const record = await ProdImagesModel.create({productId,imageNames});
//         if(record)
//         {
//             res.json({statuscode:1});
//         }
//         else
//         {
//             res.json({statuscode:0});
//         }
//     } 
//     catch (e) 
//     {
//       console.error('Error saving product images:', e);
//       res.status(500).json({statuscode:0, error: 'Server error' });
//     }
//   });

  app.get('/api/fetchprodimages/:pid', async (req, res) => {
    try 
    {
      const record = await ProdImagesModel.findOne({productId:req.params.pid});
      if (record) 
      {
        return res.json({statuscode:1,pics:record.imageNames});
      }
      else
      {
        return res.status(200).json({statuscode:0, error: 'Images not found' });
      }
    } 
    catch (e) 
    {
      console.error('Error fetching images:', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.delete('/api/delprodimage/:id/:imageName', async (req, res) => 
    {
        const { id, imageName } = req.params;
        try 
        {
            let existingRecord = await ProdImagesModel.findOne({productId:id});
            if (!existingRecord) 
            {
            return res.status(200).json({ statuscode: 0, error: 'Record not found' });
            }
        
            existingRecord.imageNames = existingRecord.imageNames.filter(name => name !== imageName);

            const updatedRecord = await existingRecord.save();
            
            if(updatedRecord)
            {
                if (imageName !== "defaultpic.jpg") 
                {
                    if (fs.existsSync(`public/uploads/${imageName}`))
                    {
                        fs.unlinkSync(`public/uploads/${imageName}`);
                    }
                }
                res.json({ statuscode: 1 });
            }
        } 
        catch (e) 
        {
            console.error('Error deleting product image name:', e);
            res.status(500).json({ statusCode: 0, error: 'Server error' });
        }
    });

app.listen(port,()=>
{
    console.log(`Server is running on port ${port}`);
})

