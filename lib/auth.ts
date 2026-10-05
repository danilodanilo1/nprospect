import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import User from "@/models/User";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        await connectDB();

        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
          const adminEmail = process.env.ADMIN_EMAIL;
          const adminPassword = process.env.ADMIN_PASSWORD;

          if (
            adminEmail &&
            adminPassword &&
            email.toLowerCase() === adminEmail.toLowerCase() &&
            password === adminPassword
          ) {
            user = await User.create({
              name: "Administrador",
              email: adminEmail.toLowerCase(),
              passwordHash: await bcrypt.hash(adminPassword, 12),
              role: "admin",
              defaultRegion: process.env.DEFAULT_SEARCH_REGION,
            });
          } else {
            return null;
          }
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
