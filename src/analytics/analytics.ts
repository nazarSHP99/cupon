import { DEMO_COUPONS, type Coupon } from '../coupons/coupon'
import { ANALYTICS_HOSTNAME, GA_MEASUREMENT_ID } from './settings'

type CouponEvent = 'coupon_select' | 'coupon_download' | 'coupon_activate' | 'receipt_download'
type AnalyticsEvent = CouponEvent | 'coupon_library_open'
type EventData = { coupon_kind?: 'catalog' | 'custom'; coupon_id?: string }

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let initialized = false

function enabled() {
  return /^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID) && window.location.hostname === ANALYTICS_HOSTNAME
}

function referrerOrigin() {
  try { return document.referrer ? new URL(document.referrer).origin : '' }
  catch { return '' }
}

export function initializeAnalytics() {
  if (initialized || !enabled()) return
  try {
    window.dataLayer ??= []
    window.gtag ??= function () { window.dataLayer!.push(arguments) }
    const settings = {
      send_page_view: false,
      page_location: window.location.origin + window.location.pathname,
      page_referrer: referrerOrigin(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    }
    // Apply defaults before bootstrap; the initial page view must use the cleaned URL too.
    window.gtag('set', settings)
    window.gtag('js', new Date())
    window.gtag('config', GA_MEASUREMENT_ID, settings)
    window.gtag('event', 'page_view', {
      send_to: GA_MEASUREMENT_ID,
      page_location: settings.page_location,
      page_referrer: settings.page_referrer,
    })
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
    document.head.append(script)
    initialized = true
  } catch { /* Optional analytics must not interrupt the coupon flow. */ }
}

export function trackEvent(event: AnalyticsEvent, data: EventData = {}) {
  if (!enabled()) return
  try {
    initializeAnalytics()
    if (initialized) window.gtag?.('event', event, { send_to: GA_MEASUREMENT_ID, ...data })
  } catch { /* Blocked analytics must not affect interactions. */ }
}

export function trackCouponEvent(event: CouponEvent, coupon: Coupon) {
  // Only public catalog IDs are allowed. User filenames, artwork and text stay local.
  const preset = coupon.demo ? DEMO_COUPONS.find(item => item.src === coupon.src) : undefined
  trackEvent(event, preset?.id
    ? { coupon_kind: 'catalog', coupon_id: preset.id }
    : { coupon_kind: 'custom' })
}
