import React from 'react'
import { createRoot } from 'react-dom/client'
import { WidgetPreview } from './WidgetPreview'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WidgetPreview />
  </React.StrictMode>
)
