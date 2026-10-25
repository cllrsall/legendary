               SALL - PETUNJUK INSTALASI / INSTALLATION GUIDE

[ INDONESIAN ]
Jika saat membuka aplikasi Sall muncul pesan error dari macOS:
"Sall is damaged and can't be opened. You should move it to the Trash."
(atau "Aplikasi rusak dan tidak dapat dibuka"), hal ini disebabkan oleh 
fitur keamanan macOS Gatekeeper pada aplikasi yang belum ditandatangani
sertifikat Apple Developer.

Cara Mengatasinya (Sangat Mudah):
1. Seret (drag & drop) Sall.app ke dalam folder Applications.
2. Buka aplikasi Terminal di Mac Anda (Cmd + Space, ketik Terminal).
3. Salin dan jalankan salah satu perintah berikut di Terminal:

   sudo xattr -rd com.apple.quarantine /Applications/Sall.app

   (Atau jika masih belum bisa, gunakan perintah alternatif ini):
   sudo xattr -cr /Applications/Sall.app

4. Tekan Enter, masukkan password Mac Anda (password tidak terlihat saat diketik),
   lalu tekan Enter.
5. Buka kembali aplikasi Sall.app dari folder Applications atau Launchpad!


--------------------------------------------------------------------


[ ENGLISH ]
If macOS displays the warning:
"Sall is damaged and can't be opened. You should move it to the Trash."
This is a standard macOS Gatekeeper check for non-App Store applications.

How to Fix:
1. Drag and drop Sall.app into your Applications folder.
2. Open the Terminal application on your Mac (Cmd + Space, type Terminal).
3. Paste and run one of the following commands in Terminal:

   sudo xattr -rd com.apple.quarantine /Applications/Sall.app

   (Or use this alternative command if needed):
   sudo xattr -cr /Applications/Sall.app

4. Press Enter, type your Mac password, and press Enter again.
5. Launch Sall.app from your Applications folder!