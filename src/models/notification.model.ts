import mongoose, { Document, Model } from "mongoose";

interface INotification extends Document {
    recipient: mongoose.Schema.Types.ObjectId,
    recipientType: string,
    type: string,
    title: string,
    message: string,
    requestId: mongoose.Schema.Types.ObjectId,
    isRead: boolean,
    readAt: Date
}

const notificationSchema = new mongoose.Schema<INotification>({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'recipientType'
    },
    recipientType: {
        type: String,
        enum: ['customer', 'serviceProvider'],
        required: true
    },
    type: {
        type: String,
        enum: [
            "request_created",
            "request_assigned",
            "request_started",
            "request_completed",
            "request_cancelled",
            "new_review",
            "payment_reminder"
        ],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    requestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceRequests"
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: Date
}, {timestamps: true})

const Notification: Model<INotification> = mongoose.model<INotification>(
    "Notification",
    notificationSchema
)

export default Notification