import { useEffect, useRef } from 'react'
import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'
import api from '@/lib/api'
import { TOUR_KEYS as KEYS } from '@/config/tours'

export function useTour(role, steps, ready = true) {
  const tourRef  = useRef(null)
  const stepsRef = useRef(steps)
  stepsRef.current = steps

  function buildTour() {
    const key  = KEYS[role]
    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        scrollTo: { behavior: 'smooth', block: 'center' },
        classes: 'dauth-shepherd',
      },
    })
    stepsRef.current.forEach(step => tour.addStep({
      ...step,
      buttons: step.buttons ?? [
        { text: 'Pular', action: () => tour.cancel(), classes: 'shepherd-btn-skip' },
        { text: 'Próximo →', action: () => tour.next(), classes: 'shepherd-btn-primary' },
      ],
    }))
    function markDone() {
      localStorage.setItem(key, 'done')
      api.patch('/users/perfil/me', { Tours_completed: { [role]: true } }).catch(() => {})
    }
    tour.on('complete', markDone)
    tour.on('cancel',   markDone)
    return tour
  }

  useEffect(() => {
    if (!ready) return
    const key = KEYS[role]
    if (!key || localStorage.getItem(key) === 'done') return
    const tour = buildTour()
    tourRef.current = tour
    tour.start()
    return () => { tourRef.current?.cancel() }
  }, [role, ready])

  function restartTour() {
    const key = KEYS[role]
    if (!key) return
    localStorage.removeItem(key)
    api.patch('/users/perfil/me', { Tours_completed: { [role]: false } }).catch(() => {})
    tourRef.current?.cancel()
    const tour = buildTour()
    tourRef.current = tour
    tour.start()
  }

  return { restartTour }
}
