import type { DefaultSession } from "next-auth";
import type { Role } from "@/features/auth/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      superAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    superAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    superAdmin?: boolean;
  }
}
