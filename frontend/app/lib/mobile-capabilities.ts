"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import type { UserItem } from "./item-types";

interface SpeechInputPlugin {
  start(): Promise<{ text: string }>;
}

const SpeechInput = registerPlugin<SpeechInputPlugin>("SpeechInput");

function notificationId(itemId: string): number {
  let hash = 0;
  for (const character of itemId) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) || 1;
}

/** Return whether the app is running inside the native Android shell. */
export function hasNativeSpeechInput(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/** Start Android's system speech recognizer. */
export async function startNativeSpeechInput(): Promise<string> {
  const result = await SpeechInput.start();
  return result.text.trim();
}

/** Schedule a free local Android notification for an item reminder. */
export async function scheduleItemReminder(item: UserItem): Promise<boolean> {
  if (!item.remindAt || !Capacitor.isNativePlatform()) return false;
  const at = new Date(item.remindAt);
  if (at.getTime() <= Date.now()) return false;

  const permission = await LocalNotifications.checkPermissions();
  const resolvedPermission =
    permission.display === "granted"
      ? permission
      : await LocalNotifications.requestPermissions();
  if (resolvedPermission.display !== "granted") return false;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId(item.id),
        title: item.kind === "task" ? "Task reminder" : "Note reminder",
        body: item.text.slice(0, 180),
        schedule: { at },
        extra: { itemId: item.id },
      },
    ],
  });
  return true;
}

/** Cancel a previously scheduled local Android reminder. */
export async function cancelItemReminder(itemId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({
    notifications: [{ id: notificationId(itemId) }],
  });
}
