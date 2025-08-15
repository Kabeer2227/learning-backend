import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadFile } from "../utils/cloundinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import { error } from "console"

const options = {
    httpOnly: true,
    secure: true
}

export const generateTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }

    } catch (error) {
        throw new Error(error)
    }
}

export const registerUser = asyncHandler(async (req, res) => {

    //get user details from front end.

    const { fullName, email, password, userName } = req.body;

    //validation
    if (
        [fullName, email, password, userName].some((field) =>
            field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    if (!email.includes('@') || !email.includes(".com")) {
        throw new ApiError(401, "Enter proper email")

    }
    //check if user already exists - username, email

    const doesUserExist = await User.findOne({
        $or: [{ userName }, { email }]
    })
    if (doesUserExist) {
        throw new ApiError(402, "User Already Exists")
    }

    // check for images

    const avatarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.files?.coverImage[0]?.path

    if (!avatarLocalPath) {
        throw new ApiError(403, "Avatar image is required!!");
    }

    if (!coverImageLocalPath) {
        throw new ApiError(403, "Cover image is required!!");
    }


    //upload them to cloudinary

    const avatarImage = await uploadFile(avatarLocalPath)
    const coverImage = await uploadFile(coverImageLocalPath)
    if (!avatarImage) {
        throw new ApiError(403, "Avatar image is required!!");
    }

    // create user object - create entry in DB

    const user = await User.create({
        fullName,
        avatar: avatarImage.url,
        coverImage: coverImage?.url || "",
        userName,
        email,
        password
    })


    // remove password and tokens from response

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) {
        throw new ApiError(500, "Somthing went wrong while creating a user")
    }


    // return response.
    console.log(user)
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )


})

export const loginUser = asyncHandler(async (req, res) => {
    // take input from frontend
    const { userName, email, password } = req.body
    // validate the input
    if (
        (!(userName || email))
    ) {
        throw new ApiError(400, "Enter either username or password")
    }

    if (password === "") throw new ApiError(400, "Enter Password")
    // check if user exists

    const user = await User.findOne({
        $or: [{ userName }, { email }]
    })

    if (!user) throw new ApiError(400, "User Does not exist")

    //validate login (username/email and password)

    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if (!isPasswordCorrect) throw new ApiError(400, "Incorrect password please try again")

    // generate tokens
    const { accessToken, refreshToken } = await generateTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // creating cookie

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200,
                {
                    user: loggedInUser, accessToken, refreshToken
                }, "User Logged In successfully"
            )
        )
})

export const logoutUser = asyncHandler(async (req, res) => {
    try {
        await User.findByIdAndUpdate(
            req.user._id, {
            $set: {
                refreshToken: undefined
            },

        }, {
            new: true
        }
        )



        return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(new ApiResponse(200, {}, "User Logged Out"))
    } catch (error) {
        throw new ApiError(501, "Error logging out", error)
    }
})

/*
 * Controller to refresh access token in case the access token times out.
 * Instead of logging in again, we can use the refresh token to refresh the access token.
 */
export const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken
        if (!incomingRefreshToken) throw new ApiError(400, "Invalid Request", error);
        const decodedRefreshToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN)

        const user = await User.findById(decodedRefreshToken._id)

        if (!user) throw new ApiError(400, "Invalid Refresh Token");

        if (incomingRefreshToken !== user.refreshToken) throw new ApiError(400, "Invalid Refresh Token");



        const { refreshToken, accessToken } = await generateTokens(user._id);

        res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshTOken", refreshToken, options)
            .json(new ApiResponse(200, { accessToken, refreshToken }, "Tokens Refreshed"))

    } catch (error) {
        throw new ApiError(500, "Internal Server Error, please log in again", error)
    }

})

export const changeCurrentPassword = asyncHandler(async (req, res) => { // use auth middle ware
    try {
        const { oldPassword, newPassword } = req
        const user = await User.findById(req.user?._id);
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
        if (!isPasswordCorrect) {
            throw new ApiError(400, "Old password is incorrect");
        }
        user.password = newPassword
        await user.save({ validateBeforeSave: false })
        return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"))
    } catch (error) {
        throw new ApiError(500, "Internal Server Error, can not change password")
    }
})

export const getCurrentUser = asyncHandler(async (req, res) => {
    try {
        const user = req.user;
        if (!user) throw new ApiError(500, "Can not get current user");
        return res.status(200).json(new ApiResponse(200, user, "User successfully retrived"))
    } catch (error) {
        throw new ApiError(500, "Internal Server Error, can not retrive user exception", error)
    }
})

export const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { userName } = req.params

    if (!userName) throw new ApiError(400, "username missing");

    const channel = await User.aggregate([
        {
            $match: {
                userName: userName?.toLowerCase()
            }
        }, {
            $lookup: {
                from: "subscriptons",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        }, {
            $lookup: {
                from: "subscriptons",
                localField: "_id",
                foreignField: "subscribers",
                as: "suscribedTo"
            }
        }, {
            $addFields: {
                suscriberCount: {
                    $size: "$suscribers"
                },
                suscribedToCount: {
                    $size: "$suscribedTo"
                },
                isSuscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$suscribers.suscriber"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },{
            $project:{
                fullName:1,
                userName:1,
                suscriberCount:1,
                suscribedToCount:1,
                isSuscribed:1,

            }
        }
    ])

    console.log(channel)

    if(!channel.length) throw new ApiError(500,"channel does not exist");

    return res.status(200).json(
        200, new ApiResponse(200, channel[0], "User channel displayed")
    )

})