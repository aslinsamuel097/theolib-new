import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.theolib.app',
  appName: 'TheoLib',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    url: 'https://theolib-1677e.web.app', 
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
