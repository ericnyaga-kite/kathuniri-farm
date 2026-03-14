import cron from 'node-cron'
import { generateDailyInsights } from '../services/aiAssistant'

// Runs daily at 07:00 Nairobi time (UTC+3 = 04:00 UTC)
export function startInsightsJob() {
  cron.schedule('0 4 * * *', async () => {
    console.log('Running daily insights generation...')
    try {
      await generateDailyInsights()
    } catch (err) {
      console.error('Insights job failed:', err)
    }
  }, { timezone: 'Africa/Nairobi' })

  console.log('Daily insights job scheduled (07:00 Nairobi time)')
}
