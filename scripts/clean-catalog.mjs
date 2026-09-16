// Generates a data-only replacement for the explicitly synthetic Catera V1 project.
// Review and verify the SQL before applying. Never run against the historical pilot.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
export const project = "ygzfdqrljunngfrdygzt";
export const ids = {
  sellers: [
    "7d2d99a7-0683-4a67-a4e2-51f5b0fde8ff",
    "d1000000-0000-4000-8000-000000000002",
    "d1000000-0000-4000-8000-000000000003",
  ],
  owners: [
    "7bf157e2-84c2-4501-be09-2dc7b53c02e9",
    "d3000000-0000-4000-8000-000000000001",
    "d3000000-0000-4000-8000-000000000002",
  ],
  customer: "50acaece-8ab8-4a7e-a797-edb131325340",
  admin: "c5fbfc5c-da33-4b93-9075-6e961b43bedd",
};
const id = (g, n) => `c91600${g}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const str = (x) => `'${String(x).replaceAll("'", "''")}'`;
const json = (x) => `${str(JSON.stringify(x))}::jsonb`;
const food = (x) => `/assets/food/${x}.png`;
const wiki = (path) =>
  `https://thumb.wikimedia.org/wikipedia/commons/thumb/${path}/330px-${path.split("/").at(-1)}`;
// Existing Catera cover art plus photographs of the actual named dishes.
export const pictures = {
  rice: wiki("d/d6/Meshi_001.jpg"),
  chicken: food("ayam-panggang"),
  sambal: food("ayam-sambal"),
  fish: food("ikan-kuning"),
  salmon: food("salmon-teriyaki"),
  kecap: wiki("1/10/Ayam_Kecap_2.jpg"),
  pepes: wiki("2/2d/Pepes_ikan_emas_%28pais_lauk_mas%29_Sunda.jpg"),
  capcay: wiki("1/1c/Cap_cai.jpg"),
  kangkung: wiki("0/0f/Tumis_kangkung_Makassar.JPG"),
  lodeh: wiki("8/8f/Lodeh.jpg"),
  asem: wiki("5/58/Sayur_asem_vegetable_soup.jpg"),
  perkedel: wiki("b/b3/Perkedel_kentang_tanpa_daging.JPG"),
};
const dish = (key, name, categoryId, serving, description, image) => ({
  key,
  name,
  categoryId,
  serving,
  description,
  image,
});
const common = [
  dish(
    "nasi",
    "Nasi Putih",
    "rice",
    "180 g",
    "Nasi putih pulen, dimasak menjelang waktu pengantaran.",
    pictures.rice,
  ),
  dish(
    "capcay",
    "Capcay Kuah",
    "vegetable",
    "120 g",
    "Wortel, sawi, dan kembang kol dalam kuah bawang putih ringan.",
    pictures.capcay,
  ),
  dish(
    "kangkung",
    "Tumis Kangkung Bawang Putih",
    "vegetable",
    "100 g",
    "Kangkung ditumis sebentar dengan bawang putih; tanpa terasi.",
    pictures.kangkung,
  ),
  dish(
    "lodeh",
    "Sayur Lodeh",
    "vegetable",
    "150 ml",
    "Sayur campur dengan santan dan bumbu rumahan.",
    pictures.lodeh,
  ),
  dish(
    "asem",
    "Sayur Asem",
    "soup",
    "180 ml",
    "Kuah asam segar dengan jagung dan sayuran. Mengandung kacang tanah.",
    pictures.asem,
  ),
  dish(
    "perkedel",
    "Perkedel Kentang",
    "main",
    "2 buah / 80 g",
    "Kentang berbumbu digoreng dengan balutan telur.",
    pictures.perkedel,
  ),
];
const mains = [
  [
    dish(
      "ayam-panggang",
      "Ayam Panggang Bumbu Rempah",
      "main",
      "1 potong / 150 g",
      "Ayam dimarinasi kunyit, ketumbar, dan bawang, lalu dipanggang.",
      pictures.chicken,
    ),
    dish(
      "ayam-kecap",
      "Ayam Kecap",
      "main",
      "1 potong / 150 g",
      "Ayam dengan kecap manis dan bawang bombai. Mengandung kedelai.",
      pictures.kecap,
    ),
    dish(
      "ayam-sambal",
      "Ayam Sambal Merah",
      "main",
      "1 potong / 150 g",
      "Ayam berbumbu sambal merah; sambal dikemas terpisah.",
      pictures.sambal,
    ),
  ],
  [
    dish(
      "salmon",
      "Salmon Teriyaki",
      "main",
      "120 g",
      "Salmon panggang bersaus teriyaki. Mengandung ikan, kedelai, dan gandum.",
      pictures.salmon,
    ),
    dish(
      "ayam-panggang",
      "Ayam Panggang Rempah",
      "main",
      "150 g",
      "Ayam panggang dengan rempah dan sedikit minyak.",
      pictures.chicken,
    ),
    dish(
      "ikan-kuning",
      "Ikan Bumbu Kuning",
      "main",
      "130 g",
      "Ikan dimasak dengan kunyit, serai, dan daun jeruk. Mengandung ikan.",
      pictures.fish,
    ),
  ],
  [
    dish(
      "pepes",
      "Pepes Ikan Mas",
      "main",
      "1 potong / 150 g",
      "Ikan mas berbumbu dalam daun pisang; mengandung ikan dan duri.",
      pictures.pepes,
    ),
    dish(
      "ayam-kecap",
      "Ayam Kecap Sunda",
      "main",
      "1 potong / 150 g",
      "Ayam kecap manis gurih dengan bawang dan jahe. Mengandung kedelai.",
      pictures.kecap,
    ),
    dish(
      "ikan-kuning",
      "Ikan Kuah Kuning",
      "main",
      "1 potong / 150 g",
      "Ikan berkuah kunyit dan serai, tanpa santan. Mengandung ikan.",
      pictures.fish,
    ),
  ],
];
export const sellers = [
  {
    name: "Dapur Selaras",
    slug: "dapur-selaras",
    description:
      "Katering rumahan untuk hari kerja. Lauk dan sayur berganti setiap hari, dimasak menjelang pengantaran. Tersedia nasi box dan rantang siang-malam.",
    areas: ["Jakarta Selatan", "Jakarta Pusat"],
  },
  {
    name: "Hijau Kitchen",
    slug: "hijau-kitchen",
    description:
      "Makan siang praktis dengan ayam panggang, ikan, dan sayuran. Pilih paket menu dapur atau tentukan lauk sendiri setelah pemesanan.",
    areas: ["Jakarta Selatan", "Jakarta Barat"],
  },
  {
    name: "Dapur Sunda Rasa",
    slug: "dapur-sunda-rasa",
    description:
      "Masakan Sunda untuk makan sehari-hari: pepes, ayam kecap, sayur asem, dan lalapan. Diantar dalam jadwal tetap pada hari kerja.",
    areas: ["Bandung"],
  },
];
export const packages = [
  [
    0,
    "nasi-box-rumahan",
    "Nasi Box Rumahan — 5 Hari",
    32000,
    "lunch",
    "nasi_box",
    "caterer",
    food("ayam-panggang"),
    "Satu nasi, satu lauk, dan satu sayur setiap makan siang. Menu berganti pada lima hari pengantaran Senin–Jumat. Pengantaran termasuk.",
  ],
  [
    0,
    "rantang-keluarga",
    "Rantang Keluarga Siang & Malam",
    62000,
    "both",
    "ala_carte",
    "caterer",
    food("nasi-nusantara"),
    "Makan siang dan malam, masing-masing satu nasi, dua lauk, dan satu sayur per porsi. Harga harian mencakup kedua waktu makan; pilih jumlah porsi sesuai anggota keluarga.",
  ],
  [
    0,
    "nasi-box-pilih-lauk",
    "Nasi Box Kantor — Pilih Lauk",
    37000,
    "lunch",
    "nasi_box",
    "customer",
    food("ayam-sambal"),
    "Pilih satu nasi, satu lauk, dan satu sayur untuk tiap tanggal setelah pembayaran. Pilihan berlaku untuk seluruh porsi; semua lauk tersedia tanpa biaya tambahan.",
  ],
  [
    1,
    "daily-balance",
    "Daily Balance — 5 Makan Siang",
    42000,
    "lunch",
    "nasi_box",
    "caterer",
    food("ayam-panggang"),
    "Paket makan siang dengan satu nasi, satu lauk, dan satu sayur. Rotasi ayam panggang dan ikan disusun dapur untuk lima hari pengantaran.",
  ],
  [
    1,
    "salmon-lunch",
    "Salmon Lunch Box — 5 Hari",
    69000,
    "lunch",
    "nasi_box",
    "caterer",
    food("salmon-teriyaki"),
    "Salmon teriyaki 120 g, nasi putih, dan sayur berbeda setiap hari. Lima kali makan siang; mengandung ikan, kedelai, dan gandum.",
  ],
  [
    1,
    "pilih-menu-harian",
    "Pilih Menu Harian — Hijau Kitchen",
    49000,
    "lunch",
    "nasi_box",
    "customer",
    food("ikan-kuning"),
    "Susun sendiri satu nasi, satu lauk, dan satu sayur per tanggal pengantaran. Pilihan ayam, ikan kuning, atau salmon termasuk dalam harga paket.",
  ],
  [
    2,
    "sunda-harian",
    "Nasi Box Sunda Harian",
    33000,
    "lunch",
    "nasi_box",
    "caterer",
    food("ikan-kuning"),
    "Lima makan siang dengan nasi, lauk khas Sunda, dan sayur. Pepes ikan, ayam kecap, serta ikan kuah kuning bergantian dalam kalender menu.",
  ],
  [
    2,
    "rantang-sunda-malam",
    "Rantang Sunda Makan Malam",
    38000,
    "dinner",
    "ala_carte",
    "caterer",
    food("nasi-nusantara"),
    "Makan malam rumahan berisi satu nasi, satu lauk, satu sayur, dan sayur asem. Pengantaran pukul 17.00–19.00 pada lima hari kerja.",
  ],
  [
    2,
    "sunda-pilih-lauk",
    "Sunda Pilihan — Nasi Box",
    39000,
    "lunch",
    "nasi_box",
    "customer",
    food("ikan-kuning"),
    "Pilih lauk dan sayur kesukaan setelah pembayaran. Satu nasi, satu lauk, dan satu sayur per porsi; pilihan ditutup pukul 17.00 sehari sebelumnya.",
  ],
];
const categories = {
  rice: "Nasi",
  main: "Lauk",
  vegetable: "Sayur",
  soup: "Sup",
};
const anchor = process.argv.includes("--anchor")
  ? process.argv[process.argv.indexOf("--anchor") + 1]
  : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
      new Date(),
    );
if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) throw Error("Invalid anchor");
const day = (offset) => {
  const d = new Date(`${anchor}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const weekdays = (start, count) => {
  const dates = [];
  for (let i = start; dates.length < count; i++) {
    const dt = day(i);
    if (![0, 6].includes(new Date(dt).getUTCDay())) dates.push(dt);
  }
  return dates;
};
export function generate({ orders = true } = {}) {
  const sql = [];
  const add = (s) => sql.push(s);
  const tables = [
    "addresses",
    "allocations",
    "capacity",
    "checkouts",
    "content_revisions",
    "conversations",
    "customer_claims",
    "customer_menus",
    "customer_records",
    "delivery_days",
    "dishes",
    "fulfillments",
    "imports",
    "invites",
    "menus",
    "messages",
    "notifications",
    "outbox",
    "package_dish_versions",
    "package_dishes",
    "package_duration_revisions",
    "packages",
    "payment_events",
    "payments",
    "payout_events",
    "payout_items",
    "payouts",
    "pilot_enrollments",
    "pilot_followups",
    "pilot_invoice_entries",
    "pilot_invoices",
    "pilot_observations",
    "pilot_pricing",
    "production",
    "promotions",
    "push_tickets",
    "receipts",
    "refunds",
    "relationships",
    "reservations",
    "reviews",
    "settlement_day_allocations",
    "settlement_entries",
    "settlement_payout_items",
    "settlement_runs",
    "subscriptions",
    "support_cases",
  ];
  add(`begin; set local lock_timeout='5s'; set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtextextended('catera-v1-clean-catalog',0));
do $$ begin
 if not exists(select 1 from v1.policies where id and synthetic and approved) then raise exception 'SYNTHETIC_ONLY';end if;
 if (select count(*) from v1.caterers)<>3 or exists(select 1 from v1.caterers where id not in(${ids.sellers.map(str)})) then raise exception 'UNEXPECTED_TENANTS';end if;
 if exists(select 1 from v1.pilot_enrollments) or exists(select 1 from v1.pilot_pricing) then raise exception 'PILOT_DATA_REFUSED';end if;
 if exists(select 1 from v1.payments where provider_id is not null and provider_id !~ '^(demo|mock)') then raise exception 'REAL_PAYMENT_REFUSED';end if;
 if (select count(*) from v1.profiles where id in(${[ids.customer, ids.admin, ...ids.owners].map(str)}))<>5 then raise exception 'EXPECTED_IDENTITIES_MISSING';end if;
end $$;
-- Explicit graph, no CASCADE. Auth, login profiles, staff, configuration, audit and Storage remain intact.
truncate table ${tables.map((t) => "v1." + t).join(",")},public.catera_v1_events;
delete from v1.dish_categories where caterer_id is not null;
delete from v1.profiles p where role='customer' and not exists(select 1 from auth.users u where u.id=p.id);
select set_config('catera.demo','true',true);`);
  add(
    `update v1.profiles set name=case id when ${str(ids.customer)} then 'Nadia Putri' when ${str(ids.owners[0])} then 'Rizky Pratama' when ${str(ids.admin)} then 'Admin Catera' else 'Dewi Anggraini' end where name like 'Demo %' and id in(${[ids.customer, ids.owners[0], ids.admin, "e5dc6d99-9c6a-4dc0-9684-fc66f4500612"].map(str)});`,
  );
  sellers.forEach((s, i) =>
    add(
      `update v1.caterers set name=${str(s.name)},slug=${str(s.slug)},description=${str(s.description)},areas=array[${s.areas.map(str)}],status='approved',cutoff='17:00',timezone='Asia/Jakarta',version=version+1,review_note='Katalog percontohan Catera; data sintetis, bukan mitra terdaftar.' where id=${str(ids.sellers[i])};`,
    ),
  );
  const libraries = [];
  sellers.forEach((s, i) => {
    const library = [...common, ...mains[i]].map((d, n) => ({
      ...d,
      id: id("01", i * 100 + n + 1),
    }));
    libraries.push(library);
    library.forEach(({ key, id: did, ...details }) =>
      add(
        `insert into v1.dishes(id,caterer_id,details) values(${str(did)},${str(ids.sellers[i])},${json(details)});`,
      ),
    );
  });
  const offers = [];
  packages.forEach(
    (
      [seller, slug, name, price, meal, packageType, mode, image, description],
      n,
    ) => {
      const cats = [
        ["rice", 1],
        ["main", n === 1 ? 2 : 1],
        ["vegetable", 1],
        ...(n === 7 ? [["soup", 1]] : []),
      ];
      const composition = cats.map(([categoryId, slots]) => ({
        id: categoryId,
        categoryId,
        name: categories[categoryId],
        slots,
      }));
      const meals = meal === "both" ? ["lunch", "dinner"] : [meal];
      const offer = {
        name,
        description,
        price,
        days: 5,
        meal,
        packageType,
        menuSelectionMode: mode,
        image,
        tags: [
          seller === 2 ? "Sunda" : "Rumahan",
          meal === "both"
            ? "Siang & malam"
            : meal === "dinner"
              ? "Makan malam"
              : "Makan siang",
        ],
        weekdays: [1, 2, 3, 4, 5],
        capacity: { 0: 0, 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 0 },
        windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
        flexible: true,
        trialPrice: price + 3000,
        trialMax: 2,
        tiers: [
          { min: 3, percent: 5 },
          { min: 5, percent: 8 },
        ],
        status: "published",
        nutrition: null,
        contentRevision: 1,
        menus: meals.map((m) => ({
          meal: m,
          contentModel: "slots",
          name: "",
          description: "",
          image: "",
          items: [],
          nutrition: null,
          composition,
        })),
      };
      offers.push(offer);
      const pid = id("02", n + 1);
      add(`insert into v1.packages(id,caterer_id,slug,offer,status) values(${str(pid)},${str(ids.sellers[seller])},${str(slug)},${json(offer)},'published');
insert into v1.content_revisions(package_id,revision,contents) values(${str(pid)},1,v1.contents_template(${json(offer)}));
insert into v1.package_duration_revisions(package_id,revision,options,created_by) values(${str(pid)},1,'[{"cycles":1,"discountPercent":0},{"cycles":2,"discountPercent":3},{"cycles":4,"discountPercent":5}]',${str(ids.owners[seller])});`);
      if (mode === "customer") {
        libraries[seller]
          .filter((d) => cats.some(([c]) => c === d.categoryId))
          .forEach((d) =>
            add(
              `select v1.choice_option_save(${str(pid)},jsonb_build_object('sourceDishId',${str(d.id)}));`,
            ),
          );
      } else {
        weekdays(-14, 35).forEach((date, k) =>
          meals.forEach((m, mi) => {
            const items = composition.flatMap((g) => {
              let pool = libraries[seller].filter(
                (d) => d.categoryId === g.categoryId,
              );
              if (g.categoryId === "main")
                pool =
                  n === 4
                    ? pool.filter((d) => d.key === "salmon")
                    : pool.filter((d) => d.key !== "perkedel");
              return Array.from({ length: g.slots }, (_, j) => {
                const chosen =
                  g.categoryId === "main" && j === 1
                    ? libraries[seller].find((d) => d.key === "perkedel")
                    : pool[(k + mi + j) % pool.length];
                const { key, id: did, ...details } = chosen;
                return {
                  ...details,
                  id: `${g.id}:${j}`,
                  groupId: g.id,
                  sourceDishId: did,
                  sourceDishVersion: 1,
                  sourceServing: details.serving,
                };
              });
            });
            const details = {
              ...offer.menus[mi],
              name: items.map((d) => d.name).join(" · "),
              image: items.find((d) => d.categoryId === "main").image,
              items,
            };
            add(
              `insert into v1.menus(package_id,content_revision,service_date,meal,details) values(${str(pid)},1,${str(date)},${str(m)},${json(details)});`,
            );
          }),
        );
      }
    },
  );
  const names = [
    "Ayu Lestari",
    "Bima Prakoso",
    "Citra Maharani",
    "Dimas Saputra",
    "Eka Wulandari",
    "Farhan Nugraha",
    "Gita Puspita",
    "Hendra Wijaya",
    "Intan Permata",
    "Joko Prasetyo",
    "Kartika Sari",
    "Lukman Hakim",
  ];
  if (orders) {
    names.forEach((name, n) =>
      add(
        `insert into v1.profiles(id,name,role) values(${str(id("03", n + 1))},${str(name)},'customer');`,
      ),
    );
    const userIds = [ids.customer, ...names.map((_, n) => id("03", n + 1))];
    userIds.forEach((uid, n) => {
      const area = n >= 9 ? "Bandung" : "Jakarta Selatan";
      const street = area === "Bandung" ? "Jl. Sukajadi" : "Jl. Wijaya";
      add(
        `insert into v1.addresses(id,user_id,label,line,area,city,instructions) values(${str(id("04", n + 1))},${str(uid)},'Rumah',${str(street + " No. " + (12 + n * 3))},${str(area)},${str(area === "Bandung" ? "Bandung" : "Jakarta")},'Titip kepada penerima di teras; hubungi melalui pesan saat tiba.');`,
      );
    });
    // One coherent term per customer; the signed-in customer also has a completed earlier term.
    const plans = [
      { u: 0, p: 1, start: -2, qty: 2 },
      { u: 0, p: 0, start: -14, qty: 1 },
      ...names.map((_, i) => ({
        u: i + 1,
        p: Math.floor(i / 4) * 3 + (i % 3),
        start: i % 4 === 0 ? -7 : i % 4 === 1 ? -2 : 2,
        qty: i % 4 === 2 ? 3 : 1,
      })),
    ];
    plans.forEach((plan, n) => {
      const { u, p, start, qty } = plan;
      const trial = n === 13;
      const dates = weekdays(start, trial ? 1 : 5);
      const offer = offers[p];
      const seller = packages[p][0];
      // Bandung customers are associated only with the Bandung seller.
      const uid = userIds[u],
        cid = id("05", n + 1),
        sid = id("06", n + 1),
        aid = id("07", n + 1),
        adid = id("04", u + 1);
      const invited = u % 3 === 0,
        rate = invited ? 3 : 8;
      const subtotal =
        (trial ? offer.trialPrice : offer.price * dates.length) * qty;
      const discountPercent = trial ? 0 : qty >= 5 ? 8 : qty >= 3 ? 5 : 0;
      const discount = Math.round((subtotal * discountPercent) / 100),
        net = subtotal - discount,
        sellerFee = Math.round((net * rate) / 100),
        sellerNet = net - sellerFee;
      const complete = dates.at(-1) < anchor;
      add(`insert into v1.relationships(user_id,caterer_id,source) values(${str(uid)},${str(ids.sellers[seller])},${str(invited ? "invited" : "marketplace")}) on conflict do nothing;
${invited ? `insert into v1.invites(caterer_id,code,role,used_by) values(${str(ids.sellers[seller])},${str("MITRA-" + seller + "-" + u)},'customer',${str(uid)}) on conflict do nothing;` : ""}
insert into v1.customer_records(caterer_id,user_id,name,address,origin) select ${str(ids.sellers[seller])},p.id,p.name,to_jsonb(a)-'user_id','marketplace' from v1.profiles p join v1.addresses a on a.user_id=p.id where p.id=${str(uid)} on conflict do nothing;
insert into v1.checkouts(id,user_id,package_id,address_id,quote,state,expires_at,provider_id,created_at)
select ${str(cid)},${str(uid)},p.id,a.id,jsonb_build_object('pricingVersion',2,'currency','IDR','packageId',p.id,'portions',${qty},'trial',${trial},'cycles',1,'daysPerCycle',5,'deliveryDays',${dates.length},'dates',${json(dates)},'bookingThrough',(${str(dates[0])}::date+366),'bookingPolicyVersion',1,'durationPricing',v1.duration_pricing(p.id),'durationOption','{"cycles":1,"discountPercent":0}'::jsonb,'subtotal',${subtotal},'discount',${discount},'discountPercent',${discountPercent},'durationDiscount',0,'durationDiscountPercent',0,'packageNet',${net},'promotion',0,'promotionSnapshot',null,'serviceFee',2500,'total',${net + 2500},'sellerFee',${sellerFee},'sellerFeePercent',${rate},'sellerNet',${sellerNet},'perDay',${Math.round(net / qty / dates.length)},'source',${str(invited ? "invited" : "marketplace")},'offer',v1.offer(p),'address',to_jsonb(a)-'user_id','pricingPolicy','{"approved":true,"synthetic":true,"serviceFee":2500,"marketplacePercent":8,"invitedPercent":3}'::jsonb,'settlementModel','delivery_earned_v1','settlementRounding','original_schedule_first_remainder','renewedFrom',null),
'paid',(${str(dates[0])}::date-2)+time '09:15','demo-clean-${n + 1}',(${str(dates[0])}::date-2)+time '09:00'
from v1.packages p,v1.addresses a where p.id=${str(id("02", p + 1))} and a.id=${str(adid)};
insert into v1.subscriptions(id,checkout_id,user_id,package_id,snapshot,portions,starts_on,ends_on,status) select ${str(sid)},id,user_id,package_id,quote,${qty},${str(dates[0])},${str(dates.at(-1))},${str(complete ? "completed" : "active")} from v1.checkouts where id=${str(cid)};
update v1.checkouts set subscription_id=${str(sid)} where id=${str(cid)};
insert into v1.payments(checkout_id,provider_id,amount,state,created_at) values(${str(cid)},'demo-clean-payment-${n + 1}',${net + 2500},'paid',(${str(dates[0])}::date-2)+time '09:03');
insert into v1.allocations(id,checkout_id,caterer_id,amount) values(${str(aid)},${str(cid)},${str(ids.sellers[seller])},${sellerNet});`);
      dates.forEach((dt, j) => {
        const did = id("08", n * 100 + j + 1);
        const earned =
          Math.floor(sellerNet / dates.length) +
          (j < sellerNet % dates.length ? 1 : 0);
        const state =
          dt < anchor ? "delivered" : dt === anchor ? "preparing" : "scheduled";
        add(`insert into v1.reservations values(${str(cid)},${str(id("02", p + 1))},${str(dt)},${qty},'confirmed');
insert into v1.delivery_days(id,subscription_id,service_date,address) select ${str(did)},${str(sid)},${str(dt)},to_jsonb(a)-'user_id' from v1.addresses a where id=${str(adid)};
${offer.menus.map((m) => `insert into v1.fulfillments(day_id,meal,status) values(${str(did)},${str(m.meal)},${str(state)});`).join("\n")}
insert into v1.settlement_day_allocations values(${str(did)},${str(aid)},${j + 1},${earned});
update v1.delivery_days set status=${str(state)} where id=${str(did)};`);
        if (
          offer.menuSelectionMode === "customer" &&
          dt > day(1) &&
          j % 2 === 0
        )
          add(
            `select v1.customer_menu_save(${str(uid)},jsonb_build_object('subscriptionId',${str(sid)},'meal','lunch','days',jsonb_build_array(jsonb_build_object('id',${str(did)},'date',${str(dt)},'deliveryVersion',1,'version',0)),'choices',(select jsonb_agg(jsonb_build_object('slotId',g->>'id'||':0','optionId',opt.id,'optionVersion',opt.version)) from jsonb_array_elements(${json(offer.menus[0].composition)}) g cross join lateral (select id,version from v1.package_dishes where package_id=${str(id("02", p + 1))} and details->>'categoryId'=g->>'categoryId' order by id limit 1) opt)),false);`,
          );
      });
      if (complete && offer.menuSelectionMode !== "customer")
        add(
          `insert into v1.reviews(subscription_id,user_id,package_id,rating,food,delivery,value,body,created_at) values(${str(sid)},${str(uid)},${str(id("02", p + 1))},5,5,5,4,'Porsi sesuai, sayurnya berganti setiap hari. Pengantaran tiba dalam jadwal yang dijanjikan.',${str(dates.at(-1))}::date+time '19:30');`,
        );
    });
    add(
      `insert into v1.support_cases(user_id,caterer_id,delivery_id,subscription_id,checkout_id,subject,description,status) select s.user_id,p.caterer_id,d.id,s.id,s.checkout_id,'Petunjuk titik antar','Pagar depan sedang diperbaiki. Mohon antar melalui pintu samping.','open' from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where d.service_date>=${str(anchor)} and p.caterer_id=${str(ids.sellers[0])} order by d.service_date,d.id limit 1;`,
    );
  }
  add(`do $$ declare pkg v1.packages; begin
 for pkg in select * from v1.packages loop
  if not v1.valid_offer(v1.offer(pkg)) then raise exception 'INVALID_OFFER %',pkg.slug;end if;
  perform v1.check_slot_categories(pkg.caterer_id,pkg.offer->'menus');perform v1.check_package_options(pkg.id,pkg.offer);
 end loop;
 if exists(select 1 from v1.menus where not v1.valid_slot_menu(details,true,false)) then raise exception 'INVALID_MENU';end if;
 if exists(select 1 from v1.checkouts c join v1.packages p on p.id=c.package_id join v1.caterers k on k.id=p.caterer_id join v1.addresses a on a.id=c.address_id where not a.area=any(k.areas)) then raise exception 'COVERAGE';end if;
 if exists(select 1 from v1.allocations a where a.amount<>(select sum(amount) from v1.settlement_day_allocations where allocation_id=a.id)) then raise exception 'SETTLEMENT_TOTAL';end if;
 if exists(select 1 from v1.reservations r join v1.packages p on p.id=r.package_id group by p.id,r.service_date having sum(r.portions)>(p.offer->'capacity'->>(extract(dow from r.service_date)::int)::text)::int) then raise exception 'CAPACITY';end if;
 if exists(select 1 from v1.outbox where processed_at is null and kind in('payment.create','payout.create','refund.create')) then raise exception 'EXTERNAL_JOB';end if;
end $$;
insert into v1.audit(actor_id,action,details) values(${str(ids.admin)},'demo.catalog.replace',jsonb_build_object('version','2026.09.16.1','synthetic',true,'anchor',${str(anchor)},'orders',${orders},'packages',(select count(*) from v1.packages),'dishes',(select count(*) from v1.dishes),'menus',(select count(*) from v1.menus),'subscriptions',(select count(*) from v1.subscriptions),'backup','before-clean-catalog-20260916.json'));
commit;`);
  return sql.join("\n\n") + "\n";
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) ===
    resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))
) {
  const output = resolve(".data/backups/clean-catalog-20260916.sql");
  await mkdir(resolve(".data/backups"), { recursive: true });
  await writeFile(
    output,
    generate({ orders: !process.argv.includes("--catalog-only") }),
  );
  console.log(output);
}
