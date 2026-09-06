"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

/** Password input with show/hide (ux-designer: never make users guess mask state). */
export function PasswordInput({
  id,
  name,
  required,
  minLength,
  placeholder,
  ariaDescribedBy,
  defaultValue,
}: {
  id: string;
  name: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  ariaDescribedBy?: string;
  defaultValue?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={name === "confirmPassword" ? "new-password" : "current-password"}
        aria-describedby={ariaDescribedBy}
        defaultValue={defaultValue}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
