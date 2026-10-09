import type { PGlite } from "@electric-sql/pglite";
import { addDays, localDay } from "@catera/domain";
import { ADDRESS_ID, CATERER_IDS, DEMO_ACTORS, PACKAGE_IDS } from "./seed";

/**
 * Synthetic states for the demo customer (Nadia Putri) and Dapur Senja, built from the day the demo database is
 * made: a plan due for renewal, one already renewed, a trial, two completed plans, three kinds of paid checkout,
 * and the kitchen loop on a busy day. Applied by `createDemoDatabase` only, once, after the seed and the fixtures.
 * It is never a migration: hosted storage must never carry demo records.
 *
 * Real commands build what they can reach (the renewal, the trial, the customer-menu purchase, and the payment that
 * has not yet reached its subscription). Direct inserts build what no command can, because nothing buys a delivery
 * in the past: plans with delivered days, completed plans, a meal the system closed by itself, and the other
 * customers' stops today. They follow `fixture.sql`: a paid checkout, its subscription, reservations, delivery days,
 * fulfilments, payment and allocation, all marked with the seed's synthetic wording.
 */

/** Who closed a delivery: `null` while it is still ahead. */
type By = "customer" | "auto" | null;

const MARKER = "demo.synthetic_states";
const stateId = (group: number, n: number) => `ffff000${group}-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** The seed's packages these states use, in the seed's order. */
const AYAM = PACKAGE_IDS[0]; // Dapur Senja, lunch, 5 days
const RANTANG = PACKAGE_IDS[2]; // Dapur Senja, lunch and dinner, 10 days
const PLANT = PACKAGE_IDS[3]; // Hijau Kitchen, lunch, 5 days, with a trial
const SAMBAL = PACKAGE_IDS[4]; // Dapur Senja, lunch, 5 days
const IKAN = PACKAGE_IDS[5]; // Rumah Rasa (Bandung), lunch, 5 days
/** Nadia's second address, in Rumah Rasa's area, so she can buy from a caterer outside Jakarta. */
const BANDUNG_ADDRESS = stateId(4, 99);

/** The other customers whose stops fill Dapur Senja's route today. Every name, address and note says it is synthetic. */
const SYNTHETIC_CUSTOMERS = [
  {
    name: "Rani Contoh",
    label: "Rumah",
    line: "Jl. Contoh Melati No. 4, Kebayoran Lama",
    area: "Jakarta Selatan",
    city: "Jakarta",
    note: "Data sintetis. Titip di satpam.",
  },
  {
    name: "Dimas Contoh",
    label: "Kantor",
    line: "Gedung Contoh Lt. 3, Jl. Sintetis Raya No. 9, Tanah Abang",
    area: "Jakarta Pusat",
    city: "Jakarta",
    note: "Data sintetis. Hubungi resepsionis di lantai dasar.",
  },
  {
    name: "Sari Contoh",
    label: "Rumah",
    line: "Jl. Contoh Anggrek No. 17, Serpong",
    area: "Tangerang Selatan",
    city: "Tangerang Selatan",
    note: "Data sintetis. Letakkan di depan pagar.",
  },
  {
    name: "Budi Contoh",
    label: "Rumah",
    line: "Jl. Contoh Kenanga No. 21, Menteng",
    area: "Jakarta Pusat",
    city: "Jakarta",
    note: "Data sintetis.",
  },
  {
    name: "Maya Contoh",
    label: "Apartemen",
    line: "Apartemen Contoh Tower B/12, Pancoran",
    area: "Jakarta Selatan",
    city: "Jakarta",
    note: "Data sintetis. Titip di lobi.",
  },
];

const weekday = (day: string) => {
  const w = new Date(day + "T12:00:00Z").getUTCDay();
  return w >= 1 && w <= 5;
};
/** The `n` weekdays before `day`, oldest first. */
function weekdaysBefore(day: string, n: number) {
  const out: string[] = [];
  for (let d = addDays(day, -1); out.length < n; d = addDays(d, -1)) if (weekday(d)) out.unshift(d);
  return out;
}
/** The `n` weekdays after `day`, soonest first. */
function weekdaysAfter(day: string, n: number) {
  const out: string[] = [];
  for (let d = addDays(day, 1); out.length < n; d = addDays(d, 1)) if (weekday(d)) out.push(d);
  return out;
}

const dateArray = (days: string[]) => `array[${days.map((d) => `'${d}'`).join(",")}]::date[]`;
const byArray = (by: By[]) => `array[${by.map((b) => (b ? `'${b}'` : "null")).join(",")}]::text[]`;
const text = (value: string) => `'${value.replaceAll("'", "''")}'`;

/**
 * Ids of the plans other tests and screens may want to name. They sit in the top of the id range, so a test that
 * takes "the first row by id" keeps finding the seed's rows.
 */
export const DEMO_STATE_IDS = {
  /** Two weeks of Rantang Nusantara, two days left, no renewal; its delivery today is the kitchen's. */
  renewDue: stateId(2, 1),
  /** Rumah Rasa, renewed by a second plan; its lunch today was closed by the system. */
  renewed: stateId(2, 2),
  /** Ended yesterday; its last day was closed by the system. */
  completedRecent: stateId(2, 3),
  /** Ended 180 days ago. */
  completedOld: stateId(2, 4),
};

/** Matches the delivery days the direct plans write, for tests that need the demo's kitchen day set aside. */
export const DEMO_STATE_DAY_LIKE = "ffff0003-%";

/** One synthetic plan, written directly: the quote comes from the real pricing function, the dates are chosen here. */
const plan = (
  key: number,
  user: string,
  address: string,
  pkg: string,
  trial: boolean,
  days: string[],
  by: By[],
  status: "active" | "completed",
) =>
  `perform pg_temp.demo_plan(${key},'${user}','${address}','${pkg}',1,${trial},${dateArray(days)},${byArray(by)},'${status}');`;

/** The SQL that adds every demo state. Dates are built from `today`, so a new demo database starts from its own day. */
export function demoStatesSQL(today: string): string {
  const yesterday = addDays(today, -1);
  // Quotes are priced for a start far from every plan, then given the dates chosen here.
  const farStart = addDays(today, 120);
  // Due plan: two weeks of Rantang Nusantara, eight days delivered, today's lunch and dinner scheduled (the kitchen's
  // day), one to come. It stays inside the next few days so no purchase made from day 5 on overlaps it.
  const dueDays = [...weekdaysBefore(today, 8), today, ...weekdaysAfter(today, 1)];
  const dueBy: By[] = [...Array<By>(8).fill("customer"), null, null];
  // Renewed plan at Rumah Rasa: three days delivered, today's lunch closed by the system, one to come.
  const renewedDays = [...weekdaysBefore(today, 3), today, ...weekdaysAfter(today, 1)];
  const renewedBy: By[] = ["customer", "customer", "customer", "auto", null];
  const recentDays = [...weekdaysBefore(yesterday, 4), yesterday];
  const recentBy: By[] = ["customer", "customer", "customer", "customer", "auto"];
  const oldEnd = addDays(today, -180);
  const oldDays = [...weekdaysBefore(oldEnd, 4), oldEnd];
  const oldBy: By[] = Array<By>(5).fill("customer");

  const customers = SYNTHETIC_CUSTOMERS.map((c, i) => {
    const id = stateId(0, i + 1);
    const address = stateId(4, i + 1);
    return `insert into v1.profiles(id,name,role) values('${id}',${text(c.name)},'customer');
  insert into v1.addresses(id,user_id,label,line,area,city,instructions) values('${address}','${id}',${text(c.label)},${text(c.line)},${text(c.area)},${text(c.city)},${text(c.note)});
  ${plan(11 + i, id, address, RANTANG, true, [today], [null], "active")}`;
  }).join("\n  ");

  return `
create function pg_temp.demo_plan(
  p_key int, p_user uuid, p_address uuid, p_package uuid, p_qty int, p_trial boolean,
  p_dates date[], p_by text[], p_status text
) returns uuid language plpgsql as $f$
declare
  p v1.packages; o jsonb; q jsonb; chk uuid; sid uuid; did uuid; m text; meals text[]; i int; made timestamptz;
begin
  select * into p from v1.packages where id=p_package;
  o:=v1.offer(p);
  meals:=case o->>'meal' when 'both' then array['lunch','dinner'] else array[o->>'meal'] end;
  q:=v1.quote(p_user,jsonb_build_object('packageId',p_package,'addressId',p_address,'portions',p_qty,'trial',p_trial,'startDate','${farStart}','cycles',1));
  if jsonb_array_length(q->'dates')<>array_length(p_dates,1) then raise exception 'DEMO_STATE_DATES';end if;
  q:=jsonb_set(q,'{dates}',(select jsonb_agg(to_char(x,'YYYY-MM-DD') order by x) from unnest(p_dates) x));
  chk:=('ffff0001-0000-4000-8000-'||lpad(p_key::text,12,'0'))::uuid;
  sid:=('ffff0002-0000-4000-8000-'||lpad(p_key::text,12,'0'))::uuid;
  made:=((least(p_dates[1],'${today}'::date)-3)::timestamp+time '09:00') at time zone 'Asia/Jakarta';
  insert into v1.relationships values(p_user,p.caterer_id,'marketplace') on conflict do nothing;
  insert into v1.checkouts(id,user_id,package_id,address_id,quote,state,expires_at,created_at,terms_accepted_at,terms_version)
    values(chk,p_user,p_package,p_address,q,'paid',made+interval '30 minutes',made,made,'purchase-2026-09-20');
  insert into v1.subscriptions(id,checkout_id,user_id,package_id,snapshot,portions,starts_on,ends_on,status)
    values(sid,chk,p_user,p_package,q,p_qty,p_dates[1],p_dates[array_length(p_dates,1)],p_status);
  update v1.checkouts set subscription_id=sid where id=chk;
  insert into v1.reservations select chk,p_package,x,p_qty,'confirmed' from unnest(p_dates) x;
  insert into v1.capacity(package_id,service_date,slots) select p_package,x,100 from unnest(p_dates) x where x>='${today}'::date on conflict do nothing;
  for i in 1..array_length(p_dates,1) loop
    did:=('ffff0003-0000-4000-8000-'||lpad((p_key*100+i)::text,12,'0'))::uuid;
    insert into v1.delivery_days(id,subscription_id,service_date,address,status)
      values(did,sid,p_dates[i],q->'address',case when p_by[i] is null then 'scheduled' else 'delivered' end);
    foreach m in array meals loop
      insert into v1.fulfillments(day_id,meal,status,departed_at,confirmed_at,confirmed_by)
      select did,m,
        case when p_by[i] is null then 'scheduled' else 'delivered' end,
        case when p_by[i]='customer' then least(now(),(p_dates[i]+case m when 'lunch' then time '10:45' else time '17:30' end) at time zone 'Asia/Jakarta') end,
        case p_by[i]
          when 'customer' then least(now(),(p_dates[i]+case m when 'lunch' then time '11:20' else time '18:05' end) at time zone 'Asia/Jakarta')
          when 'auto' then least(now(),(case when p_dates[i]<'${today}'::date then (p_dates[i]+1)+time '00:30' else p_dates[i]+case m when 'lunch' then time '13:05' else time '19:05' end end) at time zone 'Asia/Jakarta') end,
        p_by[i];
    end loop;
  end loop;
  insert into v1.payments(checkout_id,provider_id,amount,state,created_at)
    values(chk,'demo-states-'||chk,(q->>'total')::int,'paid',made);
  insert into v1.allocations(checkout_id,caterer_id,amount)
    values(chk,p.caterer_id,greatest(0,(q->>'total')::int-(q->>'serviceFee')::int-(q->>'sellerFee')::int));
  return sid;
end $f$;

do $states$
declare
  nadia uuid:='${DEMO_ACTORS.customer}'; admin uuid:='${DEMO_ACTORS.platform_admin}'; addr uuid:='${ADDRESS_ID}';
  base jsonb; dish jsonb; dishes jsonb:='[]'; long jsonb; pick jsonb; c jsonb; i int; mine uuid[]:='{}';
begin
  if exists(select 1 from v1.audit where action='${MARKER}') then return;end if;
  perform set_config('catera.demo','true',true);
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  perform set_config('request.jwt.claim.sub',nadia::text,true);

  -- Direct plans for Nadia: history that no command can buy.
  insert into v1.addresses(id,user_id,label,line,area,city,instructions) values('${BANDUNG_ADDRESS}','${DEMO_ACTORS.customer}','Rumah Bandung','Jl. Contoh Dago No. 7, Coblong','Bandung','Bandung','Data sintetis. Alamat keluarga di Bandung.');
  ${plan(1, DEMO_ACTORS.customer, ADDRESS_ID, RANTANG, false, dueDays, dueBy, "active")}
  ${plan(2, DEMO_ACTORS.customer, BANDUNG_ADDRESS, IKAN, false, renewedDays, renewedBy, "active")}
  ${plan(3, DEMO_ACTORS.customer, ADDRESS_ID, SAMBAL, false, recentDays, recentBy, "completed")}
  ${plan(4, DEMO_ACTORS.customer, ADDRESS_ID, AYAM, false, oldDays, oldBy, "completed")}

  -- The other customers on Dapur Senja's route today.
  ${customers}

  -- Real commands as Nadia: the renewal of the Rumah Rasa plan and a trial, then two packages that only the demo has.
  c:=public.catera_v1_command('checkout.create',jsonb_build_object('acceptedTerms',true,'packageId','${IKAN}','addressId','${BANDUNG_ADDRESS}','portions',1,'startDate','${addDays(renewedDays[renewedDays.length - 1], 1)}','trial',false,'promo','','invite','','renewedFrom','${DEMO_STATE_IDS.renewed}'),gen_random_uuid());
  mine:=mine||(c->>'id')::uuid;
  perform public.catera_v1_command('checkout.demo_pay',jsonb_build_object('id',c->>'id'),gen_random_uuid());
  c:=public.catera_v1_command('checkout.create',jsonb_build_object('acceptedTerms',true,'packageId','${PLANT}','addressId',addr,'portions',1,'startDate','${addDays(today, 2)}','trial',true,'promo','','invite',''),gen_random_uuid());
  mine:=mine||(c->>'id')::uuid;
  perform public.catera_v1_command('checkout.demo_pay',jsonb_build_object('id',c->>'id'),gen_random_uuid());


  -- Two packages that exist only in the demo catalog: two weeks of lunch, and one where the customer picks the menu.
  -- They sit with Rumah Rasa so Dapur Senja's days and attention list stay its own. The platform admin signs for that
  -- kitchen for the length of this block, because the demo has no Rumah Rasa staff.
  insert into v1.staff values('${CATERER_IDS[2]}',admin,'owner');
  perform set_config('request.jwt.claim.sub',admin::text,true);
  select o into base from jsonb_array_elements(public.catera_v1_read('catalog','{}')->'items') o where o->>'id'='${IKAN}';
  long:=public.catera_v1_command('package.save',jsonb_build_object('catererId','${CATERER_IDS[2]}','slug','contoh-dua-pekan','offer',
    (base-'id'-'slug')||jsonb_build_object('name','Ikan Bumbu Kuning Dua Pekan','description','Paket contoh sintetis: dua minggu makan siang dalam satu pembelian. Data demonstrasi.','days',10)),gen_random_uuid());
  for i in 1..3 loop
    dish:=public.catera_v1_command('dish.save',jsonb_build_object('catererId','${CATERER_IDS[2]}','details',jsonb_build_object('name',(array['Ayam kecap contoh','Tahu bacem contoh','Pepes ikan contoh'])[i],'description','Hidangan contoh sintetis untuk demonstrasi.','image','','serving','120 g','categoryId','main')),gen_random_uuid());
    dishes:=dishes||to_jsonb(dish->>'id');
  end loop;
  pick:=public.catera_v1_command('package.save',jsonb_build_object('catererId','${CATERER_IDS[2]}','slug','contoh-pilih-sendiri','choiceDishIds',dishes,'offer',
    (base-'id'-'slug')||jsonb_build_object(
      'name','Pilih Sendiri Nusantara',
      'description','Paket contoh sintetis: pilih sendiri hidangan untuk setiap hari pengantaran. Data demonstrasi.',
      'menuSelectionMode','customer','packageType','nasi_box',
      'menus',jsonb_build_array(jsonb_build_object('contentModel','slots','meal','lunch','name','','description','','image','','items','[]'::jsonb,'composition',jsonb_build_array(jsonb_build_object('id','main','categoryId','main','name','Lauk','slots',2)))))),gen_random_uuid());
  delete from v1.staff where caterer_id='${CATERER_IDS[2]}' and user_id=admin;
  perform set_config('request.jwt.claim.sub',nadia::text,true);
  c:=public.catera_v1_command('checkout.create',jsonb_build_object('acceptedTerms',true,'packageId',long->>'id','addressId','${BANDUNG_ADDRESS}','portions',1,'startDate','${addDays(today, 3)}','trial',false,'promo','','invite',''),gen_random_uuid());
  mine:=mine||(c->>'id')::uuid;
  perform public.catera_v1_command('checkout.demo_pay',jsonb_build_object('id',c->>'id'),gen_random_uuid());
  c:=public.catera_v1_command('checkout.create',jsonb_build_object('acceptedTerms',true,'packageId',pick->>'id','addressId','${BANDUNG_ADDRESS}','portions',1,'startDate','${addDays(today, 3)}','trial',false,'promo','','invite',''),gen_random_uuid());
  mine:=mine||(c->>'id')::uuid;
  perform public.catera_v1_command('checkout.demo_pay',jsonb_build_object('id',c->>'id'),gen_random_uuid());

  -- Paid, with no subscription yet: the payment arrived and the plan has not been written.
  c:=public.catera_v1_command('checkout.create',jsonb_build_object('acceptedTerms',true,'packageId','${SAMBAL}','addressId',addr,'portions',1,'startDate','${addDays(today, 2)}','trial',false,'promo','','invite',''),gen_random_uuid());
  mine:=mine||(c->>'id')::uuid;
  update v1.checkouts set state='paid' where id=(c->>'id')::uuid;
  update v1.reservations set state='confirmed' where checkout_id=(c->>'id')::uuid;
  insert into v1.payments(checkout_id,provider_id,amount,state) select id,'demo-'||id,(quote->>'total')::int,'paid' from v1.checkouts where id=(c->>'id')::uuid;

  -- A purchase that is paid must not also say its payment is unfinished.
  delete from v1.outbox where kind='push' and dedupe in(select id::text from v1.notifications where user_id=nadia and kind='payment' and href in(select '/payment/'||x from unnest(mine) x));
  delete from v1.notifications where user_id=nadia and kind='payment' and href in(select '/payment/'||x from unnest(mine) x);

  insert into v1.audit(action,details) values('${MARKER}',jsonb_build_object('day','${today}','synthetic',true));
end $states$;

drop function pg_temp.demo_plan(int,uuid,uuid,uuid,int,boolean,date[],text[],text);
`;
}

/** Add the demo states once. Safe to call again: a marker in the audit trail says they are already there. */
export async function applyDemoStates(db: PGlite, today = localDay()) {
  await db.exec(demoStatesSQL(today));
}
