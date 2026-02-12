import mongoose, { Document, Model } from "mongoose";

interface IAdmin extends Document {
    name: string,
    email: string,
    password: string,
    lastLogin?: Date,
}

const adminSchema = new mongoose.Schema<IAdmin>({
    name: {
        type: String,
        required: true,
        trim :true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    lastLogin: Date
})

const Admin: Model<IAdmin> = mongoose.model<IAdmin>(
    "Admin",
    adminSchema
)

export default Admin