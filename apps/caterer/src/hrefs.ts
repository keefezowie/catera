/**
 * Links to detail screens that carry the name the caller already shows, as `title`, so the native header is final on
 * the first frame instead of showing a generic name ("Pelanggan", "Paket", "Laporan masalah") until the record loads.
 * The screens read it back with `linkTitle` (`@catera/mobile-ui`), as the customer app's links do.
 */
const titled = (path: string, title: string) => (title ? `${path}?title=${encodeURIComponent(title)}` : path);

/** /pelanggan/{id}: a customer, named after themselves. */
export const customerHref = (id: string, name: string) => titled(`/pelanggan/${encodeURIComponent(id)}`, name);

/** /paket/{id}: a package, named after itself. */
export const packageHref = (id: string, name: string) => titled(`/paket/${encodeURIComponent(id)}`, name);

/** /laporan/{id}: a delivery report, named after the customer who sent it; untitled when the name is unknown. */
export const reportHref = (id: string, customerName: string | null | undefined) =>
  titled(`/laporan/${encodeURIComponent(id)}`, customerName ?? "");
