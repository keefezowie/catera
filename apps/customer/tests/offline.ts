import NetInfo from "@react-native-community/netinfo";
import { bannerTime } from "@catera/mobile-ui";

type Net = { __set: (state?: { isConnected: boolean | null; isInternetReachable?: boolean | null }) => void };
const net = NetInfo as unknown as Net;

/** The phone reports no connection (the NetInfo stand-in in setup.cjs answers the banner's first read with this). */
export const goOffline = () => net.__set({ isConnected: false, isInternetReachable: false });
/** The phone is back online; call it after a test that went offline. */
export const goOnline = () => net.__set();
/** The line the connection banner prints for a copy kept at `iso`: the phone's clock, "Menampilkan data terakhir, HH.MM". */
export const keptLine = (iso: string) => `Menampilkan data terakhir, ${bannerTime(new Date(iso))}`;
