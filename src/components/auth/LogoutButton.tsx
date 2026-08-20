"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function LogoutButton() {
  return (
    <Button
      type="button"
      $variant="ghost"
      $size="sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <Icon name="logout" size={16} />
      Log out
    </Button>
  );
}