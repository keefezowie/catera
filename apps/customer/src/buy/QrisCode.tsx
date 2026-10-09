import { useRef } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { themedStyles } from "@catera/mobile-ui";

type QrRef = { toDataURL: (callback: (data: string) => void) => void };

/** The QRIS code in a 232px surface box, plus a way to hand the image to a payment app. */
export function useQris() {
  const ref = useRef<QrRef | null>(null);
  /** Shares the QR as a PNG so it can be saved to the gallery and picked in a bank app on this phone. */
  async function save(checkoutId: string) {
    if (!(await Sharing.isAvailableAsync()) || !ref.current) throw new Error("SHARE_UNAVAILABLE");
    const data = await new Promise<string>((resolve) => ref.current!.toDataURL(resolve));
    const file = new File(Paths.cache, `catera-qris-${checkoutId}.png`);
    file.write(data, { encoding: "base64" });
    try {
      await Sharing.shareAsync(file.uri, { mimeType: "image/png", dialogTitle: "QRIS Catera" });
    } finally {
      if (file.exists) file.delete();
    }
  }
  return { ref, save };
}

export function QrisCode({ value, label, qrRef }: { value: string; label: string; qrRef: { current: QrRef | null } }) {
  const styles = useStyles();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.box}>
      <QRCode
        value={value}
        size={200}
        quietZone={8}
        backgroundColor="#FFFFFF"
        getRef={(r) => {
          qrRef.current = r as QrRef | null;
        }}
      />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  box: {
    alignSelf: "center",
    width: 232,
    height: 232,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    // The quiet zone stays pure white in every theme: scanners need dark modules on a light field.
    backgroundColor: "#FFFFFF",
  },
}));
