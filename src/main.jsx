import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const money = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value || 0)
const tierOrder = { hero: 0, core: 1, attach: 2, coverage: 3 }
const availabilityLabel = { in_stock: 'In Stock', pre_order: 'Pre-Order', out_of_stock: 'Out of Stock' }
const PRICE_CAPTURE_DATE = '29 July 2026'

function ProductImage({ product }) { return product.local_image_path ? <img className="product-image" src={product.local_image_path} alt={product.product_name} /> : <div className="image-empty">Image unavailable</div> }
function Status({ availability }) { return availability ? <span className={`status ${availability}`}>{availabilityLabel[availability] || availability}</span> : <span className="status unknown">Availability unconfirmed</span> }
function ContentPending() { return <span className="pending">Content pending</span> }

function App() {
 const [catalogue, setCatalogue] = useState([]), [coreCatalogue, setCoreCatalogue] = useState([]), [learnCatalogue, setLearnCatalogue] = useState([]), [mode, setMode] = useState('home'), [query, setQuery] = useState(''), [selectedSku, setSelectedSku] = useState(null), [quote, setQuote] = useState({}), [copied, setCopied] = useState(false)
 const catalogueBySku = useMemo(() => new Map(catalogue.map(product => [product.sku, product])), [catalogue])
 const selected = selectedSku ? catalogueBySku.get(selectedSku) || null : null
 const coreProducts = useMemo(() => coreCatalogue.map(({ sku }) => catalogueBySku.get(sku)).filter(Boolean), [catalogueBySku, coreCatalogue])

 useEffect(() => { fetch('/practitioner-catalogue.json').then(r => r.json()).then(setCatalogue) }, [])
 useEffect(() => {
  if (!('serviceWorker' in navigator)) return
  let refreshing = false
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
   const activateWaitingWorker = () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
   activateWaitingWorker()
   registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    worker?.addEventListener('statechange', () => { if (worker.state === 'installed') activateWaitingWorker() })
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
 const entries = Object.values(quote), count = entries.reduce((n,x)=>n+x.qty,0), subtotal = entries.reduce((n,x)=>n+x.qty*x.product.price_ex_vat,0), vat = subtotal*.2
 const add = product => setQuote(q => ({...q,[product.sku]: { product, qty:(q[product.sku]?.qty||0)+1 }}))
 const change = (sku, delta) => setQuote(q => { const current=q[sku]; const qty=current.qty+delta; if(qty<1) {const {[sku]:_,...rest}=q;return rest}; return {...q,[sku]:{...current,qty}} })
 const clear = () => setQuote({})
 const copy = async () => { const text = ['BLACKS AESTHETICS QUOTE','',...entries.map(x=>`${x.qty} × ${x.product.product_name} — ${money(x.product.price_ex_vat)} each — ${money(x.qty*x.product.price_ex_vat)}`),'',`Subtotal ex-VAT: ${money(subtotal)}`,`VAT (20%): ${money(vat)}`,`Total inc-VAT: ${money(subtotal+vat)}`,'',`Prices ex-VAT, correct as at ${PRICE_CAPTURE_DATE}. Subject to confirmation.`].join('\n'); await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),1800) }
 if (!catalogue.length) return <main className="loading">Loading catalogue…</main>
 if (mode === 'product' && selected) return <main className="product-view"><TopBar onHome={()=>setMode('home')} count={count} onQuote={()=>setMode('quote')} /><button className="back" onClick={()=>setMode('home')}>← Back to catalogue</button><section className="product-detail"><ProductImage product={selected}/><div className="detail-copy"><p className="eyebrow">{selected.brand || 'Brand pending'} · {selected.category}</p><h1>{selected.product_name}</h1><div className="price">{money(selected.price_ex_vat)} <small>ex-VAT</small></div><Status availability={selected.availability}/><div className="description">{selected.full_description || 'Description unavailable.'}</div><button className="primary" onClick={()=>add(selected)}>Add to Quote</button></div></section></main>
 if (mode === 'quote') return <main><TopBar onHome={()=>setMode('home')} count={count} onQuote={()=>setMode('quote')} /><section className="quote"><h1>Your quote</h1>{!entries.length ? <div className="empty">No products added yet.</div> : <><div className="lines">{entries.map(({product,qty})=><div className="line" key={product.sku}><div><strong>{product.product_name}</strong><span>{money(product.price_ex_vat)} ex-VAT</span></div><div className="stepper"><button onClick={()=>change(product.sku,-1)} aria-label="Reduce quantity">−</button><b>{qty}</b><button onClick={()=>change(product.sku,1)} aria-label="Increase quantity">+</button></div><strong>{money(product.price_ex_vat*qty)}</strong><button className="remove" onClick={()=>change(product.sku,-qty)}>Remove</button></div>)}</div><div className="totals"><div><span>Subtotal ex-VAT</span><b>{money(subtotal)}</b></div><div><span>VAT at 20%</span><b>{money(vat)}</b></div><div className="grand"><span>Total inc-VAT</span><b>{money(subtotal+vat)}</b></div></div><div className="quote-actions"><button className="primary" onClick={copy}>{copied ? 'Copied' : 'Copy Quote'}</button><button className="secondary" onClick={clear}>Clear quote</button></div></>}<QuoteFooter/></section></main>
 if (mode === 'learn') return <main><TopBar onHome={()=>setMode('home')} count={count} onQuote={()=>setMode('quote')} /><section className="learn"><h1>Learn</h1><p className="muted">Sales signals are for rep use only.</p><div className="learn-grid">{trained.map(p=><article key={p.sku}><span className={`tier ${p.core_tier}`}>{p.core_tier}</span><h2>{p.product_name}</h2><p>{p.brand || 'Brand pending'}</p><dl><div><dt>Revenue</dt><dd>{money(p.revenue_gbp)}</dd></div><div><dt>Units</dt><dd>{p.units_sold ?? '—'}</dd></div><div><dt>Orders</dt><dd>{p.order_count ?? '—'}</dd></div></dl><div className="pending-grid"><ContentPending/><ContentPending/><ContentPending/></div></article>)}</div></section></main>
 return <main><TopBar onHome={()=>setMode('home')} count={count} onQuote={()=>setMode('quote')} /><section className="home"><div className="home-head"><div><p className="eyebrow">Blacks Aesthetics</p><h1>Product tool</h1></div><button className="learn-link" onClick={openLearn}>Learn</button></div><input autoFocus className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search product or brand" aria-label="Search product or brand"/><div className="entry-tabs"><button className={mode==='home'?'active':''} onClick={()=>{setMode('home');setQuery('')}}>Full Catalogue <span>{catalogue.length}</span></button><button className={mode==='core'?'active':''} onClick={openCore}>Core Products <span>{coreProducts.length || '…'}</span></button></div><div className="grid">{filtered.map(product=><button className="card" key={product.sku} onClick={()=>openProduct(product.sku)}><ProductImage product={product}/><span className="card-category">{product.category}</span><strong>{product.product_name}</strong><span>{product.brand || 'Brand pending'}</span><b>{money(product.price_ex_vat)} <small>ex-VAT</small></b></button>)}</div></section></main>
}
function TopBar({onHome,count,onQuote}) { return <header><button className="wordmark" onClick={onHome}>BLACKS <span>REP TOOL</span></button><button className="quote-button" onClick={onQuote}>Quote <b>{count}</b></button></header> }
function QuoteFooter() { return <footer>Prices ex-VAT, correct as at {PRICE_CAPTURE_DATE}.<br/>Subject to confirmation.</footer> }
createRoot(document.getElementById('root')).render(<App />)
