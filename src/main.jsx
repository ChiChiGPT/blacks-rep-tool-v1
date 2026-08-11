import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const money = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value || 0)
const tierOrder = { hero: 0, core: 1, attach: 2, coverage: 3 }
const availabilityLabel = { in_stock: 'In Stock', pre_order: 'Pre-Order', out_of_stock: 'Out of Stock' }
const PRICE_CAPTURE_DATE = '29 July 2026'
const QUOTE_STORAGE_KEY = 'blacks-rep-quote-v1'

function ProductImage({ product }) { return product.local_image_path ? <img className="product-image" src={product.local_image_path} alt={product.product_name} /> : <div className="image-empty">Image unavailable</div> }
function Status({ availability }) { return availability ? <span className={`status ${availability}`}>{availabilityLabel[availability] || availability}</span> : <span className="status unknown">Availability unconfirmed</span> }
function ContentPending() { return <span className="pending">Content pending</span> }

function App() {
 const [catalogue, setCatalogue] = useState([]), [coreCatalogue, setCoreCatalogue] = useState([]), [learnCatalogue, setLearnCatalogue] = useState([]), [mode, setMode] = useState('home'), [query, setQuery] = useState(''), [selectedSku, setSelectedSku] = useState(null), [quote, setQuote] = useState(() => {
  try { const saved = JSON.parse(localStorage.getItem(QUOTE_STORAGE_KEY) || '{}'); return Object.fromEntries(Object.entries(saved).filter(([sku, qty]) => typeof sku === 'string' && Number.isInteger(qty) && qty > 0)) } catch { return {} }
 }), [copied, setCopied] = useState(false), [removedSkus, setRemovedSkus] = useState([]), [updateReady, setUpdateReady] = useState(false)
 const registrationRef = useRef(null), quoteRef = useRef(quote)
 const catalogueBySku = useMemo(() => new Map(catalogue.map(product => [product.sku, product])), [catalogue])
 const selected = selectedSku ? catalogueBySku.get(selectedSku) || null : null
 const coreProducts = useMemo(() => coreCatalogue.map(({ sku }) => catalogueBySku.get(sku)).filter(Boolean), [catalogueBySku, coreCatalogue])
 const entries = useMemo(() => Object.entries(quote).flatMap(([sku, qty]) => { const product = catalogueBySku.get(sku); return product ? [{ product, qty }] : [] }), [catalogueBySku, quote])
 const count = entries.reduce((n,x)=>n+x.qty,0), subtotal = entries.reduce((n,x)=>n+x.qty*x.product.price_ex_vat,0), vat = subtotal*.2
 const applyUpdate = () => { const waiting = registrationRef.current?.waiting; if (waiting) { setUpdateReady(false); waiting.postMessage({ type: 'SKIP_WAITING' }) } }
 const noteUpdate = registration => { if (Object.values(quoteRef.current).some(qty => qty > 0)) setUpdateReady(true); else registration.waiting?.postMessage({ type: 'SKIP_WAITING' }) }

 useEffect(() => { fetch('/practitioner-catalogue.json').then(r => r.json()).then(setCatalogue) }, [])
 useEffect(() => { quoteRef.current = quote; try { localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(quote)) } catch {} }, [quote])
 useEffect(() => {
  if (!catalogue.length) return
  const missing = Object.keys(quote).filter(sku => !catalogueBySku.has(sku))
  if (missing.length) { setQuote(current => Object.fromEntries(Object.entries(current).filter(([sku]) => catalogueBySku.has(sku)))); setRemovedSkus(missing) }
 }, [catalogue, catalogueBySku])
 useEffect(() => { if (!Object.keys(quote).length && registrationRef.current?.waiting) applyUpdate() }, [quote])
 useEffect(() => {
  if (!('serviceWorker' in navigator)) return
  let refreshing = false
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
   registrationRef.current = registration
   if (registration.waiting) noteUpdate(registration)
   registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    worker?.addEventListener('statechange', () => { if (worker.state === 'installed') window.setTimeout(() => noteUpdate(registration), 0) })
   })
   navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) { refreshing = true; window.location.reload() }
   })
   window.setInterval(() => registration.update(), 60_000)
  })
 }, [])

 const openCore = async () => { if (!coreCatalogue.length) setCoreCatalogue(await fetch('/core-catalogue.json').then(r => r.json())); setMode('core'); setQuery('') }
 const openLearn = async () => { if (!learnCatalogue.length) setLearnCatalogue(await fetch('/catalogue.json').then(r => r.json())); setMode('learn') }
 const openProduct = sku => { setSelectedSku(sku); setMode('product') }
 const trained = useMemo(() => learnCatalogue.filter(x => x.in_trained_set).sort((a,b) => (tierOrder[a.core_tier] - tierOrder[b.core_tier]) || (a.revenue_rank||9999)-(b.revenue_rank||9999)), [learnCatalogue])
 const filtered = useMemo(() => (mode === 'core' ? coreProducts : catalogue).filter(p => `${p.product_name} ${p.brand || ''}`.toLowerCase().includes(query.toLowerCase())), [catalogue, coreProducts, query, mode])
 const add = product => setQuote(q => ({...q,[product.sku]: (q[product.sku]||0)+1}))
 const change = (sku, delta) => setQuote(q => { const qty=(q[sku]||0)+delta; if(qty<1) {const {[sku]:_,...rest}=q;return rest}; return {...q,[sku]:qty} })
 const clear = () => setQuote({})
 const copy = async () => { const text = ['BLACKS AESTHETICS QUOTE','',...entries.map(x=>`${x.qty} × ${x.product.product_name} — ${money(x.product.price_ex_vat)} each — ${money(x.qty*x.product.price_ex_vat)}`),'',`Subtotal ex-VAT: ${money(subtotal)}`,`VAT (20%): ${money(vat)}`,`Total inc-VAT: ${money(subtotal+vat)}`,'',`Prices ex-VAT, correct as at ${PRICE_CAPTURE_DATE}. Subject to confirmation.`].join('\n'); try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),1800); applyUpdate() } catch { setCopied(false) } }

 if (!catalogue.length) return <main className="loading">Loading catalogue…</main>
 if (mode === 'product' && selected) return <main className="product-view"><TopBar onHome={()=>setMode('home')} count={count} onQuote={()=>setMode('quote')} updateReady={updateReady} onApplyUpdate={applyUpdate} /><button className="back" onClick={()=>setMode('home')}>← Back to catalogue</button><section className="product-detail"><ProductImage product={selected}/><div className="detail-copy"><p className="eyebrow">{selected.brand || 'Brand pending'} · {selected.category}</p><h1>{selected.product_name}</h1><div className="price">{money(selected.price_ex_vat)} <small>ex-VAT</small></div><Status availability={selected.availability}/><div className="description">{selected.full_description || 'Description unavailable.'}</div><button className="primary" onClick={()=>add(selected)}>Add to Quote</button></div></section></main>
 if (mode === 'quote') return <main><TopBar onHome={()=>setMode('home')} count={count} onQuote={()=>setMode('quote')} updateReady={updateReady} onApplyUpdate={applyUpdate} /><section className="quote"><h1>Your quote</h1>{removedSkus.length ? <p className="quote-notice">Removed unavailable product{removedSkus.length > 1 ? 's' : ''}: {removedSkus.join(', ')}.</p> : null}{!entries.length ? <div className="empty">No products added yet.</div> : <><div className="lines">{entries.map(({product,qty})=><div className="line" key={product.sku}><div><strong>{product.product_name}</strong><span>{money(product.price_ex_vat)} ex-VAT</span></div><div className="stepper"><button onClick={()=>change(product.sku,-1)} aria-label="Reduce quantity">−</button><b>{qty}</b><button onClick={()=>change(product.sku,1)} aria-label="Increase quantity">+</button></div><strong>{money(product.price_ex_vat*qty)}</strong><button className="remove" onClick={()=>change(product.sku,-qty)}>Remove</button></div>)}</div><div className="totals"><div><span>Subtotal ex-VAT</span><b>{money(subtotal)}</b></div><div><span>VAT at 20%</span><b>{money(vat)}</b></div><div className="grand"><span>Total inc-VAT</span><b>{money(subtotal+vat)}</b></div></div><div className="quote-actions"><button className="primary" onClick={copy}>{copied ? 'Copied' : 'Copy Quote'}</button><button className="secondary" onClick={clear}>Clear quote</button></div></>}<QuoteFooter/></section></main>
 if (mode === 'learn') return <main><TopBar onHome={()=>setMode('home')} count={count} onQuote={()=>setMode('quote')} updateReady={updateReady} onApplyUpdate={applyUpdate} /><section className="learn"><h1>Learn</h1><p className="muted">Sales signals are for rep use only.</p><div className="learn-grid">{trained.map(p=><article key={p.sku}><span className={`tier ${p.core_tier}`}>{p.core_tier}</span><h2>{p.product_name}</h2><p>{p.brand || 'Brand pending'}</p><dl><div><dt>Revenue</dt><dd>{money(p.revenue_gbp)}</dd></div><div><dt>Units</dt><dd>{p.units_sold ?? '—'}</dd></div><div><dt>Orders</dt><dd>{p.order_count ?? '—'}</dd></div></dl><div className="pending-grid"><ContentPending/><ContentPending/><ContentPending/></div></article>)}</div></section></main>
 return <main><TopBar onHome={()=>setMode('home')} count={count} onQuote={()=>setMode('quote')} updateReady={updateReady} onApplyUpdate={applyUpdate} /><section className="home"><div className="home-head"><div><p className="eyebrow">Blacks Aesthetics</p><h1>Product tool</h1></div><button className="learn-link" onClick={openLearn}>Learn</button></div><input autoFocus className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search product or brand" aria-label="Search product or brand"/><div className="entry-tabs"><button className={mode==='home'?'active':''} onClick={()=>{setMode('home');setQuery('')}}>Full Catalogue <span>{catalogue.length}</span></button><button className={mode==='core'?'active':''} onClick={openCore}>Core Products <span>{coreProducts.length || '…'}</span></button></div><div className="grid">{filtered.map(product=><button className="card" key={product.sku} onClick={()=>openProduct(product.sku)}><ProductImage product={product}/><span className="card-category">{product.category}</span><strong>{product.product_name}</strong><span>{product.brand || 'Brand pending'}</span><b>{money(product.price_ex_vat)} <small>ex-VAT</small></b></button>)}</div></section></main>
}
function TopBar({onHome,count,onQuote,updateReady,onApplyUpdate}) { return <header><button className="wordmark" onClick={onHome}>BLACKS <span>REP TOOL</span></button><div className="header-actions">{updateReady ? <button className="update-ready" onClick={onApplyUpdate}>Update ready</button> : null}<button className="quote-button" onClick={onQuote}>Quote <b>{count}</b></button></div></header> }
function QuoteFooter() { return <footer>Prices ex-VAT, correct as at {PRICE_CAPTURE_DATE}.<br/>Subject to confirmation.</footer> }
createRoot(document.getElementById('root')).render(<App />)
