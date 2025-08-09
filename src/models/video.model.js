import {Schema,model} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema({
    
    videoFile: {
        type: String,
        required: true,

    },
    thumbnail: {
        type: String,
        required: true,
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    title: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    duration: {
        type: Number,
        required: true,   
    },
    views: {
        type: Number,
        default: 0,
        required: true
    },
    isPublished: {
        type: Boolean,
        default: true
    }
},{timestamps:true})

videoSchema.pre(mongooseAggregatePaginate)
export const Video =  model("Video",videoSchema)