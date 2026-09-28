import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      closeButton
      toastOptions={{
        style: {
          border: "1px solid #e6e8ee",
          borderRadius: 10,
          boxShadow: "0 12px 32px rgba(16, 24, 40, 0.12)",
          fontSize: 13,
        },
      }}
    />
  );
}
