import { Router } from "express";
import {loginUser,logoutUser,refreshAccessToken,registerUser} from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js";
import verifyJwt from "../middlewares/auth.middleware.js";
const router = Router();
router.route("/register").post(upload.fields([{
    name: "avatar",
    maxCount: 1
},{
    name: "coverImage",
    maxCount: 1
}]),registerUser);

router.route("/login").post(loginUser);

//secured routes

router.route("/logout").post(verifyJwt,logoutUser);
router.route("refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJwt,changePassword);
router.route("/current-user").get(verifyJwt,getCurrentUser);
router.route("/update-account").patch(verifyJwt,changeAccountDetails);
router.route("/avatar").patch(verifyJwt,upload.single("avatar"),updateAvatar);
router.route("/cover-image").patch(verifyJwt,upload.single("coverImage"),updateCoverImage);
router.route("/channel-profile/:username").get(verifyJwt,getUserChannelProfile);
router.route("/watch-history").get(verifyJwt,getWatchHistory);
export default router;