import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const VerifyJwt = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];
        if(!token){
            throw new ApiError(401, "Unauthorized, No token provided");
        }
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decoded?._id).select("-password -refreshToken");
        if(!user){
            throw new ApiError(401, "Unauthorized, User not found");
        }
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, "Unauthorized, Invalid token");
    }
});

export default VerifyJwt;