import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { teaRouter } from './routes/tea'
import { dairyRouter } from './routes/dairy'
import { staffRouter } from './routes/staff'
import { rentalRouter } from './routes/rental'
import { syncRouter } from './routes/sync'
import { smsRouter } from './routes/sms'
import { authRouter } from './routes/auth'
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(helmet())
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-domain.com']  // update before deploy
    : ['http://localhost:5173'],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/api/auth', authRouter)
app.use('/api/tea', teaRouter)
app.use('/api/dairy', dairyRouter)
app.use('/api/staff', staffRouter)
app.use('/api/rental', rentalRouter)
app.use('/api/sync', syncRouter)
app.use('/api/sms', smsRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Kathuniri Farm API running on port ${PORT}`)
})
