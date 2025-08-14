import  jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
        const token = req.cookies?.accessToken || req
        .header("Authorization")?.replace("Bearer ", "");

    if (!token) throw new ApiError(500, "Un-authorized request");

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN)

    const user = await User.findById(decodedToken._id).select("-password -refreshToken");

    if(!user) throw new ApiError(500, "AccessToken is invalid");

    //put user in req body for next request to use

    req.user = user

    next()
    } catch (error) {
        throw new ApiError(400,"Authorization error", error)
    }

})