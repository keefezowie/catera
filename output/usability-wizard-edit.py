from pathlib import Path
p=Path('apps/web/src/components/seller.tsx')
s=p.read_text(encoding='utf-8')
s=s.replace('import { Plus, ArrowRight, ArrowUpRight, Package, Users } from "lucide-react";', 'import { Plus, ArrowRight, ArrowLeft, ArrowUpRight, Package, Users, ImageIcon, Wallet, CalendarDays, ClipboardCheck, Save, X, MessageCircle, LifeBuoy } from "lucide-react";\nimport { OptionalSection } from "./optional-section";\nimport { TagInput } from "./tag-input";')
s=s.replace('const [editing, setEditing] = useState<Offer | null | undefined>();', 'const [editing, setEditing] = useState<Offer | null | undefined>();\n  const [dirty, setDirty] = useState(false), [editorBusy, setEditorBusy] = useState(false), [discard, setDiscard] = useState(false);')
s=s.replace('if (!o) setEditing(undefined);', 'if (o || editorBusy) return;\n          if (dirty) setDiscard(true);\n          else setEditing(undefined);', 1)
s=s.replace('open={editing !== undefined}', 'className="package-dialog"\n        description={t("Siapkan paket selangkah demi selangkah. Draf dapat dilanjutkan nanti.", "Set up your package step by step. Save a draft to continue later.")}\n        open={editing !== undefined}',1)
s=s.replace('catererId={s.caterer.id}\n          done={() => setEditing(undefined)}','catererId={s.caterer.id}\n          onDirtyChange={setDirty}\n          onEditorBusyChange={setEditorBusy}\n          done={() => { setDirty(false); setEditing(undefined); }}',1)
a=s.index('function Packages('); b=s.index('function PackageLifecycle(',a)
part=s[a:b].replace('      </Dialog>\n', '''      </Dialog>
      <Dialog open={discard} onOpenChange={setDiscard} title={t("Tutup tanpa menyimpan?", "Close without saving?")} description={t("Perubahan terakhir belum disimpan. Kembali ke paket untuk menyimpan draf.", "Your latest changes are not saved. Return to the package to save a draft.")}>
        <div className="dialog-actions">
          <Button variant="primary" onClick={() => setDiscard(false)}>{t("Lanjut mengedit", "Keep editing")}</Button>
          <Button variant="secondary" onClick={() => { setDiscard(false); setDirty(false); setEditing(undefined); }}>{t("Buang perubahan", "Discard changes")}</Button>
        </div>
      </Dialog>
''',1)
s=s[:a]+part+s[b:]
a=s.index('function OfferEditor('); b=s.index('\nfunction Customers(',a)
e=s[a:b]
e=e.replace('  done,\n', '  done,\n  onDirtyChange,\n  onEditorBusyChange,\n',1).replace('  done: () => void;', '  done: () => void;\n  onDirtyChange: (dirty: boolean) => void;\n  onEditorBusyChange: (busy: boolean) => void;',1)
e=e.replace('  const [preview, setPreview]', '  const [saving, setSaving] = useState(false);\n  const [preview, setPreview]',1)
pos=e.index('\n  const set = ')
e=e[:pos]+'''
  const initialValue = useRef(JSON.stringify(value));
  const dirty = JSON.stringify(value) !== initialValue.current;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onEditorBusyChange(pending > 0 || saving || savingDraft); }, [pending, saving, savingDraft, onEditorBusyChange]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => {
    const fields = editor.current?.querySelector<HTMLElement>(".editor-fields");
    if (fields) fields.scrollTop = 0;
    editor.current?.querySelector<HTMLElement>(".editor-step-title")?.focus();
  }, [step]);
''' +e[pos:]
e=e.replace('offer: t("Penawaran", "Offer")','offer: t("Paket", "Package")').replace('contents: t("Isi paket & foto", "Contents & photos")','contents: t("Isi", "Contents")').replace('schedule: t("Hari & waktu", "Schedule")','schedule: t("Jadwal", "Schedule")').replace('    flexibility: t("Fleksibilitas", "Flexibility"),\n','').replace('review: t("Tinjau", "Review")','review: t("Periksa", "Review")')
e=e.replace('  const activeValue = {', '  const stepIcons = { offer: Package, contents: ImageIcon, pricing: Wallet, schedule: CalendarDays, review: ClipboardCheck };\n  const activeValue = {',1)
e=e.replace('    await perform("package.save", {','    setSaving(true);\n    try {\n    await perform("package.save", {',1).replace('    done();\n  };','    done();\n    } finally { setSaving(false); }\n  };',1)
x=e.index('            <Field\n              fieldKey="days"'); y=e.index('            <PackageNutritionEditor',x)
duration=e[x:y]; z=e.index('            />',y)+len('            />'); nutrition=e[y:z]; e=e[:x]+e[z:]
fx=e.index('            <Field\n              fieldKey="flexible"'); fy=e.index('            <Field\n              fieldKey="trialPrice"',fx)
flex=e[fx:fy]; fz=e.index('            <p className="notice">',fy); trial=e[fy:fz]
fs=e.index('        ) : step === "flexibility" ? ('); fe=e.index('        ) : step === "contents" ? (',fs); e=e[:fs]+e[fe:]
pricingend=e.index('        ) : step === "schedule" ? ('); close=e.rfind('          </>',0,pricingend)
e=e[:close]+'''            <OptionalSection title={t("Coba satu hari (opsional)", "One-day trial (optional)")} initiallyOpen={value.trialPrice !== null} invalid={!!fieldError("trialPrice") || !!fieldError("trialMax")}>
'''+trial+'''            <p className="field-hint">{t("Satu kali coba per pelanggan per katerer.", "One trial per customer per caterer.")}</p>
            </OptionalSection>
'''+e[close:]
sched=e.index('        ) : step === "schedule" ? ('); ins=e.index('          <>',sched)+len('          <>'); e=e[:ins]+'\n'+duration+flex+e[ins:]
dx=e.index('            <Field\n              fieldKey="tiers"'); dy=e.index('            <OptionalSection title={t("Coba satu hari',dx)
e=e[:dx]+'''            <OptionalSection title={t("Diskon jumlah porsi (opsional)", "Quantity discounts (optional)")} initiallyOpen={value.tiers.length > 0} invalid={!!fieldError("tiers")}>
'''+e[dx:dy]+'''            </OptionalSection>
'''+e[dy:]
e=e.replace('            <p>\n              {t(\n                "Untuk siang + malam', '            {value.meal === "both" && <p>\n              {t(\n                "Untuk siang + malam',1).replace('                "For lunch + dinner, this price covers both meals per portion per day.",\n              )}\n            </p>', '                "For lunch + dinner, this price covers both meals per portion per day.",\n              )}\n            </p>}',1)
tx=e.index('            <Field\n              fieldKey="tags"'); ty=e.index('\n            {!value.packageType',tx)
e=e[:tx]+'''            <TagInput value={value.tags} onChange={(tags) => set("tags", tags)} />
            <OptionalSection title={t("Informasi gizi (opsional)", "Nutrition (optional)")} initiallyOpen={!!value.nutrition} invalid={!!fieldError("nutrition")}>
'''+nutrition+'''\n            </OptionalSection>
'''+e[ty:]
footstart=e.index('        {step !== "offer" && ('); formend=e.index('      </ActionForm>',footstart)
draftstart=e.index('      <Button',formend); draftend=e.index('\n      </Button>',draftstart)+len('\n      </Button>')
draft=e[draftstart:draftend].replace('disabled={pending > 0 || savingDraft}', 'disabled={pending > 0 || savingDraft || formBusy || saving}').replace('        {savingDraft', '        <Save size={17} aria-hidden="true" />\n        {savingDraft')
footer='''        actions={(submitButton, formBusy) => <div className="editor-footer">
          <div className="editor-footer-main">
            <Button variant="secondary" type="button" disabled={step === "offer" || formBusy || pending > 0 || savingDraft} onClick={() => navigate(offerSteps[offerSteps.indexOf(step) - 1])}><ArrowLeft size={18} aria-hidden="true" />{t("Kembali", "Back")}</Button>
            {submitButton}
          </div>
'''+draft+'''
        </div>}
        submitIcon={step === "review" ? <Save size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
'''
e=e[:footstart]+'''        {saveError && <ErrorNotice message={saveError} />}
        </div>
      </ActionForm>'''+e[draftend:]
e=e.replace('      <ActionForm\n', '      <ActionForm\n'+footer,1)
e=e.replace('        {!!issues.length && (','        <div className="editor-fields">\n        <h3 className="editor-step-title" tabIndex={-1}>{labels[step]}</h3>\n        {!!issues.length && (',1)
e=e.replace(': t("Simpan paket", "Save package")', ': value.status === "published" ? t("Tayangkan paket", "Publish package") : t("Simpan paket", "Save package")',1)
px=e.index('      <div\n        className="editor-progress"'); py=e.index('      <ActionForm',px)
e=e[:px]+'''      <div className="editor-progress" aria-label={t("Langkah paket", "Package steps")}>
        {offerSteps.map((i, order) => { const Icon = stepIcons[i]; return <Button type="button" key={i} className={i === step ? "selected" : ""} disabled={pending > 0 || savingDraft || saving} aria-current={i === step ? "step" : undefined} onClick={() => navigate(i)}><Icon size={20} aria-hidden="true" /><span>{order + 1}. {labels[i]}</span></Button>; })}
      </div>
      <div className="editor-mobile-progress">
        <span>{t("Langkah", "Step")} {offerSteps.indexOf(step) + 1} / {offerSteps.length}</span>
        <Select aria-label={t("Langkah paket", "Package steps")} value={step} disabled={pending > 0 || savingDraft || saving} onValueChange={(next) => navigate(next as OfferStep)}>{offerSteps.map((i, order) => <SelectOption key={i} value={i}>{order + 1}. {labels[i]}</SelectOption>)}</Select>
      </div>
'''+e[py:]
s=s[:a]+e+s[b:]
p.write_text(s,encoding='utf-8')

