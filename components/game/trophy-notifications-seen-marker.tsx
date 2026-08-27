"use client";

import { useEffect, useRef } from "react";

import { markTrophyNotificationsSeenAction } from "@/app/jeu/objectifs/actions";

export function TrophyNotificationsSeenMarker() {
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    void markTrophyNotificationsSeenAction();
  }, []);

  return null;
}
