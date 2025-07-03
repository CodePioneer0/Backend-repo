import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {User} from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import ApiResponse from '../utils/ApiResponse.js';
const generateAccessAndRefreshTokens = async (userId) => {
    try{
        const user = User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        await user.save({validationBeforeSave: false});
        return {accessToken,refreshToken};
    }
    catch(error) {
        throw new ApiError(500, "Failed to generate tokens");
    }
}





const registerUser = asyncHandler(async (req, res) => {
    // Logic for registering a user
    const {username,email,fullName,password} = req.body;
    if([username,email,fullName,password].some(field=>(!field || field.trim() === ""))){
        throw new ApiError(400, "All fields are required");
    }
    const existedUser = await User.findOne({
        $or : [{email}, {username}]
    })
    if(existedUser) {
        throw new ApiError(409, "User already exists with this email or username");
    }
    let avatarLocalPath = null;
    if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
        avatarLocalPath = req.files.avatar[0].path;
    }
    let coverLocalPath = null;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverLocalPath = req.files.coverImage[0].path;
    }
    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = coverLocalPath ? await uploadOnCloudinary(coverLocalPath) : null;
    if(!avatar) {
        throw new ApiError(400, "Failed to upload avatar");
    }
    const user = await User.create({
        username:username.toLowerCase(),
        email,
        fullName,
        password,
        avatar: avatar.url,
        coverImage: coverImage ? coverImage.url : ""
    });
    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    if(!createdUser) {
        throw new ApiError(500, "Failed to create user");
    }
    res.status(201).json(new ApiResponse(201, "User registered successfully", createdUser));

});

const loginUser = asyncHandler(async()=>{
    const {username,email,password} = req.body;
    if(!username && !email) {
        throw new ApiError(400, "Username or email is required");
    }
    const user = await User.findOne({
        $or:[{username} , {email}]
    })
    if(!user) {
        throw new ApiError(404, "User not found");
    }
    const isPasswordMatch = await user.isPasswordCorrect(password);
    if(!isPasswordMatch) {
        throw new ApiError(401, "Invalid password");
    }
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);
    const userData = await User.findById(user._id).select("-password -refreshToken");
    const options = {
        httpOnly: true,
        secure : true
    }
    return res.status(200).cookie("accessToken", accessToken,options).cookie("refreshToken", refreshToken,options).json(new ApiResponse(200, "User logged in successfully", {
        user: userData,
        accessToken,
        refreshToken
    }));
});
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id,{$set: {refreshToken: null}}, {new: true});
    const options = {
        httpOnly: true,
        secure: true
    };
    return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(new ApiResponse(200, "User logged out successfully"));

});
export {registerUser, loginUser, logoutUser};
