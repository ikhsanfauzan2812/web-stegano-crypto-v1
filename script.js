// Keyboard QWERTY mapping (huruf besar dan kecil)
const qwertyMap = "QqWwEeRrTtYyUuIiOoPpAaSsDdFfGgHhJjKkLlZzXxCcVvBbNnMm".split('');

// Function untuk Caesar Cipher Encryption
function caesarEncrypt(text, key) {
    return text.split('').map(char => {
        if (!qwertyMap.includes(char)) return char;
        const index = qwertyMap.indexOf(char);
        const newIndex = (index + key) % qwertyMap.length;
        return qwertyMap[newIndex];
    }).join('');
}

// Function untuk Caesar Cipher Decryption
function caesarDecrypt(text, key) {
    return text.split('').map(char => {
        if (!qwertyMap.includes(char)) return char;
        const index = qwertyMap.indexOf(char);
        const newIndex = (index - key + qwertyMap.length) % qwertyMap.length;
        return qwertyMap[newIndex];
    }).join('');
}

// Fungsi untuk mendapatkan pixel data sebelum steganografi
function getOriginalPixelData(imageData) {
    const pixels = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
        pixels.push(`(${imageData.data[i]}, ${imageData.data[i+1]}, ${imageData.data[i+2]}, ${imageData.data[i+3]})`);
    }
    return pixels.join('\n');
}

// Fungsi untuk mendapatkan pixel data setelah steganografi
function getModifiedPixelData(imageData) {
    const pixels = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
        pixels.push(`(${imageData.data[i]}, ${imageData.data[i+1]}, ${imageData.data[i+2]}, ${imageData.data[i+3]})`);
    }
    return pixels.join('\n');
}

// Modifikasi fungsi embedMessage untuk menyimpan data pixel
async function embedMessage(image, message) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const originalPixels = getOriginalPixelData(imageData); // Simpan data pixel sebelum
    
    // Proses embedding LSB
    const binary = message.split('').map(char => 
        char.charCodeAt(0).toString(2).padStart(8, '0')
    ).join('');
    
    let bitIndex = 0;
    for (let i = 0; i < imageData.data.length && bitIndex < binary.length; i += 4) {
        if (bitIndex < binary.length) {
            // Modifikasi LSB dari komponen RGB (tidak hanya R)
            imageData.data[i] = (imageData.data[i] & 0xFE) | parseInt(binary[bitIndex]);
            bitIndex++;
            if (bitIndex < binary.length) {
                imageData.data[i + 1] = (imageData.data[i + 1] & 0xFE) | parseInt(binary[bitIndex]);
                bitIndex++;
            }
            if (bitIndex < binary.length) {
                imageData.data[i + 2] = (imageData.data[i + 2] & 0xFE) | parseInt(binary[bitIndex]);
                bitIndex++;
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    const modifiedPixels = getModifiedPixelData(imageData); // Simpan data pixel sesudah
    
    // Tambahkan delay antara downloads
    await downloadPixelData(originalPixels, 'pixel_before.txt');
    await new Promise(resolve => setTimeout(resolve, 500)); // delay 500ms
    await downloadPixelData(modifiedPixels, 'pixel_after.txt');
    
    return canvas.toDataURL();
}

// Modifikasi fungsi downloadPixelData menjadi async
async function downloadPixelData(pixelData, filename) {
    return new Promise((resolve) => {
        const blob = new Blob([pixelData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.onclick = () => {
            setTimeout(() => {
                URL.revokeObjectURL(url);
                resolve();
            }, 100);
        };
        a.click();
    });
}

// LSB Steganography Decryption
function decodeMessage(imageData) {
    try {
        let binary = '';
        let message = '';
        let bitCount = 0;
        
        // Ekstrak LSB hanya sampai mendapatkan karakter yang valid
        for (let i = 0; i < imageData.data.length && bitCount < 1000; i += 4) { // batasi maksimal 1000 bit
            // Ambil LSB dari R, G, B secara berurutan
            if (bitCount % 8 === 0 && bitCount > 0) {
                // Cek setiap 8 bit (1 karakter)
                const char = String.fromCharCode(parseInt(binary.slice(bitCount - 8, bitCount), 2));
                if (char === '\0' || !char.match(/[\x20-\x7E]/)) { // cek karakter valid ASCII
                    break; // stop jika menemukan null atau karakter tidak valid
                }
            }
            
            binary += (imageData.data[i] & 1).toString();      // R
            bitCount++;
            if (bitCount % 8 !== 0) {
                binary += (imageData.data[i + 1] & 1).toString();  // G
                bitCount++;
            }
            if (bitCount % 8 !== 0) {
                binary += (imageData.data[i + 2] & 1).toString();  // B
                bitCount++;
            }
        }

        // Konversi binary ke string
        for (let i = 0; i < binary.length; i += 8) {
            const byte = binary.substr(i, 8);
            const charCode = parseInt(byte, 2);
            
            // Stop jika menemukan null terminator atau karakter tidak valid
            if (charCode === 0 || !String.fromCharCode(charCode).match(/[\x20-\x7E]/)) {
                break;
            }
            
            message += String.fromCharCode(charCode);
        }

        if (!message) {
            throw new Error("Tidak ada pesan yang ditemukan dalam gambar");
        }

        return message;
    } catch (error) {
        throw new Error("Gagal mengekstrak pesan: " + error.message);
    }
}

function savePixelDataToFile(imageData, title, filename) {
    let pixelData = `=== ${title} ===\n`;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];
        pixelData += `Pixel ${i / 4}: R=${r}, G=${g}, B=${b}, A=${a}\n`;
    }

    // Buat file teks dan unduh
    const blob = new Blob([pixelData], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function comparePixels() {
    const beforeText = document.getElementById('beforePixels').value;
    const afterText = document.getElementById('afterPixels').value;
    
    const beforePixels = beforeText.split('\n').filter(line => line.trim());
    const afterPixels = afterText.split('\n').filter(line => line.trim());
    
    let differences = [];
    let totalDiff = 0;
    
    // Bandingkan setiap pixel dan tampilkan perbedaan bit
    for (let i = 0; i < beforePixels.length; i++) {
        const before = beforePixels[i].match(/\d+/g);
        const after = afterPixels[i].match(/\d+/g);
        
        if (before && after) {
            for (let j = 0; j < 3; j++) { // Periksa RGB
                if (before[j] !== after[j]) {
                    const beforeBin = parseInt(before[j]).toString(2).padStart(8, '0');
                    const afterBin = parseInt(after[j]).toString(2).padStart(8, '0');
                    differences.push(`Baris ${i+1} Komponen ${j === 0 ? 'R' : j === 1 ? 'G' : 'B'}: 
                        ${before[j]}(${beforeBin}) → ${after[j]}(${afterBin})`);
                    totalDiff++;
                }
            }
        }
    }
    
    // Tampilkan hasil perbandingan
    const resultDiv = document.getElementById('comparisonResult');
    if (differences.length > 0) {
        let html = `<div class="alert alert-info">
            <h6>Ditemukan ${totalDiff} perbedaan pixel:</h6>
            <ul>`;
        differences.forEach(diff => {
            html += `<li>${diff}</li>`;
        });
        html += '</ul></div>';
        resultDiv.innerHTML = html;
    } else {
        resultDiv.innerHTML = '<div class="alert alert-success">Tidak ada perbedaan pixel yang ditemukan.</div>';
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi AOS
    AOS.init({
        duration: 800,
        easing: 'ease-in-out',
        once: true,
        mirror: false
    });

    // Preview gambar untuk enkripsi
    document.getElementById('imageInput').addEventListener('change', function(e) {
        const preview = document.getElementById('previewImage');
        preview.src = URL.createObjectURL(e.target.files[0]);
        preview.style.display = 'block';
    });

    // Preview gambar untuk dekripsi
    document.getElementById('stegoImageInput').addEventListener('change', function(e) {
        const preview = document.getElementById('previewStegoImage');
        preview.src = URL.createObjectURL(e.target.files[0]);
        preview.style.display = 'block';
    });

    // Handle Enkripsi Form
    document.getElementById('enkripsiForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const image = document.getElementById('imageInput').files[0];
        const pesan = document.getElementById('pesanInput').value;
        const key = parseInt(document.getElementById('keyInput').value);

        try {
            // Encrypt message using Caesar Cipher
            const ciphertext = caesarEncrypt(pesan, key);
            document.getElementById('ciphertextOutput').value = ciphertext;

            // Load image and apply steganography
            const img = new Image();
            img.onload = async function() {
                try {
                    // Terapkan steganografi dan dapatkan URL gambar hasil
                    const stegoImageUrl = await embedMessage(img, ciphertext);
                    
                    // Tampilkan gambar hasil
                    const stegoImage = document.getElementById('stegoImage');
                    stegoImage.src = stegoImageUrl;
                    stegoImage.style.display = 'block';

                    // Aktifkan link download
                    const downloadLink = document.getElementById('downloadLink');
                    downloadLink.href = stegoImageUrl;
                    downloadLink.download = 'stego_image.png';
                    downloadLink.style.display = 'block';

                    showNotification('success', 'Enkripsi dan steganografi berhasil!');
                } catch (error) {
                    showNotification('error', 'Gagal melakukan steganografi: ' + error.message);
                }
            };

            img.onerror = function() {
                showNotification('error', 'Gagal memuat gambar');
            };

            img.src = URL.createObjectURL(image);
        } catch (error) {
            showNotification('error', 'Gagal melakukan enkripsi: ' + error.message);
        }
    });

    // Event listener untuk input file stego image
    document.getElementById('stegoImageInput').addEventListener('change', function(e) {
        const preview = document.getElementById('previewStegoImage');
        if (e.target.files[0]) {
            preview.src = URL.createObjectURL(e.target.files[0]);
            preview.style.display = 'block';
            
            // Baca pesan dari gambar stego
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = function() {
                try {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const extractedMessage = decodeMessage(imageData);
                    
                    // Tampilkan notifikasi bahwa pesan berhasil diekstrak
                    showNotification('success', 'Pesan berhasil diekstrak dari gambar! Silakan masukkan ciphertext secara manual.');
                } catch (error) {
                    showNotification('error', 'Gagal mengekstrak pesan dari gambar: ' + error.message);
                }
            };

            img.onerror = function() {
                showNotification('error', 'Gagal memuat gambar');
            };

            img.src = URL.createObjectURL(e.target.files[0]);
        } else {
            preview.style.display = 'none';
        }
    });

    // Handle Dekripsi Form
    document.getElementById('dekripsiForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        try {
            const manualCiphertext = document.getElementById('ciphertextInput').value.trim();
            const key = parseInt(document.getElementById('keyDekripsi').value);

            // Validasi input
            if (!manualCiphertext) {
                throw new Error("Silakan masukkan ciphertext");
            }

            if (isNaN(key)) {
                throw new Error("Kunci harus berupa angka");
            }

            // Dekripsi pesan
            const decryptedMessage = caesarDecrypt(manualCiphertext, key);
            document.getElementById('pesanOutput').value = decryptedMessage;
            showNotification('success', 'Dekripsi berhasil!');

        } catch (error) {
            showNotification('error', error.message);
            document.getElementById('pesanOutput').value = '';
        }
    });

    // Fungsi untuk menampilkan notifikasi
    function showNotification(type, message) {
        const notifDiv = document.createElement('div');
        notifDiv.className = `notification ${type} fixed top-4 right-4 p-4 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`;
        notifDiv.textContent = message;
        document.body.appendChild(notifDiv);

        // Hilangkan notifikasi setelah 3 detik
        setTimeout(() => {
            notifDiv.remove();
        }, 3000);
    }
}); 