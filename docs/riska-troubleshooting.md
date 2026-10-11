# Riska belum muncul pada pengguna yang ditugaskan

1. Jika menugaskan melalui chat Admin, perintah pertama membuat draf. Tekan **Ya, Eksekusi** dan pastikan Riska membalas bahwa penugasan sudah **aktif**. Mengetik perintah saja belum memberikan izin.
2. Pada halaman **Penugasan Asisten Riska**, cari **username pengguna yang benar**, misalnya `pengelola4`. Pastikan saklar aktif serta pengguna dan unit tidak dinonaktifkan.
3. Penerima kembali membuka tab SIABUMDES. Status diperiksa ketika halaman kembali aktif dan setiap sekitar **5 detik**. Jika memakai tampilan lama, muat ulang halaman setelah deployment frontend selesai.
4. Jika pengguna sudah memilih **Tidak, selesai**, Admin perlu menugaskan kembali. Tombol X hanya meminimalkan, tidak mengakhiri penugasan.

Perubahan role/unit membatalkan kecocokan penugasan lama; Admin perlu memberikan penugasan baru. Jangan mengaktifkan Riska dengan mengubah `localStorage` atau mengabaikan pemeriksaan akses.

Widget mengikuti jawaban API izin, bukan keberhasilan pemuatan daftar unit. Jika daftar unit gagal sementara, Riska tetap terlihat bagi pengguna yang diizinkan dan menampilkan pemberitahuan. Daftar unit dicoba lagi tanpa mengubah hak akses.

Merge dan CI hijau membuktikan perubahan masuk repositori. Deployment produksi dan status penugasan pengguna perlu diperiksa tersendiri apabila masalah masih terjadi.
