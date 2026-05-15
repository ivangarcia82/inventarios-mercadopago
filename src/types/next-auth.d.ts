// src/types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: string;
    organizationId: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      organizationId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    organizationId: string;
  }
}
