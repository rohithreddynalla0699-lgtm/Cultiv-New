import { ReactNode } from "react";
import { createPortal } from "react-dom";

export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof window === "undefined") return null;
  const mount = document.getElementById("modal-root") || document.body;
  return createPortal(children, mount);
}
