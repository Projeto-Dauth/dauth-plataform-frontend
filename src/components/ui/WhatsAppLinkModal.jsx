import { useState, useEffect, useRef, useCallback } from 'react'
import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import api from '@/lib/api'
import useWhatsappStatusStore from '@/store/whatsappStatusStore'

const STATUS_POLL_MS = 4000
const QR_REFRESH_MS = 45000

export default function WhatsAppLinkModal({ onClose }) {
  const { status, setStatus, fetchStatus } = useWhatsappStatusStore()
  const [qrCode, setQrCode] = useState(null)
  const [loadingQr, setLoadingQr] = useState(true)
  const [error, setError] = useState(null)
  const statusIntervalRef = useRef(null)
  const qrIntervalRef = useRef(null)

  const fetchQr = useCallback(async () => {
    setLoadingQr(true)
    try {
      const { data } = await api.get('/whatsapp-link/qr')
      setQrCode(data.qrCode)
      setStatus(data.status)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Não foi possível gerar o QR code.')
    } finally {
      setLoadingQr(false)
    }
  }, [setStatus])

  useEffect(() => {
    fetchQr()
    statusIntervalRef.current = setInterval(fetchStatus, STATUS_POLL_MS)
    qrIntervalRef.current = setInterval(() => {
      if (useWhatsappStatusStore.getState().status !== 'connected') fetchQr()
    }, QR_REFRESH_MS)
    return () => {
      clearInterval(statusIntervalRef.current)
      clearInterval(qrIntervalRef.current)
    }
  }, [fetchQr, fetchStatus])

  useEffect(() => {
    if (status === 'connected') {
      clearInterval(statusIntervalRef.current)
      clearInterval(qrIntervalRef.current)
      setQrCode(null)
    }
  }, [status])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-line shadow-md w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line">
          <h4 className="font-display font-medium text-[15px] text-ink">Linkar com WhatsApp</h4>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-4 hover:text-ink hover:bg-surface-2 cursor-pointer">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="px-5 py-6 flex flex-col items-center gap-4">
          {status === 'connected' ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <Icon name="check" size={32} />
              <p className="text-[14px] font-medium text-ink">WhatsApp conectado</p>
            </div>
          ) : (
            <>
              {loadingQr && !qrCode && <PageSpinner />}
              {qrCode && (
                <img
                  src={qrCode}
                  alt="QR Code do WhatsApp"
                  className="w-72 h-72 rounded-lg border border-line grayscale contrast-125"
                />
              )}
              {error && (
                <p className="text-[12px] text-danger text-center">{error}</p>
              )}
              <p className="text-[12px] text-ink-3 text-center">
                Abra o WhatsApp do salão → Aparelhos conectados → Conectar um aparelho, e escaneie o código acima.
              </p>
              <Button variant="ghost" size="sm" onClick={fetchQr} loading={loadingQr}>
                <Icon name="qr" size={13} />Gerar novo código
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
