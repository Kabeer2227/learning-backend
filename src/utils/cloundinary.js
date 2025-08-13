import { v2 as cloudinary } from "cloudinary";
import fs from "fs";


// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


// upload file function

export const uploadFile = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        const response =  cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        })
        fs.unlinkSync(localFilePath) // remove local file path
        console.log("File is uploaded", response.url)
        return response

    } catch (error) {
        console.log("error occured while uploading file - cloudinary", error)
        fs.unlinkSync(localFilePath) // remove local file path
        return null
    }
}
