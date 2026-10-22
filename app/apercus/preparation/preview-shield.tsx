"use client";

export function PreviewShield({ children }: { children: React.ReactNode }) {
  return <div onSubmitCapture={event => event.preventDefault()}>{children}</div>;
}
