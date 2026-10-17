-- Phase G copy pass (G18): every push body in the kamu register, katering for the business, pengantaran for a delivery,
-- no formal words and no claim the system cannot back ("Perpanjang tanpa jeda").
--   Customer pushes keep the title "Catera"; pushes under /seller keep "Catera Dapur" (apps/web/src/lib/push-dispatch.ts).
-- The bodies live inside commands and triggers that earlier migrations re-created many times, some of them by patching
-- the live definition. So nothing here is copied from an old file: the live definition of every function that holds an
-- old body is read back, the body is replaced, and the function is re-created in place (the same way
-- 20261014110000_push_events.sql changed the generic delivery pushes). No applied migration is edited.
--
-- Two choice-menu pushes printed the service date as 2026-10-13. They now say "Selasa 13 Okt" through v1.push_day.

create function v1.push_day(d date) returns text
language sql immutable set search_path='' as $$
 select (array['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[extract(dow from d)::int+1]
  ||' '||extract(day from d)::int||' '
  ||(array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month from d)::int]
$$;
revoke all on function v1.push_day(date) from public, anon, authenticated;

do $$ declare
 f record; d text; i int;
 olds text[]:=array[
  -- customer
  $o$Paket Anda sudah aktif. Lihat jadwal makanan berikutnya.$o$,
  $o$Perubahan pengantaran sudah tersimpan.$o$,
  $o$Permintaan bantuan Anda diperbarui.$o$,
  $o$Pesan baru dari katerer.$o$,
  $o$Menu pengantaran Anda diperbarui.$o$,
  $o$Besok ada makanan untuk Anda. Periksa menu dan alamatnya.$o$,
  $o$Pengembalian dana sudah diproses.$o$,
  $o$Paket hampir selesai. Pilih makanan untuk hari-hari berikutnya.$o$,
  $o$ tinggal 3 hari. Perpanjang tanpa jeda.$o$,
  $o$Pilih menu untuk pengantaran Anda sebelum batas waktu. Jika belum memilih, katerer menentukan hidangannya.$o$,
  $o$r.service_date||' · '||case when r.meal='lunch' then 'Siang: ' else 'Malam: ' end||case when mode='reminder' then 'Pilih menu sebelum batas waktu; jika belum memilih, katerer menentukan hidangannya.' else 'Batas waktu telah lewat. Katerer memilih hidangan Anda; pengantaran tetap berjalan.' end$o$,
  $o$Pembayaran belum selesai. Lanjutkan pembayaran sebelum batas waktu.$o$,
  $o$Pembayaran gagal. Periksa status sebelum meninjau pembelian kembali.$o$,
  $o$Waktu pembayaran habis. Periksa status dan tinjau ulang ketersediaan.$o$,
  $o$Pembayaran memerlukan peninjauan Catera. Jangan melakukan pembayaran ulang untuk pesanan ini.$o$,
  $o$Katerer menandai kendala pengantaran selesai. Anda tetap dapat meminta Catera meninjau.$o$,
  $o$Kendala pengantaran Anda diperbarui.$o$,
  -- catering (Catera Dapur)
  $o$Langganan baru: $o$,
  $o$Ada permintaan bantuan baru.$o$,
  $o$Ada kendala pada pengantaran. Tinjau dan tanggapi.$o$,
  $o$r.service_date||' · '||r.meal||': Pelanggan belum memilih menu. Tentukan hidangan dan komunikasikan kepada pelanggan.'$o$,
  $o$Status rekening pencairan diperbarui.$o$,
  $o$Permintaan akun diperbarui.$o$
 ];
 news text[]:=array[
  $n$Paketmu sudah aktif. Cek jadwal antar berikutnya.$n$,
  $n$Perubahan pengantaranmu sudah kami simpan.$n$,
  $n$Ada kabar baru soal permintaan bantuanmu.$n$,
  $n$Ada pesan baru dari katering.$n$,
  $n$Katering mengubah menu pengantaranmu.$n$,
  $n$Besok ada makanan untukmu. Cek menu dan alamatnya.$n$,
  $n$Pengembalian danamu sudah diproses.$n$,
  $n$Paketmu hampir selesai. Perpanjang kalau mau lanjut.$n$,
  $n$ tinggal 3 hari lagi. Perpanjang kalau mau lanjut.$n$,
  $n$Pilih menu pengantaranmu sebelum batas waktu. Kalau belum memilih, katering yang memilihkan.$n$,
  $n$case when mode='reminder' then 'Menu '||case when r.meal='lunch' then 'siang ' else 'malam ' end||v1.push_day(r.service_date)||' belum dipilih. Pilih sebelum batas waktu, atau katering yang memilihkan.' else 'Batas memilih menu '||case when r.meal='lunch' then 'siang ' else 'malam ' end||v1.push_day(r.service_date)||' sudah lewat, jadi katering yang memilihkan. Pengantaran tetap jalan.' end$n$,
  $n$Pembayaranmu belum selesai. Selesaikan sebelum waktunya habis.$n$,
  $n$Pembayaran gagal. Cek statusnya sebelum mencoba beli lagi.$n$,
  $n$Waktu bayar habis. Kalau mau beli lagi, cek dulu jadwal yang masih tersedia.$n$,
  $n$Pembayaranmu sedang dicek Catera. Jangan bayar ulang untuk pesanan ini.$n$,
  $n$Katering menandai masalah pengantaranmu selesai. Kalau belum beres, kamu masih bisa minta Catera meninjau.$n$,
  $n$Ada kabar baru soal laporan pengantaranmu.$n$,
  $n$Pesanan baru: $n$,
  $n$Ada pertanyaan baru dari pelanggan.$n$,
  $n$Pelanggan melaporkan masalah pengantaran. Buka untuk membalas.$n$,
  $n$case when r.meal='lunch' then 'Siang' else 'Malam' end||' '||v1.push_day(r.service_date)||': pelanggan belum memilih menu. Pilihkan hidangannya, lalu kabari pelanggan.'$n$,
  $n$Status rekening pencairanmu berubah. Buka untuk melihat hasilnya.$n$,
  $n$Ada kabar baru soal permintaan akunmu.$n$
 ];
begin
 if array_length(olds,1) is distinct from array_length(news,1) then raise exception 'PUSH_COPY_PAIRS';end if;
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('public','v1') and p.prokind='f'
   and exists(select 1 from unnest(olds) o where position(o in p.prosrc)>0)
 loop
  d:=pg_get_functiondef(f.oid);
  for i in 1..array_length(olds,1) loop d:=replace(d,olds[i],news[i]);end loop;
  execute d;
 end loop;
 -- A body that survived means a live function was missed; the migration stops rather than ship the old words.
 for i in 1..array_length(olds,1) loop
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in('public','v1') and p.prokind='f' and position(olds[i] in p.prosrc)>0)
  then raise exception 'PUSH_COPY_ANCHOR_MISSING';end if;
 end loop;
 -- And no notify call in any live function still carries a retired fragment, whatever the exact old text was.
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('public','v1') and p.prokind='f'
   and p.prosrc ~ $re$(notify|beta_notify_once)\([^;]*(\mAnda\M|[Kk]aterer|service_date\|\|' · ')$re$)
 then raise exception 'PUSH_COPY_RETIRED_FRAGMENT';end if;
end $$;
