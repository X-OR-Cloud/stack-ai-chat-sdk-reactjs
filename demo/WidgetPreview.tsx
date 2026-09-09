import { useEffect, useState } from 'react'
import { StackAIChat } from '../src/index'
import type { SDKConfig } from '../src/types'
import { decodeConfigFromQuery, KNOWLEDGE_SEARCH_HIDDEN_PATTERNS, type ShareableConfig } from './shareConfig'

type Status = 'invalid' | 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Trang preview tối giản: đọc config từ query string (?c=<base64 JSON>),
 * khởi tạo widget ngay khi mount, sẵn sàng để chat.
 *
 * Không có log panel / form chỉnh sửa — chỉ có widget nổi + 1 dòng trạng thái
 * nhỏ để không "hỏng im lặng" khi thiếu config hoặc lỗi kết nối.
 */
export function WidgetPreview() {
  const [status, setStatus] = useState<Status>('connecting')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [pageTitle, setPageTitle] = useState<string>('SDK Widget Preview')

  useEffect(() => {
    const shareable = decodeConfigFromQuery(window.location.search)

    if (!shareable) {
      setStatus('invalid')
      setErrorMsg('Không đọc được config từ URL (thiếu param "c" hoặc dữ liệu bị hỏng).')
      return
    }
    if (!shareable.wsUrl || !shareable.token) {
      setStatus('invalid')
      setErrorMsg('Config thiếu wsUrl hoặc token — không thể khởi tạo widget.')
      return
    }

    setPageTitle(shareable.title || 'SDK Widget Preview')

    const { hideKnowledgeSearch, ...rest } = shareable as ShareableConfig & { hideKnowledgeSearch?: boolean }
    const config: SDKConfig = {
      ...(rest as SDKConfig),
      ...(hideKnowledgeSearch ? { hiddenPatterns: KNOWLEDGE_SEARCH_HIDDEN_PATTERNS } : {}),
      onConnected: () => setStatus('connected'),
      onDisconnected: () => setStatus('disconnected'),
      onError: (msg) => {
        setStatus('error')
        setErrorMsg(msg)
      },
    }

    StackAIChat.init(config)

    return () => {
      StackAIChat.destroy()
    }
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#f5f6f8' }}>
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
          padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
          background: status === 'error' || status === 'invalid' ? '#fde2e1' : '#eef2ff',
          color: status === 'error' || status === 'invalid' ? '#b3261e' : '#1f2937',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <strong>{pageTitle}</strong>
        <span>·</span>
        <span>
          {status === 'connecting' && '⏳ Đang kết nối...'}
          {status === 'connected' && '✅ Đã kết nối, sẵn sàng chat'}
          {status === 'disconnected' && '🔌 Mất kết nối, đang thử lại...'}
          {status === 'error' && `❌ Lỗi: ${errorMsg}`}
          {status === 'invalid' && `⚠️ Config không hợp lệ: ${errorMsg}`}
        </span>
      </div>
      {status === 'invalid' && (
        <div style={{ paddingTop: '64px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
          Link này thiếu hoặc sai config. Quay lại SDK Playground, cấu hình lại rồi bấm "🔗 Mở ở cửa sổ mới".
        </div>
      )}
    </div>
  )
}
