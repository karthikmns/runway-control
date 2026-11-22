import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.karthikmns.runwaycontrol',
  appName: 'Runway Control',
  webDir: 'dist',
  backgroundColor: '#071b2c',
  android: {
    backgroundColor: '#071b2c',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      overlaysWebView: true,
    },
  },
};

export default config;
