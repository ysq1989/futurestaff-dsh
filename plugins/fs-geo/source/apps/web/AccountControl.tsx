import { useEffect, useId, useRef, useState } from "react";
import { IconChevronDown, IconLogout } from "@tabler/icons-react";

export function AccountControl({
  name,
  role,
  onLogout,
}: {
  name: string;
  role: string;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className="account-area"
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="account-trigger"
        aria-label="账户菜单"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="account-avatar" aria-hidden="true">
          {name.slice(0, 1)}
        </span>
        <span className="account-copy">
          <strong title={name}>{name}</strong>
          <small>{role}</small>
        </span>
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div id={id} className="account-popover">
          <strong>{name}</strong>
          <small>{role}</small>
          <button onClick={() => void onLogout()}>
            <IconLogout size={16} />
            返回 DSH
          </button>
        </div>
      )}
    </div>
  );
}
