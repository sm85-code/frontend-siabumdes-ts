# Riska nonaktif secara bawaan

`VITE_RISKA_ENABLED` hanya aktif untuk string tepat `true` saat build. Flag bukan izin pengguna
dan tidak dapat diaktifkan dari localStorage. Environment frontend tidak menggantikan guard backend
`RISKA_ENABLED` (default nonaktif). Kedua flag harus true untuk memakai fitur.

Saat nonaktif:
- Layout tidak memasang widget; RiskaChatBox juga memblokir mount session internal.
- Timer 5 detik availability dan refresh metadata unit tidak pernah dimulai.
- NAV tidak menampilkan Izin Riska, termasuk konsumen sidebar/mobile.
- Route `/riska-permissions` redirect ke dashboard tanpa memuat halaman admin.
- Komponen halaman memiliki guard sendiri sebelum hook query/mutation dipasang.

Kode tetap tersedia. Tidak ada perubahan pada data/penugasan atau fungsi transaksi/laporan biasa.
Tidak ada scheduler Riska frontend selain timer dalam widget dan query penugasan yang kini tidak dipasang.
Backend menolak akses langsung/klien lama; perubahan frontend saja tidak cukup untuk keamanan.

Merge main memicu deploy Cloudflare Pages otomatis: tunggu persetujuan produksi.
Set `VITE_RISKA_ENABLED=false` saat build, lalu deploy setelah backend memblokir API.
Pengguna harus reload tab lama agar timer versi lama berhenti; tidak ada mekanisme menghapus timer tab lama dari server.

Tes standar memakai build default nonaktif. Untuk menguji fitur aktif yang tetap disimpan,
build dengan `VITE_RISKA_ENABLED=true` lalu jalankan smoke dengan environment yang sama
(e2e/riska-agent.spec.ts). Tes disabled dilewati hanya pada build opt-in tersebut.
