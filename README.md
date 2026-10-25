# 🕯️ RUMAH ABU-ABU — Horror 3D

Game horor 3D yang berjalan langsung di browser (desktop & HP). Tanpa aset eksternal —
semua tekstur, wajah jumpscare, dan suara **dibuat secara prosedural** (Canvas 2D + Web Audio API).

## Cara main

1. Kumpulkan **3 kunci** (torus emas berpendar) yang tersebar di labirin rumah.
2. Temukan **pintu keluar** hijau yang menyala, lalu dekati untuk menang.
3. Di dalam ada **sosok abu-abu** yang mengejarmu saat dia melihatmu. Jangan sampai tersentuh.

| Kontrol | Desktop | HP |
|---|---|---|
| Gerak | `W A S D` | Joystick kiri |
| Lihat | Mouse (klik untuk kunci kursor) | Joystick kanan |
| Senter | `F` | Otomatis menyala |
| Berlari | `Shift` (pakai stamina) | — |

**Tips:** baterai senter terus terkuras. Matikan senter (`F`) untuk menghemat —
tetapi kamu jadi tidak bisa melihat apa pun. Detak jantung makin cepat = sosok makin dekat.

## Menjalankan secara lokal

```bash
python3 -m http.server 8099
# buka http://localhost:8099
```

Harus lewat server (bukan `file://`) karena memakai ES Modules.

## Struktur

```
index.html   — markup, gaya, layar menu/menang/kalah
game.js      — seluruh logika game (Three.js)
vendor/      — Three.js r160 (lokal, agar tetap jalan tanpa internet)
vercel.json  — konfigurasi header & clean URLs
```

## Detail teknis

- **Labirin** dibuat dengan randomized DFS, lalu sebagian dinding dibuka agar terasa lapang dan bercabang.
- **Dinding** dirender sebagai satu `InstancedMesh` (≈140 kotak dalam 1 draw call) agar ringan di HP.
- **AI sosok**: raycast garis (`hasLOS`) + pathfinding haluan (steering) sederhana, mode `wander` ⇄ `chase`.
- **Jumpscare**: wajah digambar ulang tiap frame di Canvas 2D dengan jitter acak, disertai teriakan hasil sintesis.
- **Audio**: detak jantung, drone, bisikan, dan langkah — semua dari `OscillatorNode`/noise buffer.
- **Performa**: `FogExp2` menggantikan jarak pandang jauh, pixel ratio dibatasi di perangkat sentuh.

Deploy ke Vercel: `vercel --prod`
