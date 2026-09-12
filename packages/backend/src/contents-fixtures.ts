// Explicit local demo examples only. Never applied by a hosted migration.
export function contentsFixturesSQL() {
  const dish = (
    id: string,
    name: string,
    serving: string,
    groupId?: string,
  ) => ({
    id,
    name,
    serving,
    description: "",
    image: "",
    ...(groupId ? { groupId } : {}),
  });
  const examples = [
    {
      slug: "demo-ala-carte-tunggal",
      name: "Demo · Ayam panggang ala carte",
      packageType: "ala_carte",
      composition: [],
      items: [dish("ayam", "Ayam panggang", "150 g")],
      nutrition: null,
    },
    {
      slug: "demo-ala-carte-lengkap",
      name: "Demo · Ayam dan tempe ala carte",
      packageType: "ala_carte",
      composition: [],
      items: [
        dish("ayam", "Ayam panggang", "150 g"),
        dish("tempe", "Tempe bacem", "2 potong"),
      ],
      nutrition: { proteinG: 42 },
    },
    {
      slug: "demo-nasi-box",
      name: "Demo · Nasi box lengkap",
      packageType: "nasi_box",
      composition: [
        { id: "nasi", name: "Nasi", slots: 1 },
        { id: "lauk", name: "Lauk", slots: 2 },
        { id: "sayur", name: "Sayur", slots: 1 },
        { id: "sup", name: "Sup", slots: 1 },
        { id: "buah", name: "Buah segar", slots: 1 },
      ],
      items: [
        dish("nasi", "Nasi merah", "150 g", "nasi"),
        dish("ayam", "Ayam panggang", "150 g", "lauk"),
        dish("tempe", "Tempe bacem", "2 potong", "lauk"),
        dish("sayur", "Tumis buncis", "100 g", "sayur"),
        dish("sup", "Sup jagung", "150 ml", "sup"),
        dish("buah", "Pepaya", "100 g", "buah"),
      ],
      nutrition: { caloriesKcal: 650, proteinG: 45, carbsG: 72, fatG: 18 },
    },
  ];
  return `do $$ declare p v1.packages; begin
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
  select * into p from v1.packages where id='20000000-0000-4000-8000-000000000001';
  ${examples
    .map(({ slug, name, packageType, composition, items, nutrition }) => {
      const offer = {
        status: "published",
        name,
        description:
          "Contoh sintetis untuk menjelajahi isi paket. Foto dan nilai gizi adalah data demonstrasi.",
        packageType,
        nutrition,
        menus: [
          {
            name: items.map((i) => i.name).join(", "),
            description: "Contoh sintetis",
            image: "/assets/food/ayam-panggang.png",
            meal: "lunch",
            composition,
            items,
          },
        ],
      };
      return `if not exists(select 1 from v1.packages where slug='${slug}') then perform public.catera_v1_command('package.save',jsonb_build_object('catererId',p.caterer_id,'slug','${slug}','offer',p.offer || '${JSON.stringify(offer).replaceAll("'", "''")}'::jsonb),gen_random_uuid());end if;`;
    })
    .join("\n")}
  end $$;`;
}
