import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DEMO_OFFERS } from "../packages/backend/src/seed.ts";

const BASELINE_VERSION = "2026.09.11.2";
const arg = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const jakartaDay = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const anchor = arg("--anchor") ?? jakartaDay();
if (
  !/^\d{4}-\d{2}-\d{2}$/.test(anchor) ||
  Number.isNaN(Date.parse(`${anchor}T00:00:00Z`))
) {
  throw new Error("--anchor must be a valid YYYY-MM-DD Jakarta calendar date");
}

const q = (value: unknown) =>
  `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const text = (value: string) => `'${value.replaceAll("'", "''")}'`;
const uuid = (group: string, number: number) =>
  `${group}000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const day = (offset: number) => {
  const date = new Date(`${anchor}T00:00:00Z`);
  const step = offset < 0 ? -1 : 1;
  let remaining = Math.abs(offset);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + step);
    const dow = date.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
};

const caterers = [
  {
    key: "primary",
    id: "existing",
    slug: "catera-demo-workspace",
    name: "Demo Dapur Catera",
    description:
      "Masakan rumahan terencana untuk makan siang dan malam keluarga Jakarta.",
    areas: ["Jakarta Selatan", "Jakarta Pusat", "Tangerang Selatan"],
    status: "approved",
  },
  {
    key: "hijau",
    id: uuid("d1", 2),
    slug: "demo-v1-hijau-kitchen",
    name: "Hijau Kitchen",
    description: "Menu seimbang berbahan segar untuk ritme kerja yang padat.",
    areas: ["Jakarta Selatan", "Jakarta Barat"],
    status: "approved",
  },
  {
    key: "rumah",
    id: uuid("d1", 3),
    slug: "demo-v1-rumah-rasa",
    name: "Rumah Rasa",
    description:
      "Calon mitra katering Nusantara yang sedang menunggu verifikasi Catera.",
    areas: ["Bandung"],
    status: "submitted",
  },
] as const;

const customers = [
  ["customer-1", uuid("d2", 1), "Ayu Lestari"],
  ["customer-2", uuid("d2", 2), "Bima Prakoso"],
  ["customer-3", uuid("d2", 3), "Citra Maharani"],
  ["customer-4", uuid("d2", 4), "Dimas Saputra"],
  ["customer-5", uuid("d2", 5), "Eka Wulandari"],
  ["customer-6", uuid("d2", 6), "Farhan Nugraha"],
] as const;

const packageSlugs = [
  "demo-v1-ayam-panggang",
  "demo-v1-salmon-teriyaki",
  "demo-v1-rantang-nusantara",
  "demo-v1-plant-based",
  "demo-v1-ayam-sambal",
  "demo-v1-ikan-kuning",
];
const packageSeller = [
  "primary",
  "hijau",
  "primary",
  "hijau",
  "primary",
  "hijau",
];
const offers = DEMO_OFFERS.map((offer) => ({
  ...offer,
  status: "published",
  cutoff: "17:00",
  timezone: "Asia/Jakarta",
  contentRevision: 1,
}));
const draftOffer = {
  name: "Dapur Sunda Harian",
  description:
    "Rancangan paket makan siang khas Sunda untuk proses verifikasi mitra.",
  price: 33000,
  days: 5,
  meal: "lunch",
  weekdays: [1, 2, 3, 4, 5],
  flexible: true,
  image: "/assets/food/ikan-kuning.png",
  tags: ["Sunda", "Makan siang"],
  trialPrice: 36000,
  trialMax: 1,
  tiers: [{ min: 5, percent: 8 }],
  capacity: { "0": 0, "1": 40, "2": 40, "3": 40, "4": 40, "5": 40, "6": 0 },
  windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
  packageType: "nasi_box",
  menus: [{ meal: "lunch", contentModel: "slots", name: "", description: "", image: "", items: [], nutrition: null, composition: [{ id: "main", categoryId: "main", name: "Lauk", slots: 1 }] }],
  status: "draft",
  cutoff: "17:00",
  timezone: "Asia/Jakarta",
  contentRevision: 1,
};

const schedules = [
  {
    user: "customer",
    pkg: 2,
    portions: 1,
    offsets: [-8, -7, -6, 0, 1],
    statuses: ["delivered", "delivered", "delivered", "preparing", "scheduled"],
  },
  {
    user: "customer-1",
    pkg: 0,
    portions: 2,
    offsets: [-3, -2, -1, 0, 1],
    statuses: [
      "delivered",
      "delivered",
      "delivered",
      "out_for_delivery",
      "scheduled",
    ],
  },
  {
    user: "customer-2",
    pkg: 0,
    portions: 1,
    offsets: [0, 1, 2, 3, 4],
    statuses: ["scheduled", "scheduled", "scheduled", "scheduled", "scheduled"],
  },
  {
    user: "customer-3",
    pkg: 4,
    portions: 1,
    offsets: [0, 1, 2, 3, 4],
    statuses: ["issue", "scheduled", "scheduled", "scheduled", "scheduled"],
  },
  {
    user: "customer-4",
    pkg: 4,
    portions: 1,
    offsets: [-14, -13, -12, -11, -10],
    statuses: ["delivered", "delivered", "delivered", "delivered", "delivered"],
  },
  {
    user: "customer-5",
    pkg: 5,
    portions: 3,
    offsets: [0, 1, 2, 3, 4],
    statuses: ["scheduled", "scheduled", "scheduled", "scheduled", "scheduled"],
  },
  {
    user: "customer-6",
    pkg: 2,
    portions: 1,
    offsets: [0, 1, 2, 3, 4],
    statuses: ["preparing", "scheduled", "scheduled", "scheduled", "scheduled"],
  },
  {
    user: "customer",
    pkg: 1,
    portions: 1,
    offsets: [-24],
    statuses: ["delivered"],
    trial: true,
  },
] as const;

const statements: string[] = [];
const add = (sql: string) => statements.push(sql.trim());

add(`-- Catera V1 synthetic operator baseline ${BASELINE_VERSION}; generated for Jakarta ${anchor}.
-- This is data-only SQL. It intentionally excludes auth, credentials, tokens, environment configuration, and Storage.
begin;
select pg_advisory_xact_lock(hashtextextended('catera-v1-demo-baseline', 0));
do $$
declare profile_count int; workspace_count int;
begin
 if current_database() like '%otmanljypltxkwjcebni%' then raise exception 'PROTECTED_PILOT_REFUSED'; end if;
 select count(*) into profile_count from v1.profiles
  where (name,role) in (('Demo Pelanggan','customer'),('Demo Pemilik','owner'),('Demo Admin','platform_admin'),('Demo Staf','staff'));
 select count(*) into workspace_count from v1.caterers where slug='catera-demo-workspace' and name='Demo Dapur Catera';
 if profile_count<>4 or workspace_count<>1 then raise exception 'EXPECTED_SYNTHETIC_WORKSPACE_NOT_FOUND'; end if;
 if not exists(select 1 from v1.policies where id and synthetic and approved) or exists(select 1 from v1.policies where id and (not synthetic or not approved)) then raise exception 'NON_SYNTHETIC_POLICY_REFUSED'; end if;
 if exists(select 1 from v1.caterers where slug not in('catera-demo-workspace','demo-v1-hijau-kitchen','demo-v1-rumah-rasa')) then raise exception 'UNRELATED_CATERER_REFUSED'; end if;
end $$;
create temp table demo_people(key text primary key,id uuid not null) on commit drop;
insert into demo_people select 'customer',id from v1.profiles where name='Demo Pelanggan' and role='customer';
insert into demo_people select 'owner',id from v1.profiles where name='Demo Pemilik' and role='owner';
insert into demo_people select 'admin',id from v1.profiles where name='Demo Admin' and role='platform_admin';
insert into demo_people select 'staff',id from v1.profiles where name='Demo Staf' and role='staff';
create temp table demo_caterers(key text primary key,id uuid not null) on commit drop;
insert into demo_caterers select 'primary',id from v1.caterers where slug='catera-demo-workspace';
insert into demo_caterers values ('hijau','${caterers[1].id}'),('rumah','${caterers[2].id}');
create temp table demo_packages(id uuid primary key) on commit drop;
insert into demo_packages select id from v1.packages where slug like 'demo-v1-%';
insert into demo_packages select p.id from v1.packages p join demo_caterers c on c.id=p.caterer_id on conflict do nothing;

-- Remove only the relationship graph owned by these explicit demo identities and caterers.
delete from v1.payout_items where payout_id in(select id from v1.payouts where caterer_id in(select id from demo_caterers));
delete from v1.refunds where checkout_id in(select id from v1.checkouts where package_id in(select id from demo_packages));
delete from v1.reviews where package_id in(select id from demo_packages);
delete from v1.messages where conversation_id in(select id from v1.conversations where caterer_id in(select id from demo_caterers));
delete from v1.conversations where caterer_id in(select id from demo_caterers);
delete from v1.support_cases where caterer_id in(select id from demo_caterers);
delete from v1.fulfillments where day_id in(select d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.package_id in(select id from demo_packages));
delete from v1.delivery_days where subscription_id in(select id from v1.subscriptions where package_id in(select id from demo_packages));
delete from v1.reservations where package_id in(select id from demo_packages);
delete from v1.payment_events where checkout_id in(select id from v1.checkouts where package_id in(select id from demo_packages));
delete from v1.payments where checkout_id in(select id from v1.checkouts where package_id in(select id from demo_packages));
delete from v1.allocations where caterer_id in(select id from demo_caterers);
update v1.checkouts set subscription_id=null where package_id in(select id from demo_packages);
delete from v1.subscriptions where package_id in(select id from demo_packages);
delete from v1.checkouts where package_id in(select id from demo_packages);
delete from v1.payouts where caterer_id in(select id from demo_caterers);
delete from v1.outbox where dedupe like 'demo-%' or payload->>'checkoutId' like 'd5%' or payload->>'refundId' like 'da%';
delete from public.catera_v1_events where id in(select id from v1.notifications where user_id in(select id from demo_people) or user_id::text like 'd2%');
delete from v1.notifications where user_id in(select id from demo_people) or user_id::text like 'd2%';
delete from v1.receipts where actor_id in(select id from demo_people) or actor_id::text like 'd2%';
delete from v1.imports where caterer_id in(select id from demo_caterers);
alter table v1.production disable trigger production_immutable;
delete from v1.production where caterer_id in(select id from demo_caterers);
alter table v1.production enable trigger production_immutable;
delete from v1.menus where package_id in(select id from demo_packages);
delete from v1.capacity where package_id in(select id from demo_packages);
delete from v1.dishes where caterer_id in(select id from demo_caterers);
delete from v1.dish_categories where caterer_id in(select id from demo_caterers);
alter table v1.content_revisions disable trigger content_revisions_immutable;
delete from v1.content_revisions where package_id in(select id from demo_packages);
alter table v1.content_revisions enable trigger content_revisions_immutable;
delete from v1.packages where id in(select id from demo_packages);
delete from v1.relationships where caterer_id in(select id from demo_caterers);
delete from v1.invites where caterer_id in(select id from demo_caterers);
delete from v1.staff where caterer_id in(select id from demo_caterers) and user_id not in(select id from demo_people where key in('owner','staff'));
delete from v1.addresses where user_id::text like 'd2%' or user_id=(select id from demo_people where key='customer');
delete from v1.caterers where id in('${caterers[1].id}','${caterers[2].id}');
delete from v1.profiles where id::text like 'd2%' or id in('${uuid("d3", 1)}','${uuid("d3", 2)}');`);

add(`update v1.caterers set name='Demo Dapur Catera',description=${text(caterers[0].description)},areas=array['Jakarta Selatan','Jakarta Pusat','Tangerang Selatan'],status='approved',cutoff='17:00',timezone='Asia/Jakarta',version=1,review_note='Baseline sintetis disetujui untuk demonstrasi.' where slug='catera-demo-workspace';
insert into v1.staff(caterer_id,user_id,role) select c.id,p.id,'owner' from demo_caterers c,demo_people p where c.key='primary' and p.key='owner' on conflict do nothing;
insert into v1.staff(caterer_id,user_id,role) select c.id,p.id,'staff' from demo_caterers c,demo_people p where c.key='primary' and p.key='staff' on conflict do nothing;
insert into v1.caterers(id,slug,name,description,areas,status,cutoff,timezone,version,review_note) values
 ('${caterers[1].id}','${caterers[1].slug}',${text(caterers[1].name)},${text(caterers[1].description)},array['Jakarta Selatan','Jakarta Barat'],'approved','17:00','Asia/Jakarta',1,'Baseline sintetis disetujui untuk marketplace.'),
 ('${caterers[2].id}','${caterers[2].slug}',${text(caterers[2].name)},${text(caterers[2].description)},array['Bandung'],'submitted','17:00','Asia/Jakarta',1,null);
insert into v1.profiles(id,name,role) values
 ('${uuid("d3", 1)}','Nadira Putri','owner'),('${uuid("d3", 2)}','Raka Permana','owner'),
 ${customers.map(([, id, name]) => `('${id}',${text(name)},'customer')`).join(",\n ")};
insert into demo_people values ${customers.map(([key, id]) => `('${key}','${id}')`).join(",")};
insert into v1.staff values ('${caterers[1].id}','${uuid("d3", 1)}','owner'),('${caterers[2].id}','${uuid("d3", 2)}','owner');
insert into v1.policies(id,service_fee,marketplace_percent,invited_percent,approved,synthetic) values(true,2500,8,3,true,true)
 on conflict(id) do update set service_fee=excluded.service_fee,marketplace_percent=excluded.marketplace_percent,invited_percent=excluded.invited_percent,approved=true,synthetic=true;
insert into v1.promotions(code,percent,active) values('MAKANBAIK',10,true),('LANGGANAN5',5,true) on conflict(code) do update set percent=excluded.percent,active=excluded.active;`);

for (let i = 0; i < offers.length; i += 1) {
  add(`insert into v1.packages(id,caterer_id,slug,offer,version,status)
select '${uuid("d4", i + 1)}',c.id,'${packageSlugs[i]}',${q(offers[i])},1,'published' from demo_caterers c where c.key='${packageSeller[i]}';
insert into v1.content_revisions(package_id,revision,contents) values('${uuid("d4", i + 1)}',1,v1.contents_template(${q(offers[i])}));`);
}
add(`insert into v1.packages(id,caterer_id,slug,offer,version,status) select '${uuid("d4", 7)}',id,'demo-v1-dapur-sunda',${q(draftOffer)},1,'draft' from demo_caterers where key='rumah';
insert into v1.content_revisions(package_id,revision,contents) values('${uuid("d4", 7)}',1,v1.contents_template(${q(draftOffer)}));`);

const dishRows = new Map<
  string,
  { seller: string; details: Record<string, unknown> }
>();
for (let i = 0; i < offers.length; i += 1) {
  for (const menu of offers[i].menus) {
    for (const item of menu.items) {
      const key = `${packageSeller[i]}:${item.name}`;
      if (!dishRows.has(key))
        dishRows.set(key, {
          seller: packageSeller[i],
          details: {
            name: item.name,
            description: item.description,
            image: item.image,
            serving: item.serving,
          },
        });
    }
  }
}
let dishIndex = 1;
for (const { seller, details } of dishRows.values()) {
  add(
    `insert into v1.dishes(id,caterer_id,details,version,archived,created_at,updated_at) select '${uuid("d6", dishIndex++)}',id,${q(details)},1,false,'${anchor} 08:00+07','${anchor} 08:00+07' from demo_caterers where key='${seller}';`,
  );
}

add(`insert into v1.addresses(id,user_id,label,line,area,city,instructions,version)
select '${uuid("d7", 1)}',id,'Rumah','Jl. Wijaya II No. 18, Kebayoran Baru','Jakarta Selatan','Jakarta','Data sintetis. Titip di meja keamanan.',1 from demo_people where key='customer';`);
const addressLines = [
  ["Jl. Panglima Polim Raya No. 24", "Jakarta Selatan"],
  ["Jl. Cikajang No. 11", "Jakarta Selatan"],
  ["Jl. Tanjung Duren Utara No. 8", "Jakarta Barat"],
  ["Jl. Kuningan Mulia No. 5", "Jakarta Selatan"],
  ["Jl. Kemang Timur No. 31", "Jakarta Selatan"],
  ["Jl. Barito II No. 7", "Jakarta Selatan"],
] as const;
for (let i = 0; i < customers.length; i += 1) {
  add(
    `insert into v1.addresses(id,user_id,label,line,area,city,instructions,version) select '${uuid("d7", i + 2)}',id,'Rumah',${text(addressLines[i][0])},${text(addressLines[i][1])},'Jakarta','Alamat dan identitas sintetis untuk demo Catera.',1 from demo_people where key='customer-${i + 1}';`,
  );
}
add(`insert into v1.relationships(user_id,caterer_id,source)
select p.id,c.id,case when p.key in('customer-2','customer-5') then 'invited' else 'marketplace' end from demo_people p cross join demo_caterers c where p.key like 'customer%' and c.key in('primary','hijau');
insert into v1.invites(id,caterer_id,code,role,used_by) select '${uuid("d8", 1)}',id,'DEMO-V1-HIJAU','customer',(select id from demo_people where key='customer-2') from demo_caterers where key='hijau';`);

for (let i = 0; i < schedules.length; i += 1) {
  const schedule = schedules[i];
  const offer = offers[schedule.pkg];
  const checkoutId = uuid("d5", i + 1);
  const subscriptionId = uuid("d9", i + 1);
  const addressId = uuid(
    "d7",
    schedule.user === "customer" ? 1 : Number(schedule.user.split("-")[1]) + 1,
  );
  const dates = schedule.offsets.map(day);
  const subtotal =
    (schedule.trial
      ? (offer.trialPrice ?? offer.price)
      : offer.price * dates.length) * schedule.portions;
  const serviceFee = 2500;
  const total = subtotal + serviceFee;
  const completed = schedule.statuses.every((status) => status === "delivered");
  add(`insert into v1.checkouts(id,user_id,package_id,address_id,quote,state,expires_at,provider_id,payment_url,created_at)
select '${checkoutId}',u.id,'${uuid("d4", schedule.pkg + 1)}','${addressId}',jsonb_build_object(
 'packageId','${uuid("d4", schedule.pkg + 1)}','portions',${schedule.portions},'trial',${schedule.trial ? "true" : "false"},'dates',${q(dates)},
 'subtotal',${subtotal},'discount',0,'discountPercent',0,'promotion',0,'serviceFee',${serviceFee},'total',${total},'perDay',${offer.price},'sellerFee',${Math.round(subtotal * 0.08)},
 'source',case when u.key in('customer-2','customer-5') then 'invited' else 'marketplace' end,'offer',v1.offer(p),'address',to_jsonb(a)-'user_id'),
 'paid','${day(Math.min(...schedule.offsets) - 1)} 10:00+07','demo-checkout-${i + 1}',null,'${day(Math.min(...schedule.offsets) - 2)} 09:00+07'
from demo_people u join v1.addresses a on a.id='${addressId}' join v1.packages p on p.id='${uuid("d4", schedule.pkg + 1)}' where u.key='${schedule.user}';
insert into v1.subscriptions(id,checkout_id,user_id,package_id,snapshot,portions,starts_on,ends_on,status,legacy)
select '${subscriptionId}',c.id,c.user_id,c.package_id,c.quote,${schedule.portions},'${dates[0]}','${dates.at(-1)}','${completed ? "completed" : "active"}',false from v1.checkouts c where c.id='${checkoutId}';
update v1.checkouts set subscription_id='${subscriptionId}' where id='${checkoutId}';
insert into v1.payments(id,checkout_id,provider_id,amount,state,created_at) values('${uuid("db", i + 1)}','${checkoutId}','demo-payment-${i + 1}',${total},'paid','${day(Math.min(...schedule.offsets) - 2)} 09:05+07');
insert into v1.allocations(id,checkout_id,caterer_id,amount,held,paid_out)
select '${uuid("dc", i + 1)}','${checkoutId}',p.caterer_id,${subtotal - Math.round(subtotal * 0.08)},${i === 3 ? 42000 : 0},${i < 2 ? Math.round((subtotal - Math.round(subtotal * 0.08)) * 0.5) : 0} from v1.packages p where p.id='${uuid("d4", schedule.pkg + 1)}';`);
  for (let j = 0; j < dates.length; j += 1) {
    const deliveryId = uuid("dd", i * 10 + j + 1);
    const status = schedule.statuses[j];
    const meals = offer.meal === "both" ? ["lunch", "dinner"] : [offer.meal];
    add(`insert into v1.reservations(checkout_id,package_id,service_date,portions,state) values('${checkoutId}','${uuid("d4", schedule.pkg + 1)}','${dates[j]}',${schedule.portions},'confirmed');
insert into v1.delivery_days(id,subscription_id,service_date,address,status,version)
select '${deliveryId}','${subscriptionId}','${dates[j]}',to_jsonb(a)-'user_id','${status}',1 from v1.addresses a where a.id='${addressId}';
${meals.map((meal) => `insert into v1.fulfillments(day_id,meal,status) values('${deliveryId}','${meal}','${status}');`).join("\n")}`);
  }
}

const pendingRows = [
  [9, "customer-1", 1, "pending", 1],
  [10, "customer-2", 3, "expired", -2],
  [11, "customer-3", 0, "payment_exception", 2],
] as const;
for (const [n, user, pkg, state, offset] of pendingRows) {
  const offer = offers[pkg];
  const addressId = uuid("d7", Number(user.split("-")[1]) + 1);
  add(`insert into v1.checkouts(id,user_id,package_id,address_id,quote,state,expires_at,provider_id,payment_url,created_at)
select '${uuid("d5", n)}',u.id,p.id,a.id,jsonb_build_object('packageId',p.id,'portions',1,'trial',false,'dates',${q([day(offset)])},'subtotal',${offer.price},'discount',0,'discountPercent',0,'promotion',0,'serviceFee',2500,'total',${offer.price + 2500},'perDay',${offer.price},'sellerFee',${Math.round(offer.price * 0.08)},'source','marketplace','offer',v1.offer(p),'address',to_jsonb(a)-'user_id'),'${state}','${state === "pending" ? day(1) + " 16:00+07" : day(-1) + " 10:00+07"}','demo-checkout-${n}',${state === "pending" ? "'https://example.invalid/demo-checkout'" : "null"},'${day(-2)} 09:00+07' from demo_people u join v1.addresses a on a.id='${addressId}' join v1.packages p on p.id='${uuid("d4", pkg + 1)}' where u.key='${user}';
insert into v1.reservations values('${uuid("d5", n)}','${uuid("d4", pkg + 1)}','${day(offset)}',1,'${state === "pending" ? "held" : "released"}');`);
}
add(`insert into v1.payments(id,checkout_id,provider_id,amount,state,created_at) values('${uuid("db", 11)}','${uuid("d5", 11)}','demo-payment-exception',37500,'failed','${day(-1)} 09:05+07');
insert into v1.outbox(id,kind,payload,dedupe,attempts,available_at,processed_at,last_error) values
 ('${uuid("de", 1)}','payment.create',jsonb_build_object('checkoutId','${uuid("d5", 9)}'),'demo-payment-create-9',1,'${anchor} 09:00+07','${anchor} 09:00+07',null),
 ('${uuid("de", 2)}','refund.create',jsonb_build_object('refundId','${uuid("da", 1)}'),'demo-refund-create-1',1,'${anchor} 09:00+07','${anchor} 09:00+07',null);`);

// Dated overrides exercise current content revisions without altering purchased snapshots.
for (const pkg of [0, 2, 3]) {
  const offer = offers[pkg];
  for (const menu of offer.menus) {
    const details = {
      ...menu,
      name: `${menu.name} · ${day(1)}`,
      description: `${menu.description} Disiapkan khusus untuk jadwal demo mendatang.`,
    };
    add(
      `insert into v1.menus(package_id,content_revision,service_date,meal,details,version) values('${uuid("d4", pkg + 1)}',1,'${day(1)}','${menu.meal}',${q(details)},1);`,
    );
  }
}
add(`insert into v1.production(id,caterer_id,service_date,revision,entries,created_at)
select '${uuid("df", 1)}',c.id,'${anchor}',1,coalesce(jsonb_agg(v1.delivery(d)) filter(where d.id is not null),'[]'::jsonb),'${anchor} 07:00+07'
from demo_caterers c left join v1.packages p on p.caterer_id=c.id left join v1.subscriptions s on s.package_id=p.id left join v1.delivery_days d on d.subscription_id=s.id and d.service_date='${anchor}' where c.key='primary' group by c.id;
insert into v1.production(id,caterer_id,service_date,revision,entries,created_at)
select '${uuid("df", 2)}',c.id,'${day(-1)}',1,coalesce(jsonb_agg(v1.delivery(d)) filter(where d.id is not null),'[]'::jsonb),'${day(-1)} 07:00+07'
from demo_caterers c left join v1.packages p on p.caterer_id=c.id left join v1.subscriptions s on s.package_id=p.id left join v1.delivery_days d on d.subscription_id=s.id and d.service_date='${day(-1)}' where c.key='primary' group by c.id;`);

add(`insert into v1.reviews(id,subscription_id,user_id,package_id,rating,food,delivery,value,body,reply,hidden,created_at)
select '${uuid("da", 11)}',s.id,s.user_id,s.package_id,5,5,5,4,'Ayamnya lembut dan jadwal pengantaran selalu jelas.','Terima kasih, Kak Ayu. Kami tunggu pesanan berikutnya!',false,'${day(-1)} 19:30+07' from v1.subscriptions s where s.id='${uuid("d9", 2)}';
insert into v1.reviews(id,subscription_id,user_id,package_id,rating,food,delivery,value,body,reply,hidden,created_at)
select '${uuid("da", 12)}',s.id,s.user_id,s.package_id,4,5,4,4,'Menu rumahan enak dan porsinya pas untuk makan siang.',null,false,'${day(-9)} 18:30+07' from v1.subscriptions s where s.id='${uuid("d9", 5)}';

insert into v1.support_cases(id,user_id,caterer_id,delivery_id,subscription_id,checkout_id,subject,description,status,resolution,amount,created_at)
select '${uuid("da", 21)}',s.user_id,p.caterer_id,d.id,s.id,s.checkout_id,'Konfirmasi titik antar','Kurir perlu petunjuk menuju lobi gedung.','open',null,null,'${anchor} 09:10+07' from v1.subscriptions s join v1.packages p on p.id=s.package_id join v1.delivery_days d on d.subscription_id=s.id and d.service_date='${anchor}' where s.id='${uuid("d9", 2)}';
insert into v1.support_cases(id,user_id,caterer_id,delivery_id,subscription_id,checkout_id,subject,description,status,resolution,amount,created_at)
select '${uuid("da", 22)}',s.user_id,p.caterer_id,d.id,s.id,s.checkout_id,'Menu hari ini','Apakah sambal dapat dipisah dari nasi box?','responded','Bisa, sambal sudah kami pisahkan.',null,'${day(-1)} 12:00+07' from v1.subscriptions s join v1.packages p on p.id=s.package_id join v1.delivery_days d on d.subscription_id=s.id limit 1;
insert into v1.support_cases(id,user_id,caterer_id,delivery_id,subscription_id,checkout_id,subject,description,status,resolution,amount,created_at)
select '${uuid("da", 23)}',s.user_id,p.caterer_id,d.id,s.id,s.checkout_id,'Pengantaran tertunda','Status kurir belum berubah setelah waktu makan.','escalated',null,null,'${anchor} 13:15+07' from v1.subscriptions s join v1.packages p on p.id=s.package_id join v1.delivery_days d on d.subscription_id=s.id and d.status='issue' where s.id='${uuid("d9", 4)}';
insert into v1.support_cases(id,user_id,caterer_id,delivery_id,subscription_id,checkout_id,subject,description,status,resolution,amount,created_at)
select '${uuid("da", 24)}',s.user_id,p.caterer_id,d.id,s.id,s.checkout_id,'Komponen kurang','Satu pelengkap tidak ikut terkirim.','resolved','Pengembalian sebagian sudah disetujui.',18000,'${day(-2)} 14:00+07' from v1.subscriptions s join v1.packages p on p.id=s.package_id join v1.delivery_days d on d.subscription_id=s.id where s.id='${uuid("d9", 1)}' limit 1;
insert into v1.refunds(id,case_id,checkout_id,amount,state,provider_id,created_at) select '${uuid("da", 1)}','${uuid("da", 24)}',checkout_id,18000,'completed','demo-refund-1','${day(-1)} 11:00+07' from v1.support_cases where id='${uuid("da", 24)}';

insert into v1.conversations(id,customer_id,caterer_id) select '${uuid("da", 31)}',p.id,c.id from demo_people p,demo_caterers c where p.key='customer' and c.key='primary';
insert into v1.messages(id,conversation_id,sender_id,body,created_at) values
 ('${uuid("da", 32)}','${uuid("da", 31)}',(select id from demo_people where key='owner'),'Halo Kak, jadwal siang dan malam besok sudah kami konfirmasi.','${day(-1)} 16:20+07'),
 ('${uuid("da", 33)}','${uuid("da", 31)}',(select id from demo_people where key='customer'),'Terima kasih. Sambal makan siangnya boleh dipisah ya.','${day(-1)} 16:25+07'),
 ('${uuid("da", 34)}','${uuid("da", 31)}',(select id from demo_people where key='staff'),'Siap, sudah kami catat di dapur.','${day(-1)} 16:28+07');

insert into v1.notifications(id,user_id,kind,body,href,read_at,created_at) values
 ('${uuid("da", 41)}',(select id from demo_people where key='customer'),'delivery','Pesanan makan siang sedang disiapkan.','/calendar',null,'${anchor} 08:15+07'),
 ('${uuid("da", 42)}',(select id from demo_people where key='customer'),'menu','Menu besok sudah diperbarui oleh katerer.','/calendar','${anchor} 08:00+07','${day(-1)} 17:10+07'),
 ('${uuid("da", 43)}',(select id from demo_people where key='owner'),'support','Ada permintaan bantuan baru.','/seller/support',null,'${anchor} 09:10+07'),
 ('${uuid("da", 44)}',(select id from demo_people where key='admin'),'verification','Rumah Rasa menunggu verifikasi.','/admin',null,'${anchor} 08:00+07');

insert into v1.payouts(id,caterer_id,amount,status,provider_id,created_at) select '${uuid("da", 51)}',id,175000,'paid','demo-payout-1','${day(-3)} 15:00+07' from demo_caterers where key='primary';
insert into v1.payout_items(payout_id,allocation_id,amount) values('${uuid("da", 51)}','${uuid("dc", 1)}',175000);

insert into v1.audit(id,actor_id,action,details,created_at) values
 ('${uuid("da", 61)}',(select id from demo_people where key='admin'),'admin.verify',jsonb_build_object('id',(select id from demo_caterers where key='primary'),'status','approved','reason','Baseline sintetis untuk demonstrasi Catera V1.'),'${day(-30)} 10:00+07'),
 ('${uuid("da", 62)}',(select id from demo_people where key='owner'),'production.freeze',jsonb_build_object('id','${uuid("df", 1)}','catererId',(select id from demo_caterers where key='primary'),'dateAfter','${anchor}'),'${anchor} 07:00+07')
on conflict(id) do nothing;`);

add("select set_config('catera.demo','true',true);\n" + await readFile(new URL("../packages/backend/src/demo-slot-upgrade.sql", import.meta.url), "utf8"));

add(`do $$
declare counts jsonb; hashes jsonb;
begin
 select jsonb_build_object(
  'caterers',(select count(*) from v1.caterers where slug in('catera-demo-workspace','demo-v1-hijau-kitchen','demo-v1-rumah-rasa')),
  'packages',(select count(*) from v1.packages where slug like 'demo-v1-%'),
  'customers',(select count(*) from demo_people where key like 'customer%'),
  'subscriptions',(select count(*) from v1.subscriptions where id::text like 'd9%'),
  'deliveries',(select count(*) from v1.delivery_days where id::text like 'dd%'),
  'checkouts',(select count(*) from v1.checkouts where id::text like 'd5%'),
  'supportCases',(select count(*) from v1.support_cases where id::text like 'da%')
 ) into counts;
 select jsonb_build_object(
 'packages',(select md5(coalesce(string_agg(slug||':'||status||':'||offer::text,'|' order by slug),'')) from v1.packages where slug like 'demo-v1-%'),
 'subscriptions',(select md5(coalesce(string_agg(id::text||':'||status||':'||starts_on||':'||ends_on,'|' order by id),'')) from v1.subscriptions where id::text like 'd9%'),
  'deliveries',(select md5(coalesce(string_agg(id::text||':'||service_date||':'||status,'|' order by id),'')) from v1.delivery_days where id::text like 'dd%'),
  'checkouts',(select md5(coalesce(string_agg(id::text||':'||user_id||':'||package_id||':'||state||':'||quote::text,'|' order by id),'')) from v1.checkouts where id::text like 'd5%'),
  'messages',(select md5(coalesce(string_agg(id::text||':'||conversation_id||':'||sender_id||':'||body,'|' order by id),'')) from v1.messages where id::text like 'da%')
 ) into hashes;
 insert into v1.audit(id,actor_id,action,details,created_at)
 values(gen_random_uuid(),(select id from demo_people where key='admin'),'demo.baseline.reset',jsonb_build_object('baselineVersion','${BASELINE_VERSION}','anchorDate','${anchor}','counts',counts,'hashes',hashes),clock_timestamp());
end $$;
commit;`);

const sql = `${statements.join("\n\n")}\n`;
const output = arg("--output");
if (output) {
  const path = resolve(output);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, sql, "utf8");
  process.stdout.write(`${path}\n`);
} else {
  process.stdout.write(sql);
}
