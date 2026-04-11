# 🤖 BestApp — WhatsApp Bot Yönetim Paneli

**BestApp**, WhatsApp Web protokolü üzerinde çalışan, tarayıcı tabanlı gelişmiş bir yönetim panelidir.  
Grup yönetimi, zamanlanmış medya gönderimi, resim arşivi ve gerçek zamanlı bot izleme özelliklerini tek bir arayüzde sunar.

---

## 📋 İçindekiler

1. [Gereksinimler](#1-gereksinimler)
2. [Kurulum](#2-kurulum)
3. [İlk Çalıştırma ve WhatsApp Bağlantısı](#3-i̇lk-çalıştırma-ve-whatsapp-bağlantısı)
4. [Web Arayüzü — Giriş Paneli](#4-web-arayüzü--giriş-paneli)
5. [Dashboard — Ana Sayfa](#5-dashboard--ana-sayfa)
6. [Zamanlama Modülü](#6-zamanlama-modülü)
   - [Grup Seçimi](#61-grup-seçimi)
   - [Metin Mesajı](#62-metin-mesajı)
   - [Medya Gönderimi (Resim / Video)](#63-medya-gönderimi-resim--video)
   - [Arşiv + Üst Yazı (Overlay)](#64-arşiv--üst-yazı-overlay)
   - [Bekleyen Mesajlar](#65-bekleyen-mesajlar)
7. [Resim Arşivi](#7-resim-arşivi)
8. [Etkinlik Günlüğü](#8-etkinlik-günlüğü)
9. [Ayarlar](#9-ayarlar)
   - [Bot Ayarları](#91-bot-ayarları)
   - [Kullanıcı Adı Değiştir](#92-kullanıcı-adı-değiştir)
   - [Şifre Değiştir](#93-şifre-değiştir)
10. [WhatsApp Bot Komutları (Sohbet İçi)](#10-whatsapp-bot-komutları-sohbet-i̇çi)
11. [Proje Dosya Yapısı](#11-proje-dosya-yapısı)
12. [Ortam Değişkenleri (.env)](#12-ortam-değişkenleri-env)
13. [Sorun Giderme](#13-sorun-giderme)
14. [Güvenlik Notları](#14-güvenlik-notları)

---

## 1. Gereksinimler

| Gereksinim | Sürüm |
|---|---|
| Node.js | 18 veya üzeri (önerilir: 20 LTS) |
| npm | 8+ |
| Google Chrome veya Chromium | Sisteminizde kurulu olmalı |
| WhatsApp hesabı | Aktif bir numara |

> **Not:** Node.js 25 kullanıyorsanız `better-sqlite3` çalışmaz. Bu proje yerleşik `node:sqlite` modülünü kullandığı için herhangi bir ek derleme gerekmez.

---

## 2. Kurulum

```bash
# 1. Projeyi indirin veya klonlayın
cd /projenizin/dizini

# 2. Bağımlılıkları kurun
npm install

# 3. .env dosyasını düzenleyin (aşağıya bakın)
nano .env
```

### `.env` Dosyası

```env
BOT_PREFIX=!
BOT_NAME=BestApp Bot
OWNER_NUMBER=905XXXXXXXXX@c.us
SESSION_PATH=./.wwebjs_auth
PORT=3000
SESSION_SECRET=guclu-rastgele-bir-sifre-yazin
```

- **BOT_PREFIX** — Sohbet komutları için önek karakteri (varsayılan: `!`)
- **BOT_NAME** — Bot'un görünen adı
- **OWNER_NUMBER** — Sahip telefon numarası. `905321234567@c.us` formatında yazın (başında 0 olmadan, ülke kodu ile birlikte)
- **SESSION_SECRET** — Web oturumu için gizli anahtar. Mutlaka değiştirin!

---

## 3. İlk Çalıştırma ve WhatsApp Bağlantısı

```bash
npm start
```

veya geliştirme modunda (nodemon ile otomatik yeniden başlatma):

```bash
npm run dev
```

Sunucu başarıyla açıldığında terminalde şunu görürsünüz:

```
🌐 Web arayüzü: http://localhost:3000
🔑 Varsayılan giriş: admin / admin123
```

**WhatsApp'ı bağlamak için:**

1. Tarayıcıda `http://localhost:3000` adresine gidin
2. `admin` / `admin123` ile giriş yapın
3. Dashboard'da *"QR Bekleniyor"* durumunu göreceksiniz — QR kodu ekranda belirir
4. WhatsApp mobil uygulamasında:
   - **Android:** Sağ üst menü → *Bağlı Cihazlar* → *Cihaz Ekle*
   - **iPhone:** Ayarlar → *Bağlı Cihazlar* → *Cihaz Ekle*
5. Kamerayı QR koda tutun
6. Birkaç saniye sonra dashboard *"Bağlandı"* durumuna geçer

> **Önemli:** QR kodun süresi yaklaşık 60 saniyedir. Süre dolarsa otomatik yenilenecektir.  
> **Oturum kalıcıdır** — sunucuyu yeniden başlatmanızda tekrar QR taramanıza gerek yok.

---

## 4. Web Arayüzü — Giriş Paneli

`http://localhost:3000` adresine gittiğinizde giriş ekranı açılır.

| Alan | Varsayılan |
|---|---|
| Kullanıcı Adı | `admin` |
| Şifre | `admin123` |

> ⚠️ **İlk girişten sonra mutlaka şifrenizi değiştirin!** (Ayarlar → Şifre Değiştir)

---

## 5. Dashboard — Ana Sayfa

Bot bağlantısını ve genel istatistikleri gösteren merkez ekrandır.

### Durum Kartları

| Kart | Açıklama |
|---|---|
| **Bot Durumu** | Bağlı / Başlatılıyor / QR Bekleniyor / Bağlı Değil |
| **Toplam Grup** | Bot'un üye olduğu WhatsApp grup sayısı |
| **Bekleyen Zamanlama** | Henüz gönderilmemiş zamanlanmış mesaj sayısı |
| **Log Kaydı** | Veritabanındaki toplam log girişi sayısı |

### Bot Durumu Kartı

- **Başlatılıyor** — Bot Chrome başlatıp WhatsApp'a bağlanmaya çalışıyor
- **QR Bekleniyor** — QR kodu tarayın
- **Bağlandı** — Bağlı telefon numarası ve WhatsApp adı görünür
- **Bağlı Değil** — Bot bağlantısı kesildi, yeniden başlatın

---

## 6. Zamanlama Modülü

Sol menüden **Zamanlama** sekmesine girin. Bu modül üç adımdan oluşur:

### 6.1 Grup Seçimi

Sayfanın sol sütununda tüm gruplarınız listelenir.

- **Arama Kutusu** — Grup adına göre anlık filtreleme
- **Tümünü Seç** — Listedeki tüm grupları seçer
- **Temizle** — Seçimi sıfırlar
- Her gruba tek tek tıklayarak seçip kaldırabilirsiniz
- Sağ üstte **"X grup seçildi"** sayacı güncellenir

> Bot bağlı değilse grup listesi boş gelir — önce WhatsApp'ı bağlayın.

### 6.2 Metin Mesajı

**Metin** sekmesinde:

1. Mesaj kutusuna metninizi yazın
2. Tarih ve saati seçin (her zaman gelecekte bir zaman olmalı)
3. **Zamanla** butonuna basın

### 6.3 Medya Gönderimi (Resim / Video)

**Medya** sekmesinde:

1. Dosyayı yükleme alanına sürükleyin veya tıklayarak seçin
2. Desteklenen formatlar: **JPG, PNG, GIF, WebP** (resim) · **MP4, MOV, MKV** (video)
3. Maksimum boyut: **50 MB**
4. İsteğe bağlı açıklama metni (caption) girin
5. Tarih ve saati seçip **Zamanla** butonuna basın

### 6.4 Arşiv + Üst Yazı (Overlay)

Önceden yüklenmiş arşiv resimlerinin üzerine yazı eklenerek gönderilir. Sosyal medya paylaşımları, duyurular vb. için idealdir.

1. **Arşiv** sekmesini açın
2. Arşivdeki resimlerden birine tıklayın (seçili resim çerçevelenir)
3. **Üzerine Yazılacak Metin** kutusuna yazınızı girin
4. Özelleştirme seçenekleri:
   - **Yazı Rengi** — Renk seçici ile istediğiniz rengi seçin
   - **Yazı Boyutu** — Kaydırıcı ile 16–120px arası ayarlayın
   - **Konum** — Üst / Orta / Alt seçenekleri
5. **Önizleme canvas'ı** üzerinde sonucu canlı görün
6. Tarih ve saat seçip **Zamanla** butonuna basın

> **Not:** Yazı canvas üzerinde hesaplanır ve JPEG olarak sunucuya gönderilir; orijinal arşiv resmi değişmez.

### 6.5 Bekleyen Mesajlar

Sayfanın alt bölümünde zamanlanmış ama henüz gönderilmemiş tüm mesajlar tablo halinde görünür.

| Sütun | Açıklama |
|---|---|
| Gruplar | Kaç gruba gönderileceği |
| İçerik | Metin önizlemesi veya Resim/Video etiketi |
| Gönderilecek | Gönderim tarihi ve saati |
| İşlem | 🗑️ İptal butonu |

**Yenile** butonuyla tabloyu manuel güncelleyebilirsiniz.  
Sunucu yeniden başlatılsa bile bekleyen mesajlar veritabanından yüklenir.

---

## 7. Resim Arşivi

Sol menüden **Zamanlama** → sayfanın alt kısmında **Resim Arşivi** bölümü.

### Resim Yükleme

1. **+ Resim Ekle** butonuna tıklayın
2. JPG, PNG, GIF veya WebP seçin (maks. 10 MB)
3. Dosya arşive kaydedilir ve ızgara görünümünde gösterilir

### Resim Silme

Her resmin üzerindeki **✕** butonuna tıklayın → onay kutusunda **Evet** diyerek silin.

> Silinen resimler hem veritabanından hem de diskten kalıcı olarak silinir.

---

## 8. Etkinlik Günlüğü

Sol menüden **Günlük** sekmesi.

Bot'un tüm aktivitelerini zaman damgasıyla gösterir:

| Tip | İkon | Renk |
|---|---|---|
| `info` | ℹ️ | Mavi |
| `success` | ✅ | Yeşil |
| `warning` | ⚠️ | Sarı |
| `error` | ❌ | Kırmızı |
| `message` | 💬 | Mor |
| `sent` | 📤 | Cyan |

**Logları Temizle** butonuyla tüm kayıtları silebilirsiniz.

---

## 9. Ayarlar

Sol menüden **Ayarlar** sekmesi üç bölüm içerir.

### 9.1 Bot Ayarları

| Alan | Açıklama |
|---|---|
| **Bot Adı** | Komut yanıtlarında görünen ad |
| **Komut Prefixi** | Sohbet komutlarının başına gelecek karakter (varsayılan: `!`) |
| **Sahip Numarası** | Admin komutlarını çalıştırabilecek numara (`905XXXXXXXXX@c.us` formatı) |

**Kaydet** ile değişiklikler veritabanına yazılır. Bot ayarlarının tam olarak uygulanması için sunucuyu yeniden başlatmanız gerekebilir.

### 9.2 Kullanıcı Adı Değiştir

1. **Yeni Kullanıcı Adı** alanına istediğiniz adı yazın (harf, rakam, `_` kullanılabilir; en az 3 karakter)
2. **Mevcut Şifre** ile kimliğinizi doğrulayın
3. **Güncelle** butonuna basın
4. Bir sonraki girişte yeni kullanıcı adınızı kullanın

### 9.3 Şifre Değiştir

1. **Mevcut Şifre** alanını doldurun
2. **Yeni Şifre** alanına en az 6 karakterli yeni şifrenizi yazın
3. **Güncelle** butonuna basın

> Şifrenizi unutursanız terminalde aşağıdaki komutu çalıştırın:
> ```bash
> node -e "
> const db = require('./database/db');
> const bcrypt = require('bcryptjs');
> const hash = bcrypt.hashSync('yeni_sifre', 10);
> db.prepare('UPDATE users SET password_hash=? WHERE username=?').run(hash,'admin');
> console.log('Şifre sıfırlandı');
> "
> ```

---

## 10. WhatsApp Bot Komutları (Sohbet İçi)

Aşağıdaki komutlar WhatsApp sohbetlerine yazılarak kullanılır. Varsayılan prefix: `!`

### 👥 Grup Yönetimi

> Bu komutlar yalnızca gruplarda ve bot admin yetkisine sahipse çalışır.

| Komut | Açıklama |
|---|---|
| `!kick @kişi` | Kişiyi gruptan çıkarır |
| `!admin @kişi` | Kişiyi grup admini yapar |
| `!unadmin @kişi` | Kişinin admin yetkisini alır |
| `!grupbilgi` | Grubun adı, oluşturulma tarihi ve üye sayısını gösterir |
| `!uyeler` | Gruptaki tüm üyeleri listeler |
| `!acik` | Grubu herkese açık yapar (üyeler mesaj atabilir) |
| `!kapali` | Grubu yalnızca adminlere açık yapar |

### 🖼️ Medya

| Komut | Açıklama |
|---|---|
| `!sticker` | Bir resme yanıt vererek sticker (etiket) oluşturur |

### ⏰ Zamanlama (Sohbet İçinden)

| Komut | Açıklama |
|---|---|
| `!schedule <dakika> <mesaj>` | X dakika sonra mesaj gönderir |
| `!schedulelist` | Bekleyen zamanlanmış mesajları listeler |
| `!schedulecancel <id>` | Belirtilen ID'li zamanlamayı iptal eder |

**Örnek:**
```
!schedule 30 Toplantı hatırlatması: 30 dakika kaldı!
```

### ❓ Yardım

| Komut | Açıklama |
|---|---|
| `!yardim` veya `!help` veya `!komutlar` | Tüm komutların listesini gösterir |

---

## 11. Proje Dosya Yapısı

```
BestSapp/
├── server.js                 # Ana giriş noktası — Express + Socket.io
├── .env                      # Ortam değişkenleri (gizli tutun!)
├── package.json
│
├── bot/
│   └── client.js             # WhatsApp istemcisi, durum yönetimi
│
├── commands/
│   ├── group.js              # Grup yönetim komutları
│   ├── media.js              # Sticker ve medya komutları
│   └── scheduler.js          # Zamanlama motoru
│
├── database/
│   └── db.js                 # SQLite bağlantısı ve tablo oluşturma
│
├── data/
│   └── best.db               # SQLite veritabanı dosyası
│
├── routes/
│   ├── auth.js               # Giriş / çıkış / şifre değiştirme
│   └── api.js                # REST API (grup, zamanlama, arşiv, log)
│
├── utils/
│   └── helpers.js            # Yardımcı fonksiyonlar
│
├── public/
│   ├── index.html            # Giriş sayfası (Tailwind CDN)
│   ├── dashboard.html        # Ana dashboard (MD3 tasarım)
│   ├── css/
│   │   └── style.css         # Material Design 3 token sistemi
│   └── js/
│       ├── login.js          # (Kullanılmıyor — inline)
│       └── dashboard.js      # Dashboard JavaScript
│
├── media/
│   ├── archive/              # Arşiv resimleri (kalıcı)
│   └── uploads/              # Gönderim için geçici yüklemeler
│
└── .wwebjs_auth/             # WhatsApp oturum verisi (silmeyin!)
```

### Veritabanı Tabloları

| Tablo | İçerik |
|---|---|
| `users` | Yönetici hesapları (şifreler hash'lenmiş) |
| `scheduled_messages` | Zamanlanmış mesajlar ve gönderim durumu |
| `image_archive` | Arşiv resim kayıtları |
| `logs` | Bot aktivite günlüğü |
| `settings` | Bot ayarları (anahtar-değer) |

---

## 12. Ortam Değişkenleri (.env)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `BOT_PREFIX` | `!` | Sohbet komutları için önek |
| `BOT_NAME` | `BestApp Bot` | Bot görünen adı |
| `OWNER_NUMBER` | — | Sahip numarası (`905XXXXXXXXX@c.us`) |
| `SESSION_PATH` | `./.wwebjs_auth` | WhatsApp oturum klasörü |
| `PORT` | `3000` | Web sunucu portu |
| `SESSION_SECRET` | — | Express oturum şifrelemesi için gizli anahtar |

---

## 13. Sorun Giderme

### Bot "Başlatılıyor"da takılı kalıyor

Stale (eski) bir Chrome lock dosyası kalmış olabilir:

```bash
pkill -9 -f chrome
find .wwebjs_auth -name "Singleton*" -delete
node server.js
```

### Port 3000 kullanımda

```bash
lsof -ti:3000 | xargs kill -9
node server.js
```

### QR kodu çok hızlı geçiyor / gelmiyor

- Dashboard'u yeni sekmede açın
- Sunucu logunda QR ASCII görseli de çıkar — terminal üzerinden de tarayabilirsiniz

### Gruplar listesi boş geliyor

Grup listesi bot `hazır` olduktan **birkaç saniye sonra** yüklenir (arka planda `getChats()` çağrısı yapılır). Sayfayı tazeledikten sonra tekrar Zamanlama sekmesine girin.

### "Geçersiz chat ID" hatası

Chat ID formatı `XXXXXXXXXX@g.us` (grup) veya `905XXXXXXXXX@c.us` (kişi) şeklinde olmalıdır. Elle giriyorsanız bu formatı kullanın.

### Şifremi unuttum

```bash
node -e "
const db = require('./database/db');
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('yeni_sifre_123', 10);
db.prepare('UPDATE users SET password_hash=? WHERE username=?').run(hash,'admin');
console.log('Sıfırlandı');
"
```

### `node:sqlite` hatası

Node.js sürümünüzün **18.14+** veya üzeri olduğundan emin olun:

```bash
node --version
```

---

## 14. Güvenlik Notları

- `.env` dosyasını asla `git`'e commit etmeyin (`.gitignore`'da zaten mevcut)
- `SESSION_SECRET` değerini en az 32 karakterlik rastgele bir diziye ayarlayın
- Paneli internete açık bir sunucuya taşıyorsanız mutlaka HTTPS kullanın (nginx + certbot önerilir)
- Varsayılan `admin / admin123` şifresini ilk girişten sonra değiştirin
- `OWNER_NUMBER` değerini mutlaka kendinizin numarasına ayarlayın — yalnızca bu numara admin komutlarını çalıştırabilir
- `data/best.db` dosyasını düzenli olarak yedekleyin

---

## 📄 Lisans

Bu proje özel kullanım içindir.

---

*BestApp v1.0.0 — Node.js + whatsapp-web.js + Express + Socket.io + SQLite*
