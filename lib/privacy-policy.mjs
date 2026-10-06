/*
 * BiteSite Privacy Policy text (CH decisions 2026-10-04): English and Bahasa Melayu, as PDPA 2010
 * section 7 requires both. Facts follow the code (Documents\Codex\2026-09-30\PRIVACY_FACTS_FOR_AI)
 * plus what was added since: Gmail sends sign-in emails, site error records, Book a Table, job posts.
 * Pure data, rendered by app/privacy/page.tsx and checked by scripts/test-privacy-policy.mjs.
 * Keep both languages saying the same thing; change PRIVACY_EFFECTIVE_DATE when the text changes.
 */

export const PRIVACY_CONTACT_EMAIL = "bitesite.my@gmail.com";
export const PRIVACY_EFFECTIVE_DATE = Object.freeze({ iso: "2026-10-06", en: "6 October 2026", ms: "6 Oktober 2026" });

const E = PRIVACY_CONTACT_EMAIL;

/** Each block is a paragraph (string), a list ({ list: string[] }) or label/text pairs ({ items: [label, text][] }). */
export const PRIVACY_POLICY = Object.freeze({
  en: {
    lang: "en",
    heading: "BiteSite Privacy Policy",
    effective: `Effective date: ${PRIVACY_EFFECTIVE_DATE.en}`,
    sections: [
      { title: "1. About this policy", blocks: [
        "BiteSite helps people in Malaysia and Singapore find restaurants, and helps restaurants show their menu and stories. This policy explains what information we use, why, who helps us process it, and how to contact us.",
        { items: [["Operator", "BiteSite (Malaysia)"], ["Privacy contact", E]] },
      ] },
      { title: "2. Restaurant owners (merchants)", blocks: [
        "When you register and manage a restaurant page, we use:",
        { items: [
          ["Email address and password", "To let you sign in, and to send you a confirmation email and password-reset emails. Your password is managed and protected by Supabase Auth; BiteSite cannot see it. Your sign-in email is not shown on your page unless you also enter it as the restaurant's contact email."],
          ["Restaurant details", "Name, address, area, map location, phone, WhatsApp, email, website and social links, payment methods, facilities, opening hours and temporary closures: to show your public restaurant page. Most of these are visible to everyone."],
          ["Photos and menu", "Cover photo, logo, dish photos, dish names, descriptions and prices: to show your restaurant and menu. Photos are made smaller on your phone or computer before upload."],
          ["Menu photos you send us", "When you ask BiteSite to type your menu for you, our team uses Google Gemini to read the text in the photos, checks the result by hand, then adds it to your menu. The photos are kept privately and deleted after use."],
          ["Stories", "Text, photos and your rights declaration: to review and publish approved Stories. If you tick \"Request optional AI drafting help\", our team may use Google Gemini to suggest a draft from your facts; nothing is published without review."],
          ["Feedback, area requests, change requests", "To answer you and handle your requests."],
          ["Terms acceptance", "Which version of the merchant terms you accepted, and when."],
          ["Job posts", "The job title, type, pay, working hours and description you post: shown publicly on BiteSite for 30 days unless you renew, close or delete it."],
          ["Messages from us", "We send review results and similar updates by WhatsApp to the number you give us and by email to your sign-in email, and sign-in emails to your sign-in email."],
        ] },
        "Required: an email and password to register. To submit a restaurant for review and publish it, we need its name, address, at least one of phone, WhatsApp or email, at least one cuisine and at least one dish. Without these the page cannot be published. Everything else is optional.",
      ] },
      { title: "3. Visitors", blocks: [
        { items: [
          ["Browsing statistics", "Pages viewed, buttons tapped (for example WhatsApp, call, directions, website), search words and number of results, the referring website, approximate country and city, and device type, system and browser. We use them to understand how BiteSite is used; restaurants see numbers for their own page only. The approximate location comes from Vercel's network information, not GPS. We do not store your IP address: we store a code made from it with a secret key (HMAC). We do not store your full browser identification string (user agent)."],
          ["Book a Table", "Your booking message opens in WhatsApp and goes from your WhatsApp to the restaurant. BiteSite does not receive the message; we only count that the button was tapped."],
          ["Applying for a job", "When you apply for a job posted on BiteSite, you contact the restaurant directly by WhatsApp or phone. BiteSite does not receive or keep your application; we only count that the button was tapped."],
          ["Problem reports and feedback", "The reason, your message, the page, and an email address only if you choose to give one: to handle the problem or improve BiteSite. We also store a keyed code made from your IP address (not the IP itself) to limit abuse."],
          ["Technical error records", "When something on BiteSite fails, we record a short error description and the page address so we can fix it. We remove email addresses, phone numbers and similar details from it, and do not record your IP address."],
        ] },
      ] },
      { title: "4. Nearby and your location", blocks: [
        "We ask your browser for your location only when you tap Nearby. Distances are calculated in your browser; your location is not sent to or stored by BiteSite. You can say no; Nearby then cannot sort by distance.",
      ] },
      { title: "5. Browser storage and cookies", blocks: [
        "BiteSite saves a few things in your browser's local storage: your chosen state and filters, the restaurants you save with the heart button (kept only on this device, never sent to BiteSite), a closed homepage pop-up, drafts you are editing, and whether you are signed in (merchant or Admin). BiteSite does not use advertising or tracking cookies, or analytics tools such as Google Analytics. Google Maps, shown on restaurant pages, may set its own cookies.",
      ] },
      { title: "6. Services that help run BiteSite", blocks: [
        { items: [
          ["Supabase", "Database, sign-in and photo storage. Its servers for BiteSite are in Singapore, so this information is transferred outside Malaysia."],
          ["Vercel", "Website hosting; provides the approximate country and city of visits."],
          ["Google (Gmail)", `Sends sign-up confirmation, password-reset and review-result emails from ${E}.`],
          ["Google Gemini", "Reads menu photos you send us, and may suggest Story drafts when you ask for AI help."],
          ["Google Maps and OpenStreetMap", "Maps on restaurant pages and on the Our Partner page."],
          ["WhatsApp (Meta)", "Messages between BiteSite and merchants, and Book a Table messages from visitors to restaurants."],
        ] },
        "These providers process information under their own terms and may keep their own technical logs. We do not sell your information or use it for advertising.",
      ] },
      { title: "7. How long we keep information", blocks: [
        { list: [
          "Detailed browsing records: deleted automatically after 90 days; only daily totals that do not identify anyone remain.",
          "Merchant account and restaurant information: kept while the account exists. Requests to delete an account or restaurant are handled within 30 days.",
          "Problem reports and feedback: kept for 12 months after they are handled, then deleted.",
          "Technical error records: deleted 30 days after the problem is marked fixed (if it does not happen again).",
          "Menu photos you send us: deleted after your menu is added.",
          "After an account or restaurant is deleted, only totals that do not identify anyone remain.",
        ] },
      ] },
      { title: "8. Your choices", blocks: [
        { list: [
          "Your email is optional on problem reports and feedback.",
          "You can decline location access for Nearby.",
          "You can clear BiteSite's data from your browser at any time in your browser settings (this resets your filters and signs you out).",
          "Merchants can change or remove most restaurant details themselves in the dashboard, or ask us to delete the restaurant or account.",
        ] },
      ] },
      { title: "9. Access, correction, deletion and questions", blocks: [
        `To see the information we hold about you, correct it, ask us to delete it, or ask a question or make a complaint about privacy, email ${E}. We may ask you to confirm that you own the account or restaurant, and we reply within 30 days.`,
      ] },
      { title: "10. People in Singapore", blocks: [
        "BiteSite also lists restaurants in Singapore. For the personal data of people in Singapore, we also follow Singapore's Personal Data Protection Act 2012 (PDPA).",
        `We use your information only for the purposes described in this policy. You may withdraw your consent at any time by emailing ${E}; we will tell you what that means for your account (for example, a restaurant page cannot stay published without contact details).`,
        "Requests to see or correct your information are answered within 30 days, as in section 9.",
        "If a data breach is likely to cause significant harm, we will notify Singapore's Personal Data Protection Commission and the people affected, as the PDPA requires.",
        { items: [["Data protection officer", E]] },
      ] },
      { title: "11. Children", blocks: [
        "BiteSite is not meant for people under 18. If we learn that we hold information about someone under 18 without a parent's or guardian's agreement, we will delete it.",
      ] },
      { title: "12. Changes to this policy", blocks: [
        "We publish any new version on this page with a new effective date. For important changes, we will also tell merchants by WhatsApp or email.",
      ] },
    ],
  },
  ms: {
    lang: "ms",
    heading: "Dasar Privasi BiteSite",
    effective: `Tarikh kuat kuasa: ${PRIVACY_EFFECTIVE_DATE.ms}`,
    sections: [
      { title: "1. Tentang dasar ini", blocks: [
        "BiteSite membantu orang di Malaysia dan Singapura mencari restoran, dan membantu restoran memaparkan menu dan cerita mereka. Dasar ini menerangkan maklumat yang kami gunakan, sebabnya, siapa yang membantu kami memprosesnya, dan cara menghubungi kami.",
        { items: [["Pengendali", "BiteSite (Malaysia)"], ["Hubungan privasi", E]] },
      ] },
      { title: "2. Pemilik restoran (peniaga)", blocks: [
        "Apabila anda mendaftar dan mengurus halaman restoran, kami menggunakan:",
        { items: [
          ["Alamat e-mel dan kata laluan", "Untuk membolehkan anda log masuk, dan untuk menghantar e-mel pengesahan dan e-mel tetapan semula kata laluan. Kata laluan anda diurus dan dilindungi oleh Supabase Auth; BiteSite tidak dapat melihatnya. E-mel log masuk anda tidak dipaparkan pada halaman anda kecuali anda juga memasukkannya sebagai e-mel hubungan restoran."],
          ["Butiran restoran", "Nama, alamat, kawasan, lokasi peta, telefon, WhatsApp, e-mel, pautan laman web dan media sosial, kaedah pembayaran, kemudahan, waktu operasi dan penutupan sementara: untuk memaparkan halaman awam restoran anda. Kebanyakannya boleh dilihat oleh semua orang."],
          ["Foto dan menu", "Foto muka depan, logo, foto hidangan, nama, penerangan dan harga hidangan: untuk memaparkan restoran dan menu anda. Foto dikecilkan pada telefon atau komputer anda sebelum dimuat naik."],
          ["Foto menu yang anda hantar kepada kami", "Apabila anda meminta BiteSite menaip menu anda, pasukan kami menggunakan Google Gemini untuk membaca teks dalam foto, menyemak hasilnya secara manual, kemudian memasukkannya ke dalam menu anda. Foto disimpan secara peribadi dan dipadam selepas digunakan."],
          ["Story", "Teks, foto dan pengisytiharan hak anda: untuk menyemak dan menerbitkan Story yang diluluskan. Jika anda menandakan \"Request optional AI drafting help\", pasukan kami mungkin menggunakan Google Gemini untuk mencadangkan draf daripada fakta anda; tiada apa yang diterbitkan tanpa semakan."],
          ["Maklum balas, permintaan kawasan, permintaan perubahan", "Untuk menjawab anda dan mengendalikan permintaan anda."],
          ["Penerimaan terma", "Versi terma peniaga yang anda terima, dan bila."],
          ["Iklan kerja", "Jawatan, jenis, gaji, waktu kerja dan penerangan yang anda siarkan: dipaparkan secara awam di BiteSite selama 30 hari melainkan anda memperbaharui, menutup atau memadamkannya."],
          ["Mesej daripada kami", "Kami menghantar keputusan semakan dan makluman seumpamanya melalui WhatsApp ke nombor yang anda berikan dan melalui e-mel ke e-mel log masuk anda, dan e-mel log masuk ke e-mel log masuk anda."],
        ] },
        "Wajib: e-mel dan kata laluan untuk mendaftar. Untuk menghantar restoran bagi semakan dan menerbitkannya, kami memerlukan nama, alamat, sekurang-kurangnya satu daripada telefon, WhatsApp atau e-mel, sekurang-kurangnya satu jenis masakan dan sekurang-kurangnya satu hidangan. Tanpa maklumat ini, halaman tidak boleh diterbitkan. Selain itu adalah pilihan.",
      ] },
      { title: "3. Pelawat", blocks: [
        { items: [
          ["Statistik penggunaan", "Halaman yang dilihat, butang yang ditekan (contohnya WhatsApp, panggilan, arah, laman web), perkataan carian dan bilangan hasil, laman web perujuk, anggaran negara dan bandar, serta jenis peranti, sistem dan pelayar. Kami menggunakannya untuk memahami penggunaan BiteSite; restoran hanya melihat angka bagi halaman mereka sendiri. Anggaran lokasi datang daripada maklumat rangkaian Vercel, bukan GPS. Kami tidak menyimpan alamat IP anda: kami menyimpan kod yang dibuat daripadanya dengan kunci rahsia (HMAC). Kami tidak menyimpan rentetan pengenalan pelayar penuh anda (user agent)."],
          ["Book a Table", "Mesej tempahan anda dibuka dalam WhatsApp dan dihantar daripada WhatsApp anda kepada restoran. BiteSite tidak menerima mesej itu; kami hanya mengira bahawa butang telah ditekan."],
          ["Memohon kerja", "Apabila anda memohon kerja yang disiarkan di BiteSite, anda menghubungi restoran terus melalui WhatsApp atau telefon. BiteSite tidak menerima atau menyimpan permohonan anda; kami hanya mengira bahawa butang telah ditekan."],
          ["Laporan masalah dan maklum balas", "Sebab, mesej anda, halaman berkenaan, dan alamat e-mel hanya jika anda memilih untuk memberikannya: untuk mengendalikan masalah atau menambah baik BiteSite. Kami juga menyimpan kod berkunci yang dibuat daripada alamat IP anda (bukan IP itu sendiri) untuk mengehadkan penyalahgunaan."],
          ["Rekod ralat teknikal", "Apabila sesuatu di BiteSite gagal, kami merekod penerangan ringkas ralat dan alamat halaman supaya kami dapat membaikinya. Kami membuang alamat e-mel, nombor telefon dan butiran seumpamanya daripadanya, dan tidak merekod alamat IP anda."],
        ] },
      ] },
      { title: "4. Nearby dan lokasi anda", blocks: [
        "Kami hanya meminta lokasi daripada pelayar anda apabila anda menekan Nearby. Jarak dikira dalam pelayar anda; lokasi anda tidak dihantar kepada atau disimpan oleh BiteSite. Anda boleh menolak; Nearby kemudian tidak dapat menyusun mengikut jarak.",
      ] },
      { title: "5. Storan pelayar dan kuki", blocks: [
        "BiteSite menyimpan beberapa perkara dalam storan setempat pelayar anda: negeri dan penapis yang anda pilih, restoran yang anda simpan dengan butang hati (disimpan pada peranti ini sahaja, tidak dihantar kepada BiteSite), pop-up halaman utama yang telah ditutup, draf yang sedang anda sunting, dan sama ada anda telah log masuk (peniaga atau Admin). BiteSite tidak menggunakan kuki pengiklanan atau penjejakan, atau alat analitik seperti Google Analytics. Google Maps, yang dipaparkan pada halaman restoran, mungkin menetapkan kukinya sendiri.",
      ] },
      { title: "6. Perkhidmatan yang membantu mengendalikan BiteSite", blocks: [
        { items: [
          ["Supabase", "Pangkalan data, log masuk dan storan foto. Pelayannya untuk BiteSite berada di Singapura, jadi maklumat ini dipindahkan ke luar Malaysia."],
          ["Vercel", "Pengehosan laman web; memberikan anggaran negara dan bandar lawatan."],
          ["Google (Gmail)", `Menghantar e-mel pengesahan pendaftaran, tetapan semula kata laluan dan keputusan semakan daripada ${E}.`],
          ["Google Gemini", "Membaca foto menu yang anda hantar kepada kami, dan mungkin mencadangkan draf Story apabila anda meminta bantuan AI."],
          ["Google Maps dan OpenStreetMap", "Peta pada halaman restoran dan halaman Our Partner."],
          ["WhatsApp (Meta)", "Mesej antara BiteSite dan peniaga, serta mesej Book a Table daripada pelawat kepada restoran."],
        ] },
        "Penyedia ini memproses maklumat di bawah terma mereka sendiri dan mungkin menyimpan log teknikal mereka sendiri. Kami tidak menjual maklumat anda atau menggunakannya untuk pengiklanan.",
      ] },
      { title: "7. Tempoh kami menyimpan maklumat", blocks: [
        { list: [
          "Rekod penggunaan terperinci: dipadam secara automatik selepas 90 hari; hanya jumlah harian yang tidak mengenal pasti sesiapa kekal.",
          "Akaun peniaga dan maklumat restoran: disimpan selagi akaun wujud. Permintaan untuk memadam akaun atau restoran dikendalikan dalam tempoh 30 hari.",
          "Laporan masalah dan maklum balas: disimpan selama 12 bulan selepas dikendalikan, kemudian dipadam.",
          "Rekod ralat teknikal: dipadam 30 hari selepas masalah ditandakan selesai (jika ia tidak berulang).",
          "Foto menu yang anda hantar kepada kami: dipadam selepas menu anda dimasukkan.",
          "Selepas akaun atau restoran dipadam, hanya jumlah yang tidak mengenal pasti sesiapa kekal.",
        ] },
      ] },
      { title: "8. Pilihan anda", blocks: [
        { list: [
          "E-mel anda adalah pilihan pada laporan masalah dan maklum balas.",
          "Anda boleh menolak akses lokasi untuk Nearby.",
          "Anda boleh mengosongkan data BiteSite daripada pelayar anda pada bila-bila masa dalam tetapan pelayar (ini menetapkan semula penapis anda dan log keluar).",
          "Peniaga boleh menukar atau membuang kebanyakan butiran restoran sendiri dalam papan pemuka, atau meminta kami memadam restoran atau akaun.",
        ] },
      ] },
      { title: "9. Akses, pembetulan, pemadaman dan pertanyaan", blocks: [
        `Untuk melihat maklumat yang kami simpan tentang anda, membetulkannya, meminta kami memadamnya, atau bertanya atau membuat aduan tentang privasi, e-mel ${E}. Kami mungkin meminta anda mengesahkan bahawa anda pemilik akaun atau restoran itu, dan kami akan membalas dalam tempoh 30 hari.`,
      ] },
      { title: "10. Orang di Singapura", blocks: [
        "BiteSite juga menyenaraikan restoran di Singapura. Bagi data peribadi orang di Singapura, kami juga mematuhi Akta Perlindungan Data Peribadi 2012 Singapura (PDPA).",
        `Kami menggunakan maklumat anda hanya untuk tujuan yang diterangkan dalam dasar ini. Anda boleh menarik balik persetujuan anda pada bila-bila masa dengan menghantar e-mel ke ${E}; kami akan menerangkan kesannya kepada akaun anda (contohnya, halaman restoran tidak boleh terus diterbitkan tanpa butiran hubungan).`,
        "Permintaan untuk melihat atau membetulkan maklumat anda dijawab dalam tempoh 30 hari, seperti dalam bahagian 9.",
        "Jika berlaku pelanggaran data yang mungkin menyebabkan kemudaratan ketara, kami akan memaklumkan Personal Data Protection Commission Singapura dan orang yang terjejas, seperti yang dikehendaki oleh PDPA.",
        { items: [["Pegawai perlindungan data", E]] },
      ] },
      { title: "11. Kanak-kanak", blocks: [
        "BiteSite tidak ditujukan kepada orang yang berumur bawah 18 tahun. Jika kami mendapati kami menyimpan maklumat tentang seseorang yang berumur bawah 18 tahun tanpa persetujuan ibu bapa atau penjaga, kami akan memadamnya.",
      ] },
      { title: "12. Perubahan pada dasar ini", blocks: [
        "Kami menerbitkan sebarang versi baharu di halaman ini dengan tarikh kuat kuasa baharu. Bagi perubahan penting, kami juga akan memaklumkan peniaga melalui WhatsApp atau e-mel.",
      ] },
    ],
  },
});
