import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadFile } from "../utils/cloundinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

export const generateTokens = async (userId) => {
    try {
        const user = User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Error while generating tokens", error)
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
        (userName.trim() && email.trim()) === ""
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
 
     const options = {
         httpOnly: true,
         secure: true
     }
 
     return res
         .status(200)
         .clearCookie("accessToken", options)
         .clearCookie("refreshToken", options)
         .json(new ApiResponse(200, {}, "User Logged Out"))
   } catch (error) {
        throw new ApiError(501, "Error logging out", error)
   }
})