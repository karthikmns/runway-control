import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

class HapticsController {
  enabled = true;

  private vibrateWeb(pattern: number | number[]) {
    if (!this.enabled) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {
      // Ignore browser vibrate errors
    }
  }

  light() {
    if (!this.enabled) return;
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    } else {
      this.vibrateWeb(10);
    }
  }

  lock() {
    if (!this.enabled) return;
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    } else {
      this.vibrateWeb([12, 22, 16]);
    }
  }

  orbit() {
    if (!this.enabled) return;
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    } else {
      this.vibrateWeb([14, 18, 14]);
    }
  }

  emp() {
    if (!this.enabled) return;
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    } else {
      this.vibrateWeb([22, 15, 28]);
    }
  }

  touchdown() {
    if (!this.enabled) return;
    if (Capacitor.isNativePlatform()) {
      Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    } else {
      this.vibrateWeb(18);
    }
  }

  warn() {
    if (!this.enabled) return;
    if (Capacitor.isNativePlatform()) {
      Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
    } else {
      this.vibrateWeb([15, 25, 15]);
    }
  }

  crash() {
    if (!this.enabled) return;
    if (Capacitor.isNativePlatform()) {
      Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    } else {
      this.vibrateWeb([55, 30, 100]);
    }
  }
}

export const haptics = new HapticsController();
