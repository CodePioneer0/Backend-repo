import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({extended: true, limit: '50mb'}));
app.use(express.static('public'));
app.use(cookieParser());

// Import routes
import userRouter from './routes/user.route.js';


// Use routes
app.use('/api/v1/users', userRouter);


export default app;