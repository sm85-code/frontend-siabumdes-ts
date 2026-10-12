import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import api from '@/api/client'
import RiskaTypedReply from '@/components/RiskaTypedReply'
import { useAuth } from '@/lib/auth'

type Reply = { can_revise?: boolean; message: string; ai_conversation_id?: string; ai?: { model: string; provider: string };  choices?: { label: string; message: string }[]; rows?: Record<string, string | number>[]; money_columns?: string[]; valuation?: string; draft_id?: string; conversation_id?: string; confirmation_level?: 'admin'; refresh_required?: boolean; session_ended?: boolean; auth_refresh_required?: boolean; credentials?: { username: string; temporary_password: string } | null; preview?: { unit: string; operation: string; item: string; tanggal: string; details?: Record<string, string>; rows: Record<string, string | number>[] }; parties?: Record<string, { id: string; name: string }[]> }
type Entry = Reply & { role: 'user' | 'riska' }
type Unit = { id: string; code: string; name: string; business_type?: string }

type Command = {
  id: string; label: string; category: 'read' | 'admin' | 'manage' | 'local'
  message?: string; path?: string; template?: string; unitCodes?: string[]; businessTypes?: string[]
}
const COMMANDS: Command[] = [
  { id: 'profit', label: '📊 Cek Laba Rugi', category: 'read', message: 'cek laba rugi' },
  { id: 'cash', label: '💰 Cek Saldo Kas', category: 'read', message: 'cek saldo kas' },
  { id: 'performance', label: '🏢 Performa Unit Usaha', category: 'read', message: 'performa' },
  { id: 'comparison', label: '🏢 Bandingkan Semua Unit', category: 'admin', message: 'laba rugi semua unit bulan ini' },
  { id: 'close', label: '📕 Tutup Buku', category: 'admin', message: 'tutup buku bulan ini' },
  { id: 'lock', label: '🔒 Kunci Periode', category: 'admin', message: 'kunci periode bulan ini' },
  { id: 'transfer', label: '💸 Transfer Bagi Hasil', category: 'admin', message: 'transfer bagi hasil bulan ini' },
  { id: 'transaction', label: '➕ Input Transaksi', category: 'admin', message: 'tambah transaksi' },
  ...(['transaksi', 'akun', 'pengguna', 'unit', 'produk', 'mitra', 'pembayaran'] as const).flatMap(resource => (['lihat', 'tambah', 'ubah', 'hapus'] as const).map(action => ({ id: `${action}-${resource}`, label: `${action === 'lihat' ? '📋' : action === 'tambah' ? '➕' : action === 'ubah' ? '✏️' : '🗑️'} ${action[0].toUpperCase() + action.slice(1)} ${resource}`, category: 'manage' as const, message: `${action} ${resource}` }))),
  { id: 'journal', label: '📖 Buka Buku Besar', category: 'admin', path: '/ledger' },
  { id: 'permissions', label: '🔐 Penugasan Pengguna', category: 'admin', path: '/riska-permissions' },
  { id: 'yield', label: '🤝 Input Imbal Hasil', category: 'local', unitCodes: ['UU04'], message: 'catat setoran imbal hasil' },
  { id: 'stock-in', label: '📦 Barang Masuk', category: 'local', businessTypes: ['perdagangan', 'manufaktur'], message: 'input barang masuk' },
  { id: 'stock-out', label: '🛒 Barang Keluar', category: 'local', businessTypes: ['perdagangan', 'manufaktur'], message: 'input barang keluar' },
  { id: 'stock-adjust', label: '📝 Opname Barang Rusak', category: 'local', businessTypes: ['perdagangan', 'manufaktur'], message: 'catat barang rusak' },
]

const RISKA_NAME = '👩‍💼 Riska (Asisten Keuangan)'

export default function RiskaChatBox() {
  const { user } = useAuth()
  return user ? <RiskaSessionChat key={`${user.id}:${user.role}:${user.unit_usaha_id || ''}`} /> : null
}

function RiskaSessionChat() {
  const { user, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const messageInput = useRef<HTMLInputElement>(null)
  const activeRequest = useRef<AbortController | null>(null)
  const chatLog = useRef<HTMLDivElement>(null)
  const [completedReplies, setCompletedReplies] = useState(() => new Set<Entry>())
  const followTyping = useCallback(() => {
    const log = chatLog.current
    if (log && log.scrollHeight - log.scrollTop - log.clientHeight < 100) log.scrollTo({ top: log.scrollHeight })
  }, [])
  const isAdmin = user?.role === 'admin'
  const userName = user?.name?.trim() || user?.username?.trim() || 'Pengguna'
  const isRiska = /\briska\b/i.test(userName) || /^riska$/i.test(user?.username?.trim() || '')
  const greetingName = isRiska ? 'Riska' : userName
  const roleLabel = ({ pengelola: 'Pengelola Unit Usaha', bendahara: 'Bendahara', direktur: 'Direktur', pengawas: 'Pengawas', penasihat: 'Penasihat' } as Record<string, string>)[user?.role || ''] || 'pengguna SIABUMDES'
  const welcomeMessage = isAdmin
    ? 'Selamat datang kembali! 👩‍💼 Saya siap membantu Anda memeriksa keuangan atau menyiapkan transaksi. Apa yang ingin kita kerjakan hari ini?'
    : `Halo, Kak ${greetingName}! 👩‍💼 ${isRiska ? 'Nama kita sama, ya! ' : ''}Saya Riska, Asisten Keuangan yang didesain Pa Saepul untuk membantu pekerjaan Kakak sebagai ${roleLabel}, sesuai izin yang diberikan. Mau mulai dari mana?`
  const [welcomeComplete, setWelcomeComplete] = useState(false)
  const assignmentSession = useRef<string | null>(null)
  const [finishPrompt, setFinishPrompt] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [units, setUnits] = useState<Unit[]>([])
  const [unitLoadError, setUnitLoadError] = useState(false)
  const [unitId, setUnitId] = useState(user?.role === 'pengelola' ? user.unit_usaha_id || '' : '')
  const [message, setMessage] = useState('')
  const [aiModels, setAiModels] = useState<Record<string, { available: boolean; model: string }>>({})
  const [aiMode, setAiMode] = useState<'auto' | 'internal' | 'sol' | 'sonnet'>('auto')
  const [showCommands, setShowCommands] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [busy, setBusy] = useState(false)
  const [aiConversationId, setAiConversationId] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [canRevise, setCanRevise] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let loading = false
    let unitsLoadedAt = 0
    let visibilityRequest: AbortController | null = null
    async function load() {
      if (!live || loading || document.visibilityState === 'hidden') return
      loading = true
      const controller = new AbortController()
      visibilityRequest = controller
      try {
        const { data } = await api.get<{ enabled: boolean; session_id: string | null; ai_models?: Record<string, { available: boolean; model: string }> }>('/riska/availability', { signal: controller.signal })
        if (!live) return
        if (!data.enabled) {
          activeRequest.current?.abort(); activeRequest.current = null
          setBusy(false); setOpen(false); setEnabled(false)
          return
        }
        if (assignmentSession.current !== data.session_id) {
          activeRequest.current?.abort(); activeRequest.current = null
          assignmentSession.current = data.session_id
          unitsLoadedAt = 0
          setWelcomeComplete(false); setBusy(false); setEntries([]); setCompletedReplies(new Set()); setPendingDraft(null); setCanRevise(false); setConversationId(null); setAiConversationId(null); setMessage(''); setFinishPrompt(false)
        }
        // Permission decides visibility. Unit metadata is supplementary, not an access gate.
        setAiModels(data.ai_models || {})
        setEnabled(true)
        if (Date.now() - unitsLoadedAt >= 30_000) {
          try {
            const result = await api.get<Unit[]>('/riska/units', { signal: controller.signal })
            if (!live) return
            unitsLoadedAt = Date.now()
            setUnitLoadError(false)
            setUnits(result.data)
            setUnitId(previous => user?.role === 'pengelola' ? user.unit_usaha_id || '' : result.data.some(u => u.id === previous) ? previous : '')
          } catch (error) {
            if (!live || controller.signal.aborted) return
            const status = (error as { response?: { status?: number } }).response?.status
            if (status === 401 || status === 403) { setEnabled(false); setOpen(false) }
            else setUnitLoadError(true)
          }
        }
      } catch { if (live && !controller.signal.aborted) setEnabled(false) }
      finally { loading = false; if (visibilityRequest === controller) visibilityRequest = null }
    }
    function refreshWhenVisible() { if (document.visibilityState === 'visible') void load() }
    void load()
    const timer = window.setInterval(() => void load(), 5_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      live = false; window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      visibilityRequest?.abort(); activeRequest.current?.abort(); activeRequest.current = null
    }
  }, [user?.id, user?.role, user?.unit_usaha_id])
  useEffect(() => {
    if (!open || !enabled || !window.matchMedia('(max-width: 767px)').matches) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open, enabled])
  useEffect(() => {
    chatLog.current?.scrollTo({ top: chatLog.current.scrollHeight })
  }, [entries, busy, open])
  const operationUnit = units.find(unit => unit.id === (user?.role === 'pengelola' ? user.unit_usaha_id : unitId))
  const visibleCommands = COMMANDS.filter(command => isAdmin || command.category === 'read' || (
    command.category === 'local' && ['pengelola', 'direktur', 'bendahara'].includes(user?.role || '') &&
    (command.unitCodes?.includes(operationUnit?.code.toUpperCase() || '') || command.businessTypes?.includes(operationUnit?.business_type || ''))
  ))
  function selectCommand(command: Command) {
    if (busy || pendingDraft || conversationId || !visibleCommands.includes(command)) return
    if (command.message) { void sendMessage(command.id === 'performance' && user?.role !== 'pengelola' ? 'performa semua unit' : command.message); return }
    if (!isAdmin && command.template) {
      setMessage(command.template)
      messageInput.current?.focus()
      return
    }
    if (command.path) { setOpen(false); navigate(command.path) }
  }
  if (!enabled) return null
  async function sendMessage(shortcut?: string) {
    const text = (shortcut ?? message).trim()
    if (!text || busy || (pendingDraft && !canRevise) || activeRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    if (!shortcut) setMessage('')
    setBusy(true)
    setEntries(old => [...old, { role: 'user', message: text }])
    try {
      const { data } = await api.post<Reply>('/riska/chat', { message: text, unit_usaha_id: unitId || null, conversation_id: conversationId, ai_conversation_id: aiConversationId, revision_draft_id: canRevise ? pendingDraft : null, session_id: assignmentSession.current, ai_mode: aiMode }, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (data.session_ended) { setOpen(false); setEnabled(false); return }
      setConversationId(data.conversation_id || null)
      if (data.ai_conversation_id) setAiConversationId(data.ai_conversation_id)
      setCanRevise(!!data.can_revise)
      if (pendingDraft || data.draft_id) setPendingDraft(data.draft_id || null)
      setEntries(old => [...old, { role: 'riska', ...data, rows: data.preview?.rows || data.rows }])
    } catch (error) {
      if (controller.signal.aborted) return
      const status = (error as { response?: { status?: number } }).response?.status
      const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
      if (status === 409) { setConversationId(null); setAiConversationId(null); setPendingDraft(null); setCanRevise(false) }
      if (status === 403 && typeof detail === 'string' && /Penugasan|tidak aktif/.test(detail)) setEnabled(false)
      setEntries(old => [...old, { role: 'riska', message: typeof detail === 'string' ? detail : 'Maaf, saya belum berhasil memproses permintaan ini. Boleh coba lagi? Jika masih terkendala, kita periksa data dan izin aksesnya bersama.' }])
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; setBusy(false) }
    }
  }
  async function confirm(draftId: string, execute: boolean) {
    if (busy || pendingDraft !== draftId || activeRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    setBusy(true)
    try {
      const { data } = execute ? await api.post<Reply>(`/riska/drafts/${draftId}/execute`, undefined, { signal: controller.signal }) : await api.delete<Reply>(`/riska/drafts/${draftId}`, { signal: controller.signal })
      if (execute) {
        void queryClient.invalidateQueries()
      }
      if (controller.signal.aborted) return
      setPendingDraft(null)
      setCanRevise(false)
      setConversationId(null)
      setEntries(old => [...old, { role: 'riska', ...data }])
      if (data.session_ended) { setEnabled(false); setOpen(false) }
      if (data.auth_refresh_required) void refreshUser().catch(() => setEntries(previous => [...previous, { role: 'riska', message: 'Perubahan akun sudah tersimpan. Muat ulang halaman untuk menyegarkan profil dan hak akses tampilan.' }]))
    } catch (error) {
      if (controller.signal.aborted) return
      const response = (error as { response?: { status?: number; data?: { detail?: string } } }).response
      if (response?.status === 403 && /Penugasan|tidak aktif/.test(response.data?.detail || '')) setEnabled(false)
      if (response?.status === 409) setPendingDraft(null)
      setEntries(old => [...old, { role: 'riska', message: response?.data?.detail || 'Eksekusi belum terkonfirmasi. Periksa halaman transaksi sebelum mencoba lagi.' }])
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; setBusy(false) }
    }
  }
  async function finishSession() {
    if (busy || activeRequest.current || !assignmentSession.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    setBusy(true)
    try {
      await api.post('/riska/session/finish', { session_id: assignmentSession.current }, { signal: controller.signal })
      if (controller.signal.aborted) return
      setEnabled(false); setOpen(false); setEntries([]); setPendingDraft(null); setCanRevise(false); setConversationId(null); setAiConversationId(null); setFinishPrompt(false)
    } catch {
      if (!controller.signal.aborted) setEntries(old => [...old, { role: 'riska', message: 'Sesi belum berhasil diakhiri. Silakan coba lagi.' }])
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; setBusy(false) }
    }
  }
  return createPortal(<aside className={open
    ? 'fixed inset-0 z-50 bg-indigo-50 md:inset-auto md:bottom-4 md:right-4 md:w-[min(36rem,calc(100vw-2rem))] md:bg-transparent'
    : 'fixed bottom-20 right-4 z-50 sm:bottom-4'} aria-label={RISKA_NAME}>
    {open && <section className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 flex h-full min-h-0 w-full flex-col rounded-none bg-white p-3 text-slate-900 md:h-[min(40rem,calc(100dvh-2rem))] md:rounded-2xl md:border md:border-indigo-200 md:bg-white md:text-slate-900 md:shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-2 rounded-xl bg-indigo-700 px-3 py-3 text-white">
        <div><h2 className="font-semibold">{RISKA_NAME}</h2><p className="mt-1 text-xs text-indigo-100">Asisten internal · sesuai hak akses</p></div>
        <button type="button" className="min-h-11 rounded-lg border border-white/30 px-3 text-sm font-semibold hover:bg-white/10" onClick={() => setOpen(false)}>Tutup Riska ✕</button>
      </header>
      <div className="flex shrink-0 items-center justify-between gap-2 py-2 text-xs text-slate-500">
        <span className="truncate">{units.find(unit => unit.id === unitId)?.name || (user?.role === 'pengelola' ? 'Unit usaha Anda' : 'BUMDES Pusat')}</span>
        <button type="button" className="min-h-11 shrink-0 rounded-lg border px-3" onClick={() => setShowCommands(value => !value)}>{showCommands ? 'Tutup pintasan' : 'Pintasan'}</button>
      </div>
      <details className="mb-2 max-h-44 shrink-0 overflow-y-auto rounded-lg border px-3 text-xs">
        <summary className="min-h-11 cursor-pointer py-3">Pengaturan & bantuan</summary>
      <div className="flex flex-wrap items-center justify-between gap-2"><label className="text-xs text-slate-500">Bantuan <select aria-label="Mode bantuan Riska" className="ml-2 rounded-lg border bg-white p-2 text-slate-900" value={aiMode} onChange={e => setAiMode(e.target.value as typeof aiMode)} disabled={busy || !!pendingDraft || !!conversationId}><option value="auto">Otomatis · AI</option><option value="internal">Internal · tanpa token AI</option><option value="sol" disabled={!aiModels.sol?.available}>Sol · {aiModels.sol?.model || 'belum tersedia'}</option><option value="sonnet" disabled={!aiModels.sonnet?.available}>Sonnet · {aiModels.sonnet?.model || 'belum tersedia'}</option></select></label><button type="button" className="min-h-11 rounded-lg border px-3 text-xs" onClick={() => setShowCommands(v => !v)}>{showCommands ? 'Tutup menu' : 'Menu bantuan'}</button></div>
      <details className="max-h-28 shrink-0 overflow-y-auto text-xs"><summary>Bantuan: cara bertanya dan mencatat</summary>
        <p>Admin dapat meminta lihat/tambah/ubah/hapus transaksi, akun, pengguna, unit, produk, mitra, atau pembayaran imbal hasil. Contoh: “ubah produk Daster Arab Jumbo”. Riska menanyakan bagian dan nilai baru satu per satu. “Hapus unit” berarti menonaktifkan dengan tetap menjaga riwayat. Stok awal produk baru adalah nol; gunakan barang masuk untuk mencatat stok dan jurnalnya.</p>
        <p>Pilih entitas, lalu tulis seperti berbicara. Riska akan menanyakan data yang belum lengkap, tanpa menebak harga atau tanggal.</p>
        <p>Contoh: Riska, input barang masuk buat SKU-012 sebanyak 5 pcs harga 20 ribu dari pemasok "Toko Makmur" hari ini.</p>
        <p>Nama produk atau mitra boleh dipakai jika sesuai data terdaftar. Jika ada nama sama, Riska meminta ID/SKU yang tepat. Harga barang masuk/keluar berarti harga per barang dan pembayaran tunai.</p>
        <p>Ketik “stok” atau “mitra” untuk melihat daftar. Format lama dengan tanda = tetap bisa dipakai.</p>
        <p>Admin dapat menugaskan “aktifkan dirimu di pengelola 4” atau “nonaktifkan Riska untuk [username]”, kemudian mengonfirmasi. Admin juga dapat bertanya “laba rugi unit UU05 dan unit UU06 September 2026”, atau menjalankan “kunci periode bulan ini”. Periksa entitas, periode, nominal, serta pasangan jurnal sebelum menekan Ya, Eksekusi.</p>
      </details>
      {unitLoadError && <p role="status" className="shrink-0 text-xs text-amber-700">Daftar entitas belum berhasil dimuat. Riska akan mencoba lagi; izin Anda tetap diperiksa oleh sistem.</p>}
      <label className="my-2 shrink-0 text-sm">Entitas
        <select className="ml-2 max-w-full rounded border bg-white p-1" value={unitId}
          onChange={e => { setUnitId(e.target.value); setAiConversationId(null); setEntries([]); setCompletedReplies(new Set()) }} disabled={busy || !!pendingDraft || !!conversationId || user?.role === 'pengelola'}>
          {user?.role !== 'pengelola' && <option value="">BUMDES Pusat</option>}
          {user?.role === 'pengelola' && !units.some(u => u.id === unitId) && <option value={unitId}>Unit usaha Anda</option>}
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>
      </details>
      <div className="min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto overscroll-contain break-words" ref={chatLog} role="log" aria-live="polite" aria-busy={busy}>
        <div className="mb-3 rounded-2xl border bg-indigo-50/60 p-4 text-sm leading-relaxed text-slate-800">
          <strong className="block">{RISKA_NAME}</strong>
          <RiskaTypedReply message={welcomeMessage} animate={!welcomeComplete} onProgress={followTyping} onComplete={() => setWelcomeComplete(true)}>{null}</RiskaTypedReply>
        </div>
        {entries.map((entry, i) => <div key={i} className={`motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 text-sm ${entry.role === 'user' ? 'ml-12 rounded-2xl bg-indigo-600 px-4 py-3 text-white' : 'mr-2 rounded-2xl border bg-indigo-50/60 px-4 py-3 leading-relaxed text-slate-800'}`}>
          {entry.role === 'riska' && <strong className="mb-2 block text-xs text-slate-500">{RISKA_NAME}</strong>}
          {entry.role === 'riska' && entry.rows !== undefined && !entry.draft_id && <p>{isAdmin ? 'Berikut data yang Anda minta. ✨' : `Berikut datanya ya, Kak ${greetingName}. 😊`}</p>}
          {entry.role === 'user' ? <p className="whitespace-pre-wrap">{entry.message}</p> : <RiskaTypedReply
            message={entry.message} animate={!completedReplies.has(entry)} onProgress={followTyping}
            onComplete={() => setCompletedReplies(previous => previous.has(entry) ? previous : new Set(previous).add(entry))}>
          {!!entry.choices?.length && entry.conversation_id === conversationId && <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">{entry.choices.map(choice => <button key={choice.message} type="button" className="min-h-11 rounded-lg border bg-white px-3 py-2 text-left disabled:opacity-40" disabled={busy || !!pendingDraft} onClick={() => void sendMessage(choice.message)}>{choice.label}</button>)}</div>}
          {entry.credentials && <div className="mt-2 rounded border border-amber-400 bg-amber-50 p-2">
            <p>Akun {entry.credentials.username} berhasil dibuat. Sampaikan kata sandi sementara secara pribadi; pengguna wajib menggantinya saat login. Kata sandi ini tidak disimpan dalam draf atau penyimpanan browser.</p>
            <details><summary className="min-h-11 cursor-pointer py-2">Tampilkan kata sandi sementara</summary><code className="break-all">{entry.credentials.temporary_password}</code></details>
            <button type="button" className="min-h-11 rounded border px-2" onClick={() => { const cleared = { ...entry, credentials: null }; setCompletedReplies(previous => { const next = new Set(previous); next.delete(entry); next.add(cleared); return next }); setEntries(previous => previous.map(item => item === entry ? cleared : item)) }}>Hapus dari tampilan</button>
          </div>}
          {entry.preview?.details && <p>{Object.entries(entry.preview.details).map(([key, value]) => `${key}: ${value}`).join(" · ")}</p>}
          {entry.preview && <p>{entry.preview.unit} · {entry.preview.operation} · {entry.preview.item} · {entry.preview.tanggal}</p>}
          {entry.valuation && <p className="font-bold">Valuasi: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(entry.valuation))}</p>}
          {entry.parties && Object.entries(entry.parties).map(([kind, parties]) => <details key={kind}><summary>{kind}</summary>{parties.map(p => <p key={p.id}>{p.name}: {p.id}</p>)}</details>)}
          {entry.draft_id && <div className="mt-2 flex flex-wrap gap-2">
            <button disabled={busy || pendingDraft !== entry.draft_id} className="rounded bg-indigo-600 p-2 text-white disabled:opacity-40" onClick={() => void confirm(entry.draft_id!, true)}>{entry.confirmation_level === 'admin' ? 'Ya, Eksekusi' : 'Ya, Eksekusi Sekarang'}</button>
            <button disabled={busy || pendingDraft !== entry.draft_id} className="rounded border p-2 disabled:opacity-40" onClick={() => void confirm(entry.draft_id!, false)}>{entry.confirmation_level === 'admin' ? 'Batalkan' : 'Batal'}</button>
          </div>}
          {!!entry.rows?.length && <div className="overflow-auto"><table className="mt-2 w-full border-collapse">
            <thead><tr>{Object.keys(entry.rows[0]).map(k => <th className="border p-1 text-left" key={k}>{k}</th>)}</tr></thead>
            <tbody>{entry.rows.map((row, j) => <tr key={j} className={row.Status === 'Kritis' ? 'bg-red-100 font-semibold text-red-800' : ''}>{Object.entries(row).map(([k, v]) => <td className="border p-1" key={k}>
              {(['amount', 'saldo', ...(entry.money_columns || [])].includes(k) && Number.isFinite(Number(v))) ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(v)) : String(v)}
            </td>)}</tr>)}</tbody>
          </table></div>}
          {entry.rows !== undefined && !entry.draft_id && !/ada hal lain/i.test(entry.message) && <p className="mt-2">Semoga membantu. Ada hal lain yang perlu Riska cari tahu lagi? ✨</p>}
          </RiskaTypedReply>}
        </div>)}
        {busy && <p role="status" className="flex items-center gap-2 rounded-2xl bg-indigo-50/60 px-4 py-3 text-sm text-slate-600"><span className="motion-safe:animate-pulse" aria-hidden="true">● ● ●</span> Riska sedang menyiapkan jawaban…</p>}
      </div>
      {showCommands && !pendingDraft && !conversationId && <div className="mt-3 max-h-36 shrink-0 space-y-2 overflow-y-auto landscape:max-h-16 md:max-h-36" aria-label="Command List Riska">
        {(['read', 'admin', 'manage', 'local'] as const).map(category => {
          const commands = visibleCommands.filter(command => command.category === category)
          if (!commands.length) return null
          return <div key={category}>
            <p className="text-xs text-slate-500">{category === 'read' ? 'Laporan Ringkas' : category === 'admin' ? 'Eksekusi Strategis Admin' : category === 'manage' ? 'Kelola Data Admin' : 'Operasional — Riska membantu melengkapi data'}</p>
            <div className="flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain py-1" aria-label={`Pintasan ${category}`}>
              {commands.map(command => <button type="button" key={command.id}
                className={`min-h-11 shrink-0 snap-start whitespace-nowrap rounded-full border px-3 text-sm disabled:opacity-40 ${category === 'admin' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'bg-gray-100 text-gray-900'}`}
                disabled={busy || !!pendingDraft || !!conversationId} onClick={() => selectCommand(command)}>{command.label}</button>)}
            </div>
          </div>
        })}
      </div>}
      {conversationId && <div className="flex shrink-0 items-center justify-between gap-2 text-xs">
        <span>Lengkapi jawaban yang diminta Riska.</span>
        <button type="button" className="min-h-11 rounded border px-3" disabled={busy} onClick={() => void sendMessage('batal')}>Batalkan pengisian</button>
      </div>}
      {!isAdmin && <div className="shrink-0 py-2 text-sm">
        {finishPrompt ? <div>
          <p>Ada hal lain yang bisa Riska bantu? Jika sudah selesai, tombol Riska akan hilang sampai Admin menugaskan kembali. Draf yang belum disimpan akan dibatalkan.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded border px-3" disabled={busy} onClick={() => void finishSession()}>Tidak, selesai</button>
            <button type="button" className="min-h-11 rounded border px-3" onClick={() => setFinishPrompt(false)}>Masih ada</button>
          </div>
        </div> : <button type="button" className="min-h-11 rounded border px-3" disabled={busy} onClick={() => setFinishPrompt(true)}>Akhiri sesi bantuan</button>}
      </div>}
      <form className="flex shrink-0 gap-2 pb-[env(safe-area-inset-bottom)]" onSubmit={e => { e.preventDefault(); void sendMessage() }}>
        <input ref={messageInput} aria-label="Pesan untuk Riska" className="min-h-11 min-w-0 flex-1 rounded border bg-white p-2 text-base" placeholder={pendingDraft && canRevise ? 'Tulis koreksi draf, misalnya modalnya jadi 6 juta…' : conversationId ? "Silakan jawab, saya bantu melengkapi…" : "Ceritakan pekerjaan yang ingin dibantu…"} maxLength={1000}
          value={message} onChange={e => setMessage(e.target.value)} disabled={busy || (!!pendingDraft && !canRevise)} />
        <button className="rounded bg-indigo-600 px-3 text-white" disabled={busy || (!!pendingDraft && !canRevise) || !message.trim()}>{busy ? '…' : 'Kirim'}</button>
      </form>
    </section>}
    {!open && <button className="float-right rounded-full bg-indigo-600 px-4 py-3 text-white shadow-lg" aria-expanded={open} onClick={() => setOpen(!open)}>
      {RISKA_NAME}
    </button>}
  </aside>, document.body)
}
