import React from 'react'
import ReactDOM from 'react-dom/client'
// import '../../../theme.css'; // Import AI Studio theme variables for standalone pages
import '@/index.scss'
import { useI18n } from '@/shared/hooks/useI18n'

const Options = () => {
  const { t } = useI18n();
  
  return (
    <div className="p-8 w-full min-h-screen bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-6">{t('options.title')}</h1>
      <div className="p-4 border rounded-lg bg-card">
        <p>{t('options.settingsPlaceholder')}</p>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
)
