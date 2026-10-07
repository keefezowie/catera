/** Android and iOS app-link files for the Catera customer app. Signing fingerprints and the
 * Apple team id come from deployment env at request time, so none is committed; with the
 * env unset both files stay valid and claim nothing (links keep opening on the web). */
const PACKAGE = "id.catera.customer";
const PATHS = ["/claim/*", "/renew/*"];

export function assetLinks(fingerprints = process.env.CATERA_ANDROID_SHA256 ?? "") {
  const list = fingerprints
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!list.length) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: PACKAGE, sha256_cert_fingerprints: list },
    },
  ];
}

export function appleAppSiteAssociation(team = process.env.CATERA_APPLE_TEAM_ID ?? "") {
  const id = team.trim();
  return {
    applinks: {
      details: id
        ? [{ appIDs: [`${id}.${PACKAGE}`], components: PATHS.map((path) => ({ "/": path })) }]
        : [],
    },
  };
}
