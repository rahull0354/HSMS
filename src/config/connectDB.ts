import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const conn = process.env.MONGO_URI || ""
        await mongoose.connect(conn)
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error(error);
    }
}

export default connectDB