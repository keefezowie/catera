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
export function seedSQL() {
  const names = [
    "Ayam Panggang Harian",
    "Salmon Teriyaki",
    "Rantang Nusantara",
    "Plant-based Everyday",
    "Ayam Sambal Rumahan",
    "Ikan Bumbu Kuning",
  ];
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
  names.forEach((name, i) => {
    const meal = i === 1 ? "dinner" : i === 2 ? "both" : "lunch";
    const offer = {
      name,
      description: [
        "Ayam panggang berbumbu, nasi hangat, dan sayuran segar. Makan siang terasa lebih teratur, tanpa repot memikirkan menu.",
        "Salmon teriyaki dengan nasi dan brokoli. Disiapkan hangat untuk menemani makan malam Anda.",
        "Dua kali makan setiap hari, dengan ragam masakan rumahan Indonesia.",
        "Tahu, tempe, nasi merah, dan sayuran berwarna dalam satu sajian seimbang.",
        "Ayam dengan sambal rumahan, sayuran, dan nasi. Familiar, hangat, dan penuh rasa.",
        "Ikan berbumbu kuning dengan nasi dan sayuran segar.",
      ][i],
      price: [35000, 59000, 65000, 42000, 32000, 39000][i],
      days: [5, 5, 10, 5, 5, 5][i],
      meal,
      weekdays: [1, 2, 3, 4, 5],
      flexible: i !== 4,
      image: "/assets/food/" + images[i] + ".png",
      tags:
        i === 3
          ? ["Plant-based", "Nasi merah"]
          : i === 1
            ? ["Tinggi protein"]
            : ["Rumahan", "Menu berganti"],
      trialPrice:
        i === 4 ? null : [39000, 65000, 69000, 45000, 35000, 42000][i],
      trialMax: null,
      tiers: [
        { min: 3, percent: 5 },
        { min: 5, percent: 10 },
      ],
      capacity: {
        "0": 0,
        "1": 100,
        "2": 100,
        "3": 100,
        "4": 100,
        "5": 100,
        "6": 0,
      },
      windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
      menus: [
        {
          name,
          description:
            "Disajikan bersama nasi dan sayuran. Informasi menu disediakan oleh katerer.",
          image: "/assets/food/" + images[i] + ".png",
          meal: meal === "both" ? "lunch" : meal,
        },
        ...(meal === "both"
          ? [
              {
                name: "Ayam kecap & tumis buncis",
                description: "Menu makan malam rumahan.",
                image: "/assets/food/ayam-sambal.png",
                meal: "dinner",
              },
            ]
          : []),
      ],
    };
    sql += `insert into v1.packages(id,caterer_id,slug,offer,status) values('${PACKAGE_IDS[i]}','${CATERER_IDS[i === 1 || i === 3 ? 1 : i === 5 ? 2 : 0]}','${images[i]}',${q(offer)},'published');`;
  });
  const start = addDays(localDay(), 2);
  sql += `select set_config('request.jwt.claim.sub','${DEMO_ACTORS.customer}',false);select set_config('catera.demo','true',false);`;
  for (const i of [0, 1])
    sql += `do $$ declare c jsonb;begin c:=public.catera_v1_command('checkout.create',${q({ packageId: PACKAGE_IDS[i], addressId: ADDRESS_ID, portions: 1, startDate: start, trial: false, promo: "", invite: "" })},gen_random_uuid());perform public.catera_v1_command('checkout.demo_pay',jsonb_build_object('id',c->>'id'),gen_random_uuid());end $$;`;
  sql += `insert into v1.conversations(customer_id,caterer_id) values('${DEMO_ACTORS.customer}','${CATERER_IDS[0]}');insert into v1.messages(conversation_id,sender_id,body) select id,'${DEMO_ACTORS.owner}','Halo Kak Nadia! Selamat datang di Dapur Senja. Silakan kabari kami kalau ada pertanyaan tentang jadwal pengantaran.' from v1.conversations;`;
  return sql;
}
