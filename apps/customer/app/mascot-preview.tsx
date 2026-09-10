import { useState } from "react";
import { Redirect } from "expo-router";
import { ScrollView, Text, View, Button } from "react-native";
import { MascotAnimation, MascotLoading } from "../src/mascot-loading";
export default function MascotPreview() {
  const [active, setActive] = useState(true);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 24 }}>Gerak maskot Catera</Text>
      <Button
        title={active ? "Jeda" : "Putar"}
        onPress={() => setActive(!active)}
      />
      {["#FFF7E9", "#FFFFFF", "#163D2E"].map((background) => (
        <View
          key={background}
          style={{
            backgroundColor: background,
            padding: 24,
            alignItems: "center",
          }}
        >
          <MascotAnimation active={active} />
        </View>
      ))}
      <MascotLoading active={active} />
    </ScrollView>
  );
}
