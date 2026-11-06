import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { DEMO_COUPONS, readCoupon, type Coupon } from './coupon'
import { Icon } from './Icons'
import { useReducedMotion, useSound } from './hooks'
import { createReceipt, downloadReceipt, FEED_DURATION, PRINT_DURATION, type Receipt } from './receipt'
import type { DragHint, Phase } from './MachineScene'

const MachineScene = lazy(() => import('./MachineScene'))

export default function App() {
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [phase, setPhase] = useState<Phase>('empty')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [uploadHover, setUploadHover] = useState(false)
  const [dragHint, setDragHint] = useState<DragHint>('idle')
  const [sound, setSound] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadButton = useRef<HTMLButtonElement>(null)
  const request = useRef(0)
  const phaseRef = useRef<Phase>('empty')
  const reducedMotion = useReducedMotion()
  const play = useSound(sound)
  const playRef = useRef(play)
  const busy = phase === 'inserting' || phase === 'printing'

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { playRef.current = play }, [play])
  useEffect(() => () => { request.current++ }, [])

  useEffect(() => {
    if (phase !== 'inserting' || !coupon) return
    let cancelled = false
    let timer = 0
    const feeding = new Promise<void>(resolve => { timer = window.setTimeout(resolve, reducedMotion ? 500 : FEED_DURATION) })
    void Promise.all([createReceipt(coupon), feeding]).then(([printed]) => {
      if (cancelled) return
      setReceipt(printed)
      phaseRef.current = 'printing'
      setPhase('printing')
      playRef.current('print')
    }).catch(cause => {
      if (cancelled) return
      phaseRef.current = 'ready'
      setPhase('ready')
      setError(cause instanceof Error ? cause.message : 'Не вдалося підготувати чек. Спробуй ще раз.')
    })
    return () => { cancelled = true; clearTimeout(timer) }
  }, [phase, coupon, reducedMotion])

  useEffect(() => {
    if (phase !== 'printing') return
    const timer = window.setTimeout(() => {
      phaseRef.current = 'success'
      setPhase('success')
      playRef.current('success')
    }, reducedMotion ? 450 : PRINT_DURATION)
    return () => clearTimeout(timer)
  }, [phase, reducedMotion])

  const insert = useCallback(() => {
    if (phaseRef.current !== 'ready' || loading) return
    phaseRef.current = 'inserting'
    setDragHint('idle')
    setReceipt(null)
    setError('')
    setSaveError('')
    setPhase('inserting')
    play('insert')
  }, [loading, play])

  async function selectFile(file?: File) {
    if (!file || busy || saving) return
    const id = ++request.current
    setLoading(true)
    setError('')
    try {
      const selected = await readCoupon(file)
      if (id !== request.current) return
      setCoupon(selected)
      setReceipt(null)
      setSaveError('')
      phaseRef.current = 'ready'
      setPhase('ready')
    } catch (cause) {
      if (id === request.current) setError(cause instanceof Error ? cause.message : 'Не вдалося відкрити купон. Спробуй ще раз.')
    } finally {
      if (id === request.current) setLoading(false)
    }
  }

  function demo(index = 0) {
    if (busy || loading || saving) return
    request.current++
    setCoupon(DEMO_COUPONS[index] ?? DEMO_COUPONS[0])
    setReceipt(null)
    setSaveError('')
    phaseRef.current = 'ready'
    setPhase('ready')
    setError('')
  }

  function reset() {
    if (saving) return
    request.current++
    setCoupon(null)
    setReceipt(null)
    phaseRef.current = 'empty'
    setPhase('empty')
    setDragHint('idle')
    setError('')
    setSaveError('')
    setLoading(false)
    window.setTimeout(() => uploadButton.current?.focus(), 0)
  }

  async function saveReceipt() {
    if (!receipt || saving) return
    setSaving(true)
    setSaveError('')
    try { await downloadReceipt(receipt) }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Не вдалося зберегти чек. Спробуй ще раз.') }
    finally { setSaving(false) }
  }

  function fileChange(event: ChangeEvent<HTMLInputElement>) {
    void selectFile(event.target.files?.[0])
    event.target.value = ''
  }

  function fileDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    setUploadHover(false)
    if (busy || saving) return
    if (event.dataTransfer.files.length > 1) { setError('Обери один купон за раз.'); return }
    void selectFile(event.dataTransfer.files[0])
  }

  const statusText = loading ? 'Готую твій купон…'
    : phase === 'inserting' ? 'Зчитую купон. Ще мить…'
    : phase === 'printing' ? 'Купон активовано. Принтер друкує твій чек.'
    : phase === 'success' ? `Купон «${receipt?.title ?? ''}» активовано. Чек готовий: його можна зберегти як зображення.`
    : dragHint === 'over' ? 'Відпусти — я підхоплю!'
    : dragHint === 'dragging' ? 'Піднеси купон до помаранчевої щілини'
    : coupon ? 'Усе готово. Можна вставляти.' : 'Автомат готовий до приємного'

  return <div className={`app-shell phase-${phase}`} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }} onDrop={fileDrop}>
    <button className="icon-button sound-button" onClick={() => setSound(!sound)} aria-label={sound ? 'Вимкнути звук' : 'Увімкнути звук'} aria-pressed={sound} title={sound ? 'Звук увімкнено' : 'Звук вимкнено'}><Icon name={sound ? 'sound' : 'muted'} size={21} /></button>

    <main className="tabletop" aria-label="Купоноприймач і принтер чеків на столі">
      <div className={`scene ${coupon && phase === 'ready' ? 'scene--ready' : ''} ${dragHint !== 'idle' ? 'scene--dragging' : ''}`} data-testid="machine-scene">
        <Suspense fallback={<div className="scene-loading"><span className="button-spinner" /><span className="sr-only">Завантаження автомата</span></div>}>
          <MachineScene coupon={coupon} receipt={receipt} phase={phase} reducedMotion={reducedMotion} onInsert={insert} onDragHint={setDragHint} dragHint={dragHint} onChooseDemo={demo} disabled={busy || loading || saving} />
        </Suspense>
      </div>

      <section aria-label="Вибір купона" className="controls">
        <input ref={fileInput} className="file-input" id="coupon-file" type="file" accept=".png,.svg,image/png,image/svg+xml" onChange={fileChange} disabled={busy || loading || saving} tabIndex={-1} aria-label="Обрати файл купона" />
        <div className={`upload-area ${uploadHover ? 'upload-area--hover' : ''} ${coupon ? 'upload-area--selected' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy && event.dataTransfer.types.includes('Files')) setUploadHover(true) }} onDragLeave={() => setUploadHover(false)} onDrop={fileDrop}>
          <button ref={uploadButton} className="upload-button" onClick={() => fileInput.current?.click()} disabled={busy || loading || saving} aria-describedby={error ? 'upload-error' : 'upload-formats'}>
            <span className="upload-icon">{coupon ? <img src={coupon.src} alt="" /> : <Icon name="ticket" size={28} />}</span>
            <span className="upload-text"><strong title={coupon?.name}>{loading ? 'Готую купон…' : coupon ? coupon.name : 'Обери свій купон'}</strong><span id="upload-formats">{coupon ? 'Змінити купон' : 'PNG / SVG'}</span></span>
            <span className="upload-stub"><Icon name={coupon ? 'check' : 'upload'} size={21} /></span>
          </button>
        </div>
        {error && <p className="error" id="upload-error" role="alert">{error}</p>}
        {!coupon && <button className="demo-button" onClick={() => demo()} disabled={loading}>Спробуй демокупон <Icon name="arrow" size={18} /></button>}
      </section>
      <p className="sr-only" role="status" aria-live="polite">{statusText}</p>
    </main>

    <nav className="steps-bar" aria-label="Етапи активації">
      <div className={`action-dock ${phase !== 'empty' ? 'action-dock--visible' : ''}`}>
        {(phase === 'ready' || busy) && <button className="insert-button" disabled={busy || loading} onClick={insert}><span>{phase === 'printing' ? 'Друкую чек…' : phase === 'inserting' ? 'Зчитую купон…' : 'Вставити купон'}</span>{busy ? <span className="button-spinner" /> : <Icon name="arrow" size={22} />}</button>}
        {phase === 'success' && receipt && <div className="receipt-actions" aria-label="Готовий чек">
          <button className="save-button" onClick={() => void saveReceipt()} disabled={saving}><Icon name="download" size={21} /><span>{saving ? 'Зберігаю…' : 'Зберегти чек'}</span><span className="file-format">PNG</span></button>
          <button className="icon-button again-button" onClick={reset} disabled={saving} aria-label="Спробувати ще один купон" title="Ще один купон"><Icon name="again" size={22} /></button>
        </div>}
        {saveError && <p className="save-error" role="alert">{saveError}</p>}
      </div>
      <ol className="steps">
        <li className={phase === 'empty' ? 'step-active' : 'step-complete'}><span>01</span> Обери</li>
        <li className={phase === 'ready' || phase === 'inserting' ? 'step-active' : phase === 'printing' || phase === 'success' ? 'step-complete' : ''}><span>02</span> Встав</li>
        <li className={phase === 'printing' || phase === 'success' ? 'step-active' : ''}><span>03</span> Усміхнись</li>
      </ol>
    </nav>
  </div>
}
