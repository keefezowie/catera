
/**
 * Official marks by catalogue logo key (`PaymentMethodInfo.logo`), fetched 2026-10-27; sources, licence notes and
 * alpha are in `packages/brand/assets/payment/manifest.json`. Metro needs each `require` spelled out. A key with no
 * mark shows its group glyph.
 */
const LOGOS: Record<string, number> = {
  akulaku: require("../../../../packages/brand/assets/payment/akulaku.png"),
  alfamart: require("../../../../packages/brand/assets/payment/alfamart.png"),
  bca: require("../../../../packages/brand/assets/payment/bca.png"),
  bjb: require("../../../../packages/brand/assets/payment/bjb.png"),
  bnc: require("../../../../packages/brand/assets/payment/bnc.png"),
  bni: require("../../../../packages/brand/assets/payment/bni.png"),
  bri: require("../../../../packages/brand/assets/payment/bri.png"),
  bsi: require("../../../../packages/brand/assets/payment/bsi.png"),
  btn: require("../../../../packages/brand/assets/payment/btn.png"),
  cimb: require("../../../../packages/brand/assets/payment/cimb.png"),
  dana: require("../../../../packages/brand/assets/payment/dana.png"),
  danamon: require("../../../../packages/brand/assets/payment/danamon.png"),
  doku: require("../../../../packages/brand/assets/payment/doku.png"),
  indodana: require("../../../../packages/brand/assets/payment/indodana.png"),
  indomaret: require("../../../../packages/brand/assets/payment/indomaret.png"),
  kredivo: require("../../../../packages/brand/assets/payment/kredivo.png"),
  linkaja: require("../../../../packages/brand/assets/payment/linkaja.png"),
  mandiri: require("../../../../packages/brand/assets/payment/mandiri.png"),
  ovo: require("../../../../packages/brand/assets/payment/ovo.png"),
  permata: require("../../../../packages/brand/assets/payment/permata.png"),
  qris: require("../../../../packages/brand/assets/payment/qris.png"),
  sampoerna: require("../../../../packages/brand/assets/payment/sampoerna.png"),
  shopeepay: require("../../../../packages/brand/assets/payment/shopeepay.png"),
  sinarmas: require("../../../../packages/brand/assets/payment/sinarmas.png"),
  visa: require("../../../../packages/brand/assets/payment/visa.png"),
};

export function paymentLogo(key: string): number | undefined {
  return LOGOS[key];
}
