import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.lenny.alarmclock",
  appName: "Alarm Clock",
  webDir: "dist",
  plugins: { CapacitorHttp: { enabled: true } },
  ios: { backgroundColor: "#000000" },
};
export default config;
