"use client";

import dynamic from "next/dynamic";

// Saved threads are read from browser storage, so the chat renders only in the browser.
const Chat = dynamic(() => import("./chat"), { ssr: false });

export default function Home() {
  return <Chat />;
}
