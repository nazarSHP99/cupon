import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { DEMO_COUPONS, readCoupon, type Coupon } from '../coupons/coupon'
import { createReceipt, downloadReceipt, FEED_DURATION, PRINT_DURATION, type Receipt } from '../coupons/receipt'
import { Icon } from '../components/Icons'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useSound } from '../hooks/useSound'
import { useCouponHistory } from '../hooks/useCouponHistory'
import { CouponBrowser } from '../components/CouponBrowser'
import { JourneyNav } from '../components/JourneyNav'
import { CustomCursor } from '../components/CustomCursor'
import { InstructionReader } from '../components/InstructionReader'
import '../components/experience.css'
import type { DragHint, Phase } from '../scene/MachineScene'

const MachineScene = lazy(() => import('../scene/MachineScene'))

function BootMachine({ ready }: { ready: boolean }) {
  return <div className={`boot ${ready ? 'boot--done' : ''}`} role="status" aria-hidden={ready}>
    <div className="boot-panel">
      <div className="boot-machine" aria-hidden="true">
        <svg viewBox="0 0 144 176" width="144" height="176">
          <rect x="28" y="12" width="88" height="112" rx="16" fill="#f5f0df" stroke="#333b30" strokeWidth="2" />
          <rect x="39" y="26" width="66" height="30" rx="6" fill="#e6edce" stroke="#333b30" strokeWidth="2" />
          <path d="M61 42h2m18 0h2m-16 4q5 6 10 0" fill="none" stroke="#333b30" strokeWidth="2.25" strokeLinecap="round" />
          <path d="M45 123v5m54-5v5" stroke="#333b30" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <div className="boot-feed">
          <svg className="boot-coupon" viewBox="0 0 62 42" width="62" height="42">
            <path d="M7 1h48a6 6 0 0 1 6 6v8a6 6 0 0 0 0 12v8a6 6 0 0 1-6 6H7a6 6 0 0 1-6-6v-8a6 6 0 0 0 0-12V7a6 6 0 0 1 6-6Z" fill="#fbb797" stroke="#333b30" strokeWidth="2" />
            <path d="M45 7v28" stroke="#333b30" strokeWidth="1.5" strokeDasharray="2 4" strokeLinecap="round" />
            <path d="M23 10l2.9 7.1L33 20l-7.1 2.9L23 30l-2.9-7.1L13 20l7.1-2.9Z" fill="#333b30" />
          </svg>
        </div>
        <svg className="boot-slot" viewBox="0 0 78 16" width="78" height="16">
          <rect x="1" y="1" width="76" height="14" rx="5" fill="#e87552" stroke="#333b30" strokeWidth="2" />
          <path d="M9 8h60" stroke="#333b30" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      <span className="sr-only">Запускаю автомат</span>
    </div>
  </div>
}

export default function App() {
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [phase, setPhase] = useState<Phase>('empty')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [fileOver, setFileOver] = useState(false)
  const [dragHint, setDragHint] = useState<DragHint>('idle')
  const [sound, setSound] = useState(false)
  const [booted, setBooted] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [near, setNear] = useState(false)
  const [journeyProgress, setJourneyProgress] = useState(0)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [instructionOpen, setInstructionOpen] = useState(false)
  const [activeCoupon, setActiveCoupon] = useState(0)
  const { entries, saveUsage, storageError } = useCouponHistory()
  const scrollRoot = useRef<HTMLDivElement>(null)
  const keypad = useRef<HTMLDivElement>(null)
  const rackControls = useRef<HTMLDivElement>(null)
  const objectHint = useRef<HTMLDivElement>(null)
  const instructionButton = useRef<HTMLButtonElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadButton = useRef<HTMLButtonElement>(null)
  const request = useRef(0)
  const phaseRef = useRef<Phase>('empty')
  const reducedMotion = useReducedMotion()
  const play = useSound(sound)
  const playRef = useRef(play)
  const hoverCoupon = useCallback(() => play('paper'), [play])
  const busy = phase === 'inserting' || phase === 'printing'
  const locked = busy || loading || saving
  const controlsActive = booted && (near || fallback) && !browserOpen && !instructionOpen && journeyProgress < .67

  const sceneReady = useCallback((webglUnavailable = false) => {
    setFallback(webglUnavailable)
    setBooted(true)
  }, [])

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { playRef.current = play }, [play])
  useEffect(() => () => { request.current++ }, [])
  useEffect(() => {
    if (phase === 'success' && coupon && receipt) void saveUsage(coupon, receipt)
  }, [phase, coupon, receipt, saveUsage])

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
    setBrowserOpen(false)
    setActiveCoupon(index)
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
    setFileOver(false)
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

  function navigate(checkpoint: 0 | 1 | 2) {
    if (locked || browserOpen || instructionOpen) return
    const root = scrollRoot.current
    if (fallback) {
      setJourneyProgress(checkpoint / 2)
      return
    }
    root?.scrollTo({ top: (root.scrollHeight - root.clientHeight) * checkpoint / 2, behavior: reducedMotion ? 'instant' : 'smooth' })
  }

  function openLibrary() {
    if (locked || instructionOpen) return
    setActiveCoupon(0)
    setBrowserOpen(true)
  }

  function closeLibrary() {
    setBrowserOpen(false)
  }

  function closeInstructions() {
    setInstructionOpen(false)
    requestAnimationFrame(() => instructionButton.current?.focus({ preventScroll: true }))
  }

  function toggleSound() {
    if (!sound) play('click', true)
    setSound(!sound)
  }

  return <>
    <div ref={scrollRoot} className={`app-shell phase-${phase}`} data-near={near} data-fallback={fallback}
      data-checkpoint={journeyProgress > .78 ? 'drawer' : journeyProgress > .4 ? 'table' : 'overview'}
      style={{ overflowY: browserOpen || instructionOpen || locked ? 'hidden' : 'auto' }}
      onScroll={event => {
        const root = event.currentTarget
        setJourneyProgress(root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight))
      }}
      tabIndex={0} aria-label="Купон на пагорбі" inert={!booted}>
      <main className="tabletop" aria-label="Купоноприймач і принтер чеків на дерев’яному столі"
        onClick={fallback ? browserOpen ? closeLibrary : instructionOpen ? closeInstructions : undefined : undefined}
        onDragOver={event => {
          if (!event.dataTransfer.types.includes('Files')) return
          event.preventDefault()
          if (controlsActive && !locked) setFileOver(true)
        }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFileOver(false) }}
        onDrop={event => {
          if (controlsActive) fileDrop(event)
          else event.preventDefault()
        }}>
        <div className="scene" data-testid="machine-scene">
          <Suspense fallback={null}>
            <MachineScene coupon={coupon} receipt={receipt} phase={phase} reducedMotion={reducedMotion}
              onInsert={insert} onDragHint={setDragHint} dragHint={dragHint} onChooseDemo={demo} onHoverCoupon={hoverCoupon} disabled={locked}
              browserOpen={browserOpen} activeCoupon={activeCoupon} onBrowse={openLibrary} onCloseBrowse={closeLibrary}
              onPreviewCoupon={setActiveCoupon} usedCoupons={entries}
              rackControls={rackControls} objectHint={objectHint} instructionButton={instructionButton} instructionOpen={instructionOpen}
              onCloseInstructions={closeInstructions}
              scrollRoot={scrollRoot} keypad={keypad} onReady={sceneReady} onApproach={setNear} />
          </Suspense>
        </div>

        <input ref={fileInput} className="sr-only" type="file" accept=".png,.svg,image/png,image/svg+xml"
          onChange={fileChange} disabled={locked} tabIndex={-1} aria-label="Обрати файл купона" />
        <div ref={keypad} className="keypad" role="group" aria-label="Клавіатура купоноприймача" inert={!controlsActive}
          onClickCapture={event => {
            const button = (event.target as Element).closest('button')
            if (button && !button.disabled) play('click')
          }}>
          <button ref={uploadButton} className={`key key--file ${fileOver ? 'key--lit' : ''}`}
            onClick={() => fileInput.current?.click()} disabled={locked} aria-label="Обрати свій купон (PNG або SVG)" title="Обери свій PNG або SVG">
            <Icon name="upload" size={35} /><span>{loading ? '…' : 'File'}</span>
          </button>
          <button className="key key--demo" onClick={openLibrary} disabled={locked} aria-label="Обрати готовий купон" title="Колекція готових купонів">
            <Icon name="ticket" size={35} /><span>Demo</span>
          </button>
          <button className={`key key--insert ${phase === 'ready' ? 'key--lit' : ''}`}
            onClick={insert} disabled={phase !== 'ready' || locked} aria-label="Вставити купон" title="Вставити купон">
            <Icon name="insert" size={35} /><span>Insert</span>
          </button>
          <button className={`key ${sound ? 'key--lit' : ''}`} onClick={toggleSound}
            aria-label={sound ? 'Вимкнути звук' : 'Увімкнути звук'} aria-pressed={sound} title={sound ? 'Вимкнути звук' : 'Увімкнути звук'}>
            <Icon name={sound ? 'sound' : 'muted'} size={35} /><span>Sound</span>
          </button>
          <button className={`key key--save ${phase === 'success' ? 'key--lit' : ''}`}
            onClick={() => void saveReceipt()} disabled={phase !== 'success' || saving} aria-label="Зберегти чек" title="Зберегти чек як PNG">
            <Icon name="download" size={35} /><span>{saving ? '…' : 'Save'}</span>
          </button>
          <button className={`key ${phase === 'success' ? 'key--lit' : ''}`}
            onClick={reset} disabled={phase !== 'success' || saving} aria-label="Спробувати з іншим купоном" title="Ще один купон">
            <Icon name="again" size={35} /><span>Again</span>
          </button>
        </div>

        <button ref={instructionButton} className="instruction-hotspot" type="button" hidden={!controlsActive}
          disabled={locked} aria-label="Прочитати інструкцію" onClick={event => {
            event.stopPropagation()
            setInstructionOpen(true)
          }}>{fallback && 'Як це працює'}</button>
        {!fallback && journeyProgress < .43 && <button className="approach-cue" onClick={() => navigate(1)} aria-label="Наблизитися до столу">
          <Icon name="mouse" size={26} /><span>Прокрути, щоб наблизитися</span>
        </button>}
        <div ref={objectHint} className="scene-object-hint" aria-hidden="true" />
        {(error || saveError || storageError) && <p className="scene-error" role="alert">{error || saveError || storageError}</p>}
        <p className="sr-only" role="status" aria-live="polite">{statusText}</p>
      </main>
      {!fallback && <div className="scroll-runway" aria-hidden="true" />}
    </div>
    <JourneyNav progress={journeyProgress} onNavigate={navigate} disabled={locked || browserOpen || instructionOpen || !booted} />
    {browserOpen && <CouponBrowser fallback={fallback} rackControls={rackControls} activeIndex={activeCoupon}
      onActiveIndex={setActiveCoupon} onChoose={demo} onClose={closeLibrary} />}
    {instructionOpen && <InstructionReader fallback={fallback} onClose={closeInstructions} />}
    <CustomCursor />
    <BootMachine ready={booted} />
  </>
}

