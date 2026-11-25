import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDoc, getDocs, setDoc, deleteDoc, doc, serverTimestamp, Timestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// IMPORT SUPABASE UNTUK STORAGE
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// KONFIGURASI FIREBASE SOLUT-WEB
const firebaseConfig = {
    apiKey: "AIzaSyDgpI-QHB6uE0FYk2Y3c_b_8mbVSuu9AEY",
    authDomain: "solut-web.firebaseapp.com",
    projectId: "solut-web",
    storageBucket: "solut-web.firebasestorage.app",
    messagingSenderId: "1062608559953",
    appId: "1:1062608559953:web:3d46a866f9667a3f61bd70"
};

// KONFIGURASI SUPABASE
const SUPABASE_URL = "https://elruhmnrsnxiggvdsvyn.supabase.co";
const SUPABASE_KEY = "sb_publishable_PV3hCDNPoOG1aYyVuyiIIQ_qU-Wzpcc";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);
const DOMAIN_INTERNAL = "@solut.internal";

// Helper Ambil Nilai Input dengan Aman
function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : null;
}

// Monitor Status Login
onAuthStateChanged(auth, async (user) => {
    const path = window.location.pathname;

    // KONTROL TOMBOL NAVIGASI HEADER (LOGIN PETUGAS vs DASHBOARD)
    const btnNavAuth = document.getElementById('btnNavAuth');
    if (btnNavAuth) {
        if (user) {
            btnNavAuth.innerText = "Dashboard";
            btnNavAuth.href = "dashboard.html";
        } else {
            btnNavAuth.innerText = "Login Petugas";
            btnNavAuth.href = "login.html";
        }
    }

    if (path.includes('dashboard.html') || path.includes('detail.html')) {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const labelPetugas = document.getElementById('labelPetugasAktif');
                if (labelPetugas) labelPetugas.innerText = "Halo, " + userData.username;
                if (userData.role === 'admin') {
                    const btnAdmin = document.getElementById('btnBukaModalAdmin');
                    if (btnAdmin) btnAdmin.classList.remove('hidden');
                }
            }
            if (path.includes('dashboard.html')) muatDataTabel();
            if (path.includes('detail.html')) muatDataDetail();
        }
    }
    if (path.includes('login.html') && user) {
        window.location.href = 'dashboard.html';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    
    // --- FILTER INPUT WARGA (REAL-TIME REGEX) ---
    const inpNama = document.getElementById('inpNama');
    const inpNik = document.getElementById('inpNik');
    const inpHp = document.getElementById('inpHp');

    if (inpNama) {
        inpNama.addEventListener('input', function() {
            this.value = this.value.replace(/[^A-Za-z\s\-]/g, '');
        });
    }
    if (inpNik) {
        inpNik.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }
    if (inpHp) {
        inpHp.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    // --- FITUR FORM PENGAJUAN SURAT (UNIVERSAL & DINAMIS) ---
    const formPengajuan = document.getElementById('formPengajuan');
    if (formPengajuan) {
        formPengajuan.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSubmitForm');
            const fileInput = document.getElementById('inpFile');
            const file = fileInput.files[0];
            
            const judulSurat = document.getElementById('formTitle') ? document.getElementById('formTitle').innerText : "Permohonan Surat";

            if (file && file.size > 5242880) {
                alert("Ukuran file terlalu besar! Maksimal 5MB.");
                return;
            }

            btn.innerText = "Sedang Mengupload...";
            btn.disabled = true;

            try {
                let urlBerkas = "";
                let namaFileSupabase = "";
                
                // UPLOAD SUPABASE
                if (file) {
                    namaFileSupabase = Date.now() + "_" + file.name.replace(/\s+/g, '-');
                    const { data, error } = await supabase.storage.from('berkas-warga').upload(namaFileSupabase, file);
                    if (error) throw new Error("Gagal upload ke Supabase: " + error.message);

                    const { data: publicUrlData } = supabase.storage.from('berkas-warga').getPublicUrl(namaFileSupabase);
                    urlBerkas = publicUrlData.publicUrl;
                }

                // HITUNG BATAS 4 HARI DARI SEKARANG (4 hari dalam milidetik)
                const empatHariMs = 4 * 24 * 60 * 60 * 1000;
                const waktuExpired = Timestamp.fromDate(new Date(Date.now() + empatHariMs));

                // OBJEK DATA UTAMA FIRESTORE
                const payload = {
                    nama: getVal('inpNama'),
                    nik: getVal('inpNik'),
                    no_hp: getVal('inpHp'),
                    alamat: getVal('inpAlamat') || "-",
                    jenis_surat: judulSurat,
                    url_berkas: urlBerkas,
                    nama_file_storage: namaFileSupabase,
                    status: "Menunggu Verifikasi",
                    tanggal_pengajuan: serverTimestamp(),
                    expired_at: waktuExpired,

                    // DATA DIRI TAMBAHAN
                    tempat_lahir: getVal('inpTempatLahir'),
                    tanggal_lahir: getVal('inpTanggalLahir'),
                    jenis_kelamin: getVal('inpJk'),
                    kewarganegaraan: getVal('inpKewarganegaraan'),
                    agama: getVal('inpAgama'),
                    pekerjaan: getVal('inpPekerjaan'),
                    status_perkawinan: getVal('inpStatusKawin'),
                    pendidikan: getVal('inpPendidikan'),
                    rt: getVal('inpRt'),
                    rw: getVal('inpRw'),
                    keperluan: getVal('inpKeperluan') || "-",
                    atas_nama: getVal('inpAtasNama'),

                    // DATA SURAT JANDA / DUDA
                    status_sebutan: getVal('inpStatusSebutan'),
                    status_cerai: getVal('inpStatusCerai'),
                    nama_mantan: getVal('inpNamaMantan'),

                    // DATA AYAH KANDUNG (PERMOHONAN NIKAH)
                    ayah_nama: getVal('inpAyahNama'),
                    ayah_nik: getVal('inpAyahNik'),
                    ayah_tempat_lahir: getVal('inpAyahTempatLahir'),
                    ayah_tanggal_lahir: getVal('inpAyahTanggalLahir'),
                    ayah_kewarganegaraan: getVal('inpAyahKewarganegaraan'),
                    ayah_agama: getVal('inpAyahAgama'),
                    ayah_pekerjaan: getVal('inpAyahPekerjaan'),
                    ayah_alamat: getVal('inpAyahAlamat'),

                    // DATA IBU KANDUNG (PERMOHONAN NIKAH)
                    ibu_nama: getVal('inpIbuNama'),
                    ibu_nik: getVal('inpIbuNik'),
                    ibu_tempat_lahir: getVal('inpIbuTempatLahir'),
                    ibu_tanggal_lahir: getVal('inpIbuTanggalLahir'),
                    ibu_kewarganegaraan: getVal('inpIbuKewarganegaraan'),
                    ibu_agama: getVal('inpIbuAgama'),
                    ibu_pekerjaan: getVal('inpIbuPekerjaan'),
                    ibu_alamat: getVal('inpIbuAlamat'),

                    // DATA CALON PASANGAN (PERMOHONAN NIKAH)
                    pasangan_nama: getVal('inpPasanganNama'),
                    pasangan_nik: getVal('inpPasanganNik'),
                    pasangan_jk: getVal('inpPasanganJk'),
                    pasangan_kewarganegaraan: getVal('inpPasanganKewarganegaraan'),
                    pasangan_tempat_lahir: getVal('inpPasanganTempatLahir'),
                    pasangan_tanggal_lahir: getVal('inpPasanganTanggalLahir'),
                    pasangan_agama: getVal('inpPasanganAgama'),
                    pasangan_pekerjaan: getVal('inpPasanganPekerjaan'),
                    pasangan_status_kawin: getVal('inpPasanganStatusKawin'),
                    pasangan_nama_ayah: getVal('inpPasanganNamaAyah'),
                    pasangan_alamat: getVal('inpPasanganAlamat'),

                    // WAKTU & TEMPAT AKAD (PERMOHONAN NIKAH)
                    akad_hari_tanggal: getVal('inpAkadHariTanggal'),
                    akad_tempat: getVal('inpAkadTempat')
                };

                // HAPUS PROPERTI NULL/UNDEFINED SEBELUM DIKIRIM
                Object.keys(payload).forEach(key => payload[key] === null && delete payload[key]);

                await addDoc(collection(db, "permohonan_surat"), payload);

                alert("Permohonan Berhasil Dikirim!");
                window.location.href = 'layanan.html';
            } catch (err) {
                alert("Gagal mengirim data: " + err.message);
                console.error(err);
            } finally {
                btn.innerText = "Kirim Permohonan";
                btn.disabled = false;
            }
        });
    }

    // --- FITUR LOGIN PETUGAS ---
    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim().toLowerCase();
            const password = document.getElementById('loginPassword').value;
            const btn = document.getElementById('btnLoginSubmit');
            btn.innerText = "Memeriksa...";
            btn.disabled = true;

            try {
                await signInWithEmailAndPassword(auth, username + DOMAIN_INTERNAL, password);
                window.location.href = 'dashboard.html';
            } catch (error) {
                alert("Username atau Password salah!");
            } finally {
                btn.innerText = "Masuk ke Sistem";
                btn.disabled = false;
            }
        });
    }

    // --- FITUR LOGOUT ---
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if (confirm("Apakah Anda yakin ingin keluar?")) {
                await signOut(auth);
                window.location.href = 'login.html';
            }
        });
    }

    // --- FITUR ADMIN: BUAT AKUN ---
    const btnBukaModal = document.getElementById('btnBukaModalAdmin');
    const modalAdmin = document.getElementById('modalAdmin');
    const btnTutupModal = document.getElementById('btnTutupModal');
    const formBuatAkun = document.getElementById('formBuatAkun');

    if (btnBukaModal && modalAdmin) {
        btnBukaModal.addEventListener('click', () => modalAdmin.classList.remove('hidden'));
        btnTutupModal.addEventListener('click', () => modalAdmin.classList.add('hidden'));

        formBuatAkun.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userBaru = document.getElementById('newUsername').value.trim().toLowerCase();
            const passBaru = document.getElementById('newPassword').value;
            const btnSubmit = document.getElementById('btnSubmitAkun');
            btnSubmit.innerText = "Memproses...";
            btnSubmit.disabled = true;

            try {
                const cred = await createUserWithEmailAndPassword(secondaryAuth, userBaru + DOMAIN_INTERNAL, passBaru);
                await setDoc(doc(db, "users", cred.user.uid), {
                    username: userBaru,
                    role: "petugas",
                    dibuat_pada: serverTimestamp()
                });
                alert(`Akun petugas "${userBaru}" berhasil dibuat!`);
                modalAdmin.classList.add('hidden');
                formBuatAkun.reset();
            } catch (error) {
                alert("Gagal membuat akun: " + error.message);
            } finally {
                btnSubmit.innerText = "Buat Akun";
                btnSubmit.disabled = false;
            }
        });
    }

    // --- FITUR SALIN TEKS ---
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-copy');
        if (btn) {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                navigator.clipboard.writeText(targetEl.innerText).then(() => {
                    const textAwal = btn.innerHTML;
                    btn.innerHTML = "✓ Tersalin";
                    btn.classList.add("text-green-600");
                    setTimeout(() => {
                        btn.innerHTML = textAwal;
                        btn.classList.remove("text-green-600");
                    }, 2000);
                });
            }
        }
    });
});

// --- FUNGSI TABEL DASHBOARD (DENGAN AUTO-DELETE > 4 HARI) ---
async function muatDataTabel() {
    const tabelData = document.getElementById('tabelData');
    if (!tabelData) return;

    // 1. Sapu bersih file yatim/kadaluarsa di Supabase Storage
    await bersihkanStorageSupabase();

    try {
        const q = query(collection(db, "permohonan_surat"), orderBy("tanggal_pengajuan", "desc"));
        const querySnapshot = await getDocs(q);
        tabelData.innerHTML = "";

        const sekarang = new Date();
        let jumlahTampil = 0;

        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            const id = docSnap.id;

            // Cek apakah usia data > 4 hari
            let isExpired = false;
            if (data.expired_at) {
                isExpired = data.expired_at.toDate() < sekarang;
            } else if (data.tanggal_pengajuan) {
                // Fallback untuk data lama sebelum fitur expired_at ditambahkan
                const batasLama = new Date(data.tanggal_pengajuan.toDate().getTime() + (4 * 24 * 60 * 60 * 1000));
                isExpired = batasLama < sekarang;
            }

            if (isExpired) {
                // Hapus file di Supabase Storage terlebih dahulu
                if (data.nama_file_storage) {
                    await supabase.storage.from('berkas-warga').remove([data.nama_file_storage]);
                } else if (data.url_berkas) {
                    const namaDariUrl = data.url_berkas.split('/').pop();
                    if (namaDariUrl) await supabase.storage.from('berkas-warga').remove([namaDariUrl]);
                }
                // Hapus dokumen dari Firestore
                await deleteDoc(doc(db, "permohonan_surat", id));
                continue;
            }

            jumlahTampil++;
            const row = `
                <tr class="hover:bg-gray-50 transition border-b border-gray-50">
                    <td class="p-4 font-medium text-gray-900">${data.nama || '-'}</td>
                    <td class="p-4 text-xs font-semibold text-blue-700"><span class="bg-blue-50 px-2 py-1 rounded">${data.jenis_surat || '-'}</span></td>
                    <td class="p-4">${data.no_hp || '-'}</td>
                    <td class="p-4 text-center">
                        <a href="detail.html?id=${id}" class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition shadow-sm">&rarr;</a>
                    </td>
                </tr>
            `;
            tabelData.innerHTML += row;
        }

        if (jumlahTampil === 0) {
            tabelData.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Belum ada data pengajuan surat.</td></tr>`;
        }
    } catch (error) {
        console.error("Gagal memuat tabel:", error);
        tabelData.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal memuat data dari server.</td></tr>`;
    }
}

// --- FUNGSI SAPU BERSIH FILE SUPABASE > 4 HARI ---
async function bersihkanStorageSupabase() {
    try {
        const { data: listFile, error } = await supabase.storage.from('berkas-warga').list('', {
            limit: 100
        });

        if (error || !listFile) return;

        const batasWaktu = Date.now() - (4 * 24 * 60 * 60 * 1000);
        const fileKadaluarsa = [];

        listFile.forEach((file) => {
            if (file.created_at) {
                const waktuUpload = new Date(file.created_at).getTime();
                if (waktuUpload < batasWaktu) {
                    fileKadaluarsa.push(file.name);
                }
            }
        });

        if (fileKadaluarsa.length > 0) {
            await supabase.storage.from('berkas-warga').remove(fileKadaluarsa);
        }
    } catch (err) {
        console.error("Gagal membersihkan storage Supabase:", err);
    }
}

// --- FUNGSI DETAIL WARGA (SEMUA INFORMASI DALAM 1 CONTAINER SESUAI URUTAN FORM) ---
async function muatDataDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('id');

    if (!docId) {
        window.location.href = 'dashboard.html';
        return;
    }

    try {
        const docRef = doc(db, "permohonan_surat", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('detId').innerText = docId;
            document.getElementById('detNama').innerText = data.nama || '-';
            document.getElementById('detJenisSurat').innerText = data.jenis_surat || '-';
            document.getElementById('copyHp').innerText = data.no_hp || '-';

            const btnBukaFile = document.getElementById('btnBukaFile');
            if (data.url_berkas) {
                btnBukaFile.href = data.url_berkas;
                btnBukaFile.classList.remove('hidden');
            } else {
                btnBukaFile.classList.add('hidden');
            }

            // CONTAINER TUNGGAL SELURUH INFORMASI PENGAJUAN
            const containerSemua = document.getElementById('containerSemuaInformasi');
            if (containerSemua) {
                containerSemua.innerHTML = "";

                // KAMUS LABEL UNTUK PETUGAS
                const labelMap = {
                    nama: "Nama Lengkap",
                    nik: "NIK",
                    tempat_lahir: "Tempat Lahir",
                    tanggal_lahir: "Tanggal Lahir",
                    jenis_kelamin: "Jenis Kelamin",
                    kewarganegaraan: "Kewarganegaraan",
                    agama: "Agama",
                    pekerjaan: "Pekerjaan",
                    status_perkawinan: "Status Perkawinan",
                    pendidikan: "Pendidikan Terakhir",
                    alamat: "Alamat Sesuai KTP",
                    rt: "Warga RT",
                    rw: "Warga RW",
                    keperluan: "Keperluan",
                    atas_nama: "Atas Nama",

                    status_sebutan: "Status Sebutan Janda/Duda",
                    status_cerai: "Status Perceraian",
                    nama_mantan: "Nama Mantan Pasangan",

                    ayah_nama: "Ayah - Nama Lengkap",
                    ayah_nik: "Ayah - NIK",
                    ayah_tempat_lahir: "Ayah - Tempat Lahir",
                    ayah_tanggal_lahir: "Ayah - Tanggal Lahir",
                    ayah_kewarganegaraan: "Ayah - Kewarganegaraan",
                    ayah_agama: "Ayah - Agama",
                    ayah_pekerjaan: "Ayah - Pekerjaan",
                    ayah_alamat: "Ayah - Alamat",

                    ibu_nama: "Ibu - Nama Lengkap",
                    ibu_nik: "Ibu - NIK",
                    ibu_tempat_lahir: "Ibu - Tempat Lahir",
                    ibu_tanggal_lahir: "Ibu - Tanggal Lahir",
                    ibu_kewarganegaraan: "Ibu - Kewarganegaraan",
                    ibu_agama: "Ibu - Agama",
                    ibu_pekerjaan: "Ibu - Pekerjaan",
                    ibu_alamat: "Ibu - Alamat",

                    pasangan_nama: "Calon Pasangan - Nama Lengkap",
                    pasangan_nik: "Calon Pasangan - NIK",
                    pasangan_jk: "Calon Pasangan - Jenis Kelamin",
                    pasangan_kewarganegaraan: "Calon Pasangan - Kewarganegaraan",
                    pasangan_tempat_lahir: "Calon Pasangan - Tempat Lahir",
                    pasangan_tanggal_lahir: "Calon Pasangan - Tanggal Lahir",
                    pasangan_agama: "Calon Pasangan - Agama",
                    pasangan_pekerjaan: "Calon Pasangan - Pekerjaan",
                    pasangan_status_kawin: "Calon Pasangan - Status Perkawinan",
                    pasangan_nama_ayah: "Calon Pasangan - Nama Ayah Kandung",
                    pasangan_alamat: "Calon Pasangan - Alamat Rumah",

                    akad_hari_tanggal: "Akad Nikah - Hari & Tanggal",
                    akad_tempat: "Akad Nikah - Tempat Pelaksanaan"
                };

                // URUTAN BAKU SESUAI FORMULIR INPUTAN (TERMASUK NAMA, NIK, ALAMAT)
                const orderedKeys = [
                    // Data Diri Pemohon
                    'nama',
                    'nik',
                    'tempat_lahir',
                    'tanggal_lahir',
                    'jenis_kelamin',
                    'kewarganegaraan',
                    'agama',
                    'pekerjaan',
                    'status_perkawinan',
                    'pendidikan',
                    'alamat',
                    'rt',
                    'rw',
                    'keperluan',
                    'atas_nama',

                    // Data Pasangan yang Diceraikan (Surat Janda/Duda)
                    'status_sebutan',
                    'status_cerai',
                    'nama_mantan',

                    // Data Ayah Kandung (Permohonan Nikah)
                    'ayah_nama',
                    'ayah_nik',
                    'ayah_tempat_lahir',
                    'ayah_tanggal_lahir',
                    'ayah_kewarganegaraan',
                    'ayah_agama',
                    'ayah_pekerjaan',
                    'ayah_alamat',

                    // Data Ibu Kandung (Permohonan Nikah)
                    'ibu_nama',
                    'ibu_nik',
                    'ibu_tempat_lahir',
                    'ibu_tanggal_lahir',
                    'ibu_kewarganegaraan',
                    'ibu_agama',
                    'ibu_pekerjaan',
                    'ibu_alamat',

                    // Data Calon Pasangan (Permohonan Nikah)
                    'pasangan_nama',
                    'pasangan_nik',
                    'pasangan_jk',
                    'pasangan_kewarganegaraan',
                    'pasangan_tempat_lahir',
                    'pasangan_tanggal_lahir',
                    'pasangan_agama',
                    'pasangan_pekerjaan',
                    'pasangan_status_kawin',
                    'pasangan_nama_ayah',
                    'pasangan_alamat',

                    // Waktu & Tempat Akad (Permohonan Nikah)
                    'akad_hari_tanggal',
                    'akad_tempat'
                ];

                // ABAIKAN FIELD KONTAK, BERKAS & TEKNIS SISTEM (KARENA SUDAH TERPISAH DI BAWAH)
                const ignoredKeys = [
                    'no_hp', 'jenis_surat', 'url_berkas', 'nama_file_storage', 
                    'status', 'tanggal_pengajuan', 'expired_at'
                ];

                const remainingKeys = Object.keys(data).filter(
                    k => !orderedKeys.includes(k) && !ignoredKeys.includes(k)
                );
                const finalKeys = [...orderedKeys, ...remainingKeys];

                let count = 0;
                finalKeys.forEach((key) => {
                    if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
                        count++;
                        const labelText = labelMap[key] || key.replace(/_/g, ' ').toUpperCase();
                        const fieldId = `copy_${key}`;
                        
                        const itemHtml = `
                            <div class="flex justify-between p-3 bg-gray-50 rounded-lg items-center">
                                <div>
                                    <span class="text-xs text-gray-400 block uppercase font-medium">${labelText}</span>
                                    <span id="${fieldId}" class="font-medium text-gray-800">${data[key]}</span>
                                </div>
                                <button class="btn-copy text-xs border border-gray-300 bg-white px-3 py-1.5 rounded hover:bg-gray-100 flex items-center gap-1" data-target="${fieldId}">📋 Salin</button>
                            </div>
                        `;
                        containerSemua.innerHTML += itemHtml;
                    }
                });

                if (count === 0) {
                    containerSemua.innerHTML = `<p class="text-sm text-gray-400 italic">Tidak ada data pengajuan.</p>`;
                }
            }
        } else {
            alert("Data permohonan tidak ditemukan.");
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error("Gagal mengambil detail:", error);
    }
}