"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import type { UserItem } from "./item-types";

function notificationId(itemId: string): number {
  let hash = 0;
  for (const character of itemId) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) || 1;
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
