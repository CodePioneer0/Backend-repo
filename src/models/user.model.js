import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
const userSchema = new mongoose.Schema({
    username:{
        type : String,
        required: true,
        unique: true,
        lowercase:true,
        trim: true,
        index: true
    },
    email:{
        type : String,
        required: true,
        unique: true,
        lowercase:true,
        trim: true
    },
    fullName:{
        type:String,
        required: true,
        trim: true,
        index: true
    },
    avatar:{
        type : String,
        required:true
    },
    coverImage:{
        type : String
    },
    watchHistory:[{
        type : mongoose.Schema.Types.ObjectId,
        ref: 'Video'
    }],
    password:{
        type : String,
        required : [true,"Password Is Required"],
    },
    refreshToken:{
        type : String,
    }
},{timestamps: true});
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});
userSchema.methods.isPasswordCorrect = async function(candidatePassword) {
    if(!candidatePassword || !this.password) {
        throw new Error("Password and hash are required");
    }
    return await bcrypt.compare(candidatePassword, this.password);
}
userSchema.methods.generateAccessToken = function() {
    return jwt.sign({ _id: this._id,
        username: this.username,
        email: this.email,
        fullName: this.fullName
    }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRY });
}
userSchema.methods.generateRefreshToken = function() {
    return jwt.sign({ _id: this._id}, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRY });
}
export const User = mongoose.model('User', userSchema);