import { addDays, localDay } from "@catera/domain";
export const DEMO_ACTORS = {
  customer: "00000000-0000-4000-8000-000000000001",
  owner: "00000000-0000-4000-8000-000000000002",
  staff: "00000000-0000-4000-8000-000000000003",
  platform_admin: "00000000-0000-4000-8000-000000000004",
} as const;
export const CATERER_IDS = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];
export const PACKAGE_IDS = Array.from(
  { length: 6 },
  (_, i) => "20000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
);
export const ADDRESS_ID = "30000000-0000-4000-8000-000000000001";
export const localBootstrap = `create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`;
const q = (v: unknown) =>
  "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";

type DemoDish = {
  id: string;
  name: string;
  description: string;
  image: string;
  serving: string;
  groupId?: string;
};

type DemoMenu = {
  meal: "lunch" | "dinner";
  name: string;
  description: string;
  image: string;
  items: DemoDish[];
  composition?: { id: string; name: string; slots: number }[];
  nutrition: {
    caloriesKcal?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
  } | null;
};

type DemoOffer = {
  name: string;
  description: string;
  price: number;
  days: number;
  meal: "lunch" | "dinner" | "both";
  weekdays: number[];
  flexible: boolean;
  image: string;
  tags: string[];
  trialPrice: number | null;
  trialMax: number | null;
  tiers: { min: number; percent: number }[];
  capacity: Record<string, number>;
  windows: { lunch: string; dinner: string };
  packageType: "ala_carte" | "nasi_box";
  menus: DemoMenu[];
};

const dish = (
  id: string,
  name: string,
  serving: string,
  description: string,
  groupId?: string,
): DemoDish => ({
  id,
  name,
  serving,
  description,
  image: "",
  ...(groupId ? { groupId } : {}),
});

const boxMenu = (
  meal: "lunch" | "dinner",
  name: string,
  image: string,
  items: DemoDish[],
  nutrition: DemoMenu["nutrition"],
): DemoMenu => ({
  meal,
  name,
  description: "Satu porsi lengkap. Menu dapat berganti sesuai tanggal pengantaran.",
  image,
  composition: [
    { id: "nasi", name: "Nasi", slots: 1 },
    { id: "lauk", name: "Lauk", slots: 1 },
    { id: "sayur", name: "Sayur", slots: 1 },
    { id: "pelengkap", name: "Pelengkap", slots: 1 },
  ],
  items,
  nutrition,
});

const alaCarteMenu = (
  meal: "lunch" | "dinner",
  name: string,
  image: string,
  items: DemoDish[],
  nutrition: DemoMenu["nutrition"],
): DemoMenu => ({
  meal,
  name,
  description: "Daftar hidangan yang termasuk dalam satu porsi paket.",
  image,
  items,
  nutrition,
});

/**
 * Customer-facing local demo offers. These deliberately exercise the real
 * package model: a package is purchased for a schedule, each menu is scoped
 * to a meal, and each menu contains the dishes or component slots delivered.
 */
const DEMO_OFFERS: DemoOffer[] = [
  {
    name: "Ayam Panggang Harian",
    description:
      "Paket makan siang 5 hari dengan ayam panggang, nasi, sayur, dan pelengkap rumahan yang berganti mengikuti jadwal.",
    price: 35000,
    days: 5,
    meal: "lunch",
    weekdays: [1, 2, 3, 4, 5],
    flexible: true,
    image: "/assets/food/ayam-panggang.png",
    tags: ["Rumahan", "Makan siang"],
    trialPrice: 39000,
    trialMax: null,
    tiers: [
      { min: 3, percent: 5 },
      { min: 5, percent: 10 },
    ],
    capacity: { "0": 0, "1": 100, "2": 100, "3": 100, "4": 100, "5": 100, "6": 0 },
    windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
    packageType: "nasi_box",
    menus: [
      boxMenu(
        "lunch",
        "Nasi box ayam panggang",
        "/assets/food/ayam-panggang.png",
        [
          dish("nasi", "Nasi putih", "180 g", "Nasi pulen sebagai sumber karbohidrat.", "nasi"),
          dish("lauk", "Ayam panggang bumbu rempah", "150 g", "Ayam panggang berbumbu dengan rasa gurih dan hangat.", "lauk"),
          dish("sayur", "Tumis buncis wortel", "100 g", "Sayuran tumis sederhana yang dimasak setiap pagi.", "sayur"),
          dish("pelengkap", "Sambal dan lalapan", "30 g", "Sambal rumahan dan lalapan segar.", "pelengkap"),
        ],
        { caloriesKcal: 620, proteinG: 32, carbsG: 78, fatG: 20 },
      ),
    ],
  },
  {
    name: "Salmon Teriyaki",
    description:
      "Paket makan malam 5 hari dengan salmon teriyaki dan pelengkap sederhana untuk porsi malam yang praktis.",
    price: 59000,
    days: 5,
    meal: "dinner",
    weekdays: [1, 2, 3, 4, 5],
    flexible: true,
    image: "/assets/food/salmon-teriyaki.png",
    tags: ["Makan malam", "Ikan"],
    trialPrice: 65000,
    trialMax: null,
    tiers: [
      { min: 3, percent: 5 },
      { min: 5, percent: 10 },
    ],
    capacity: { "0": 0, "1": 100, "2": 100, "3": 100, "4": 100, "5": 100, "6": 0 },
    windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
    packageType: "ala_carte",
    menus: [
      alaCarteMenu(
        "dinner",
        "Salmon teriyaki dan pelengkap",
        "/assets/food/salmon-teriyaki.png",
        [
          dish("salmon", "Salmon teriyaki", "120 g", "Fillet salmon dengan saus teriyaki ringan."),
          dish("nasi", "Nasi putih", "180 g", "Nasi pulen yang disajikan hangat."),
          dish("sayur", "Brokoli kukus", "100 g", "Brokoli kukus dengan wortel."),
        ],
        { caloriesKcal: 580, proteinG: 34, fatG: 22 },
      ),
    ],
  },
  {
    name: "Rantang Nusantara",
    description:
      "Paket siang dan malam selama 10 hari kerja dengan menu Nusantara yang berbeda untuk setiap waktu makan.",
    price: 65000,
    days: 10,
    meal: "both",
    weekdays: [1, 2, 3, 4, 5],
    flexible: true,
    image: "/assets/food/nasi-nusantara.png",
    tags: ["Siang & malam", "Menu Nusantara"],
    trialPrice: 69000,
    trialMax: null,
    tiers: [
      { min: 3, percent: 5 },
      { min: 5, percent: 10 },
    ],
    capacity: { "0": 0, "1": 100, "2": 100, "3": 100, "4": 100, "5": 100, "6": 0 },
    windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
    packageType: "nasi_box",
    menus: [
      boxMenu(
        "lunch",
        "Rantang Nusantara siang",
        "/assets/food/nasi-nusantara.png",
        [
          dish("nasi", "Nasi putih", "180 g", "Nasi pulen sebagai dasar menu siang.", "nasi"),
          dish("lauk", "Ayam bumbu rujak", "150 g", "Ayam berbumbu rempah dengan rasa gurih pedas ringan.", "lauk"),
          dish("sayur", "Sayur asem", "150 ml", "Sayur asem dengan jagung dan kacang panjang.", "sayur"),
          dish("pelengkap", "Sambal dan kerupuk", "30 g", "Pelengkap untuk menyesuaikan selera.", "pelengkap"),
        ],
        { caloriesKcal: 640, proteinG: 30, carbsG: 82, fatG: 19 },
      ),
      boxMenu(
        "dinner",
        "Rantang Nusantara malam",
        "/assets/food/ikan-kuning.png",
        [
          dish("nasi", "Nasi putih", "180 g", "Nasi pulen sebagai dasar menu malam.", "nasi"),
          dish("lauk", "Ikan kembung balado", "140 g", "Ikan kembung dengan sambal balado rumahan.", "lauk"),
          dish("sayur", "Tumis kangkung", "100 g", "Kangkung tumis bawang putih.", "sayur"),
          dish("pelengkap", "Acar timun", "50 g", "Acar timun dan wortel yang segar.", "pelengkap"),
        ],
        { caloriesKcal: 610, proteinG: 29, carbsG: 76, fatG: 21 },
      ),
    ],
  },
  {
    name: "Plant-based Everyday",
    description:
      "Paket makan siang nabati 5 hari dengan nasi merah, dua pilihan protein nabati, sayur, dan sambal.",
    price: 42000,
    days: 5,
    meal: "lunch",
    weekdays: [1, 2, 3, 4, 5],
    flexible: true,
    image: "/assets/food/plant-based.png",
    tags: ["Nabati", "Nasi merah"],
    trialPrice: 45000,
    trialMax: null,
    tiers: [
      { min: 3, percent: 5 },
      { min: 5, percent: 10 },
    ],
    capacity: { "0": 0, "1": 100, "2": 100, "3": 100, "4": 100, "5": 100, "6": 0 },
    windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
    packageType: "nasi_box",
    menus: [
      {
        ...boxMenu(
          "lunch",
          "Nasi box nabati",
          "/assets/food/plant-based.png",
          [
            dish("nasi", "Nasi merah", "180 g", "Nasi merah pulen dengan rasa gurih alami.", "nasi"),
            dish("lauk-1", "Tahu panggang", "2 potong", "Tahu panggang berbumbu kecap ringan.", "lauk"),
            dish("lauk-2", "Tempe orek", "60 g", "Tempe orek dengan rasa manis gurih.", "lauk"),
            dish("sayur", "Tumis sayur hijau", "120 g", "Sayuran hijau, brokoli, dan wortel.", "sayur"),
            dish("pelengkap", "Sambal kemangi", "25 g", "Sambal kemangi tanpa bahan hewani.", "pelengkap"),
          ],
          { caloriesKcal: 590, proteinG: 24, carbsG: 84, fatG: 17 },
        ),
        composition: [
          { id: "nasi", name: "Nasi", slots: 1 },
          { id: "lauk", name: "Protein nabati", slots: 2 },
          { id: "sayur", name: "Sayur", slots: 1 },
          { id: "pelengkap", name: "Pelengkap", slots: 1 },
        ],
      },
    ],
  },
  {
    name: "Ayam Sambal Rumahan",
    description:
      "Paket à la carte makan siang 5 hari dengan lauk rumahan yang familiar dan pelengkap yang mengenyangkan.",
    price: 32000,
    days: 5,
    meal: "lunch",
    weekdays: [1, 2, 3, 4, 5],
    flexible: false,
    image: "/assets/food/ayam-sambal.png",
    tags: ["À la carte", "Pedas"],
    trialPrice: null,
    trialMax: null,
    tiers: [
      { min: 3, percent: 5 },
      { min: 5, percent: 10 },
    ],
    capacity: { "0": 0, "1": 100, "2": 100, "3": 100, "4": 100, "5": 100, "6": 0 },
    windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
    packageType: "ala_carte",
    menus: [
      alaCarteMenu(
        "lunch",
        "Lauk rumahan dan pelengkap",
        "/assets/food/ayam-sambal.png",
        [
          dish("ayam", "Ayam sambal rumahan", "150 g", "Ayam dengan sambal merah yang dibuat segar."),
          dish("tempe", "Tempe bacem", "2 potong", "Tempe bacem dengan rasa manis gurih."),
          dish("nasi", "Nasi putih", "180 g", "Nasi pulen yang disajikan hangat."),
          dish("lalapan", "Lalapan segar", "50 g", "Timun dan daun kemangi."),
        ],
        null,
      ),
    ],
  },
  {
    name: "Ikan Bumbu Kuning",
    description:
      "Paket makan siang 5 hari dengan ikan berbumbu kuning, sayur, dan pelengkap segar ala Rumah Rasa.",
    price: 39000,
    days: 5,
    meal: "lunch",
    weekdays: [1, 2, 3, 4, 5],
    flexible: true,
    image: "/assets/food/ikan-kuning.png",
    tags: ["Ikan", "Nusantara"],
    trialPrice: 42000,
    trialMax: null,
    tiers: [
      { min: 3, percent: 5 },
      { min: 5, percent: 10 },
    ],
    capacity: { "0": 0, "1": 100, "2": 100, "3": 100, "4": 100, "5": 100, "6": 0 },
    windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
    packageType: "nasi_box",
    menus: [
      boxMenu(
        "lunch",
        "Nasi box ikan bumbu kuning",
        "/assets/food/ikan-kuning.png",
        [
          dish("nasi", "Nasi putih", "180 g", "Nasi pulen yang disajikan hangat.", "nasi"),
          dish("lauk", "Ikan bumbu kuning", "140 g", "Ikan dengan bumbu kunyit dan rempah segar.", "lauk"),
          dish("sayur", "Tumis buncis dan wortel", "100 g", "Sayuran tumis dengan tekstur renyah.", "sayur"),
          dish("pelengkap", "Acar timun wortel", "50 g", "Acar segar sebagai penyeimbang rasa.", "pelengkap"),
        ],
        { caloriesKcal: 570, proteinG: 31, carbsG: 74, fatG: 16 },
      ),
    ],
  },
];

export function seedSQL() {
  const images = [
    "ayam-panggang",
    "salmon-teriyaki",
    "nasi-nusantara",
    "plant-based",
    "ayam-sambal",
    "ikan-kuning",
  ];
  let sql = `insert into v1.profiles values('${DEMO_ACTORS.customer}','Nadia Putri','customer'),('${DEMO_ACTORS.owner}','Arini — Dapur Senja','owner'),('${DEMO_ACTORS.staff}','Bima — Operasional','staff'),('${DEMO_ACTORS.platform_admin}','Tim Catera','platform_admin');
 insert into v1.caterers(id,slug,name,description,areas,status) values('${CATERER_IDS[0]}','dapur-senja','Dapur Senja','Masakan rumahan yang bikin jam makan selalu ditunggu.',array['Jakarta Selatan','Jakarta Pusat','Tangerang Selatan'],'approved'),('${CATERER_IDS[1]}','hijau-kitchen','Hijau Kitchen','Menu seimbang dengan bahan segar, disiapkan setiap hari.',array['Jakarta Selatan','Jakarta Barat'],'approved'),('${CATERER_IDS[2]}','rumah-rasa','Rumah Rasa','Cita rasa Nusantara untuk keseharian Anda.',array['Bandung'],'approved');
 insert into v1.staff values('${CATERER_IDS[0]}','${DEMO_ACTORS.owner}','owner'),('${CATERER_IDS[0]}','${DEMO_ACTORS.staff}','staff');
 insert into v1.addresses(id,user_id,label,line,area,city,instructions) values('${ADDRESS_ID}','${DEMO_ACTORS.customer}','Rumah','Jl. Contoh No. 12, Kebayoran Baru','Jakarta Selatan','Jakarta','Data sintetis. Titip di resepsionis.');
 insert into v1.policies values(true,2500,8,3,true,true);insert into v1.promotions(code,percent) values('MAKANBAIK',10);
 insert into v1.invites(caterer_id,code,role) values('${CATERER_IDS[0]}','DEMO-DAPUR-SENJA','customer');`;
  DEMO_OFFERS.forEach((offer, i) => {
    sql += `insert into v1.packages(id,caterer_id,slug,offer,status) values('${PACKAGE_IDS[i]}','${CATERER_IDS[i === 1 || i === 3 ? 1 : i === 5 ? 2 : 0]}','${images[i]}',${q(offer)},'published');`;
  });
  const start = addDays(localDay(), 2);
  sql += `select set_config('request.jwt.claim.sub','${DEMO_ACTORS.customer}',false);select set_config('catera.demo','true',false);`;
  for (const i of [0, 1])
    sql += `do $$ declare c jsonb;begin c:=public.catera_v1_command('checkout.create',${q({ packageId: PACKAGE_IDS[i], addressId: ADDRESS_ID, portions: 1, startDate: start, trial: false, promo: "", invite: "" })},gen_random_uuid());perform public.catera_v1_command('checkout.demo_pay',jsonb_build_object('id',c->>'id'),gen_random_uuid());end $$;`;
  sql += `insert into v1.conversations(customer_id,caterer_id) values('${DEMO_ACTORS.customer}','${CATERER_IDS[0]}');insert into v1.messages(conversation_id,sender_id,body) select id,'${DEMO_ACTORS.owner}','Halo Kak Nadia! Selamat datang di Dapur Senja. Silakan kabari kami kalau ada pertanyaan tentang jadwal pengantaran.' from v1.conversations;`;
  return sql;
}

/**
 * Upgrade an older local demo in place. Purchases retain their original
 * snapshots; only the customer-facing package templates are refreshed.
 */
export function refreshDemoCatalogSQL() {
  return `do $$ declare p v1.packages; next_offer jsonb; rev int; begin
  ${DEMO_OFFERS.map(
    (offer, i) => `select * into p from v1.packages where id='${PACKAGE_IDS[i]}';
  if found and (p.offer->>'packageType' is null or jsonb_typeof(p.offer->'menus'->0->'items') is distinct from 'array' or jsonb_typeof(p.offer->'menus'->0->'items'->0->'image') is distinct from 'string') then
    select coalesce(max(revision),-1)+1 into rev from v1.content_revisions where package_id=p.id;
    next_offer:=${q({ ...offer, status: "published" })};
    next_offer:=jsonb_set(next_offer,'{contentRevision}',to_jsonb(rev),true);
    update v1.packages set offer=next_offer,status='published',version=version+1 where id=p.id;
    insert into v1.content_revisions(package_id,revision,contents) values(p.id,rev,v1.contents_template(next_offer)) on conflict do nothing;
  end if;`,
  ).join("\n  ")}
end $$;`;
}

/** Retire old content-test listings from the ordinary customer demo. */
export function retireDemoFixturePackagesSQL() {
  return `update v1.packages p
set status='retired', offer=jsonb_set(p.offer,'{status}','"retired"'::jsonb)
where p.slug in('demo-ala-carte-tunggal','demo-ala-carte-lengkap','demo-nasi-box')
  and not exists(select 1 from v1.checkouts c where c.package_id=p.id);`;
}
