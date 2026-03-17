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
import { aiRouter } from './routes/ai'
import { summaryRouter } from './routes/summary'
import { logsRouter } from './routes/logs'
import { machineryRouter } from './routes/machinery'
import { plotsRouter } from './routes/plots'
import { reportsRouter } from './routes/reports'
import { payrollRouter } from './routes/payroll'
import { expensesRouter } from './routes/expenses'
import { errorHandler } from './middleware/errorHandler'
import { startInsightsJob } from './jobs/insightsJob'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(helmet())
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/api/auth', authRouter)
app.use('/api/tea', teaRouter)
app.use('/api/dairy', dairyRouter)
app.use('/api/staff', staffRouter)
app.use('/api/rental', rentalRouter)
app.use('/api/sync', syncRouter)
app.use('/api/sms', smsRouter)
app.use('/api/ai', aiRouter)
app.use('/api/summary', summaryRouter)
app.use('/api/logs', logsRouter)
app.use('/api/machinery', machineryRouter)
app.use('/api/plots', plotsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/payroll', payrollRouter)
app.use('/api/expenses', expensesRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Kathuniri Farm API running on port ${PORT}`)
  startInsightsJob()
})
