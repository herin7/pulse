import mongoose from 'mongoose';

export async function connectMongo() {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pulse';
    try {
        await mongoose.connect(mongoURI);
        console.log('[DB] MongoDB Connected for Auth');
    } catch (err) {
        console.error('[DB] MongoDB connection error:', err);
        process.exit(1);
    }
}
