import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {User} from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import ApiResponse from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
const generateAccessAndRefreshTokens = async (userId) => {
    try{
        const user = await User.findById(userId);
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

const loginUser = asyncHandler(async(req,res)=>{
    const {username,email,password} = req.body;
    if(!password){
        throw new ApiError(400, "Password is required");
    }
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
const refreshAccessToken = asyncHandler(async (req, res) => {
    const LocalRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if(!LocalRefreshToken) {
        throw new ApiError(401, "Refresh token is not present");
    }
    try {
        const decodedToken = jwt.verify(LocalRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(404, "User not found");
        }
        if(user.refreshToken !== LocalRefreshToken) {
            throw new ApiError(401, "Refresh token expired");
        }
        const options = {
            httpOnly: true,
            secure: true
        };
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);
        res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options).json(new ApiResponse(200, "Access token refreshed successfully",{accessToken, refreshToken}));
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token");
    }
});
const changePassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body;
    if(!oldPassword || !newPassword) {
        throw new ApiError(400, "Old password and new password are required");
    }
    const user = await User.findById(req.user._id);
    if(!user) {
        throw new ApiError(404, "User not found");
    }
    const isPasswordMatch = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordMatch) {
        throw new ApiError(401, "Invalid old password");
    }
    user.password = newPassword;
    await user.save({validationBeforeSave: false});
    res.status(200).json(new ApiResponse(200, "Password changed successfully"));
});
const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, "Current user fetched successfully", req.user));
});
const changeAccountDetails = asyncHandler(async (req, res) => {
    const {username, email, fullName} = req.body;
    if([username,email,fullName].some(field=>(!field || field.trim() === ""))){
        throw new ApiError(400, "All fields are required");
    }
    const updatedUser = await User.findByIdAndUpdate(req.user?._id, {$set:{
        username: username.toLowerCase(),
        email,
        fullName
    }}, {new: true}).select("-password -refreshToken");
    res.status(200).json(new ApiResponse(200, "Account details updated successfully", updatedUser));
});
const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.files?.path;
    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar) {
        throw new ApiError(400, "Failed to upload avatar");
    }
    const updatedUser = await User.findByIdAndUpdate(req.user._id, {$set: {avatar: avatar.url}}, {new: true}).select("-password -refreshToken");
    res.status(200).json(new ApiResponse(200, "Avatar updated successfully", updatedUser));
});
const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.files?.path;
    if(!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing");
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!coverImage) {
        throw new ApiError(400, "Failed to upload cover image");
    }
    const updatedUser = await User.findByIdAndUpdate(req.user._id, {$set: {coverImage: coverImage.url}}, {new: true}).select("-password -refreshToken");
    res.status(200).json(new ApiResponse(200, "Cover image updated successfully",updatedUser));
});
const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {userneame} = req.params;
    if(!username?.trim()){
        throw new ApiError(400, "Username is required");
    }
    const channel = await User.aggregate([
        {
            $match:{
                username: username.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },{
            $addFields:{
                subscribersCount: {$size: "$subscribers"},
                subscribedToCount: {$size: "$subscribedTo"},
                isSubscribed:{
                    $cond:{
                        if: {$in : [req.user._id,"$subscribers.subscriber"]},
                        then : true,
                        else : false
                    }
                }
            }
        },{
            $project:{
                username: 1,
                fullName: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1,
                email: 1,
            }
        }
    ])
    if(channel?.length){
        throw new ApiError(404, "Channel not found");
    }
    res.status(200).json(new ApiResponse(200, "Channel profile fetched successfully", channel[0]));
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = User.aggregate([
        {
            $match:{
                _id : new mongoose.Types.ObjectId(req.user._id);
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline : [{
                    $lookup: {
                        from: "users",
                        localField:"owner",
                        foreignField: "_id",
                        as : "owner",
                        pipeline: [{
                            $project: {
                                username: 1,
                                fullName: 1,
                                avatar: 1
                            }
                        }]
                    }
                },{
                    $addFields: {
                        owner: {
                            $first: "$owner"
                        }
                    }
                }]
            }
        }
    ])
    return res.status(200).json(new ApiResponse(200, "Watch history fetched successfully", user[0].watchHistory));
});
export {registerUser, loginUser, logoutUser , refreshAccessToken , changePassword, getCurrentUser,changeAccountDetails,updateAvatar,getUserChannelProfile,getWatchHistory,updateCoverImage,getWatchHistory};
