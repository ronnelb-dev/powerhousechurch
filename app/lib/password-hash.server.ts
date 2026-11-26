type Argon2Options = {
  memoryCost: number;
  timeCost: number;
  outputLen: number;
  parallelism: number;
};

export type PasswordHashFunction = (
  password: string,
  options?: Argon2Options,
) => Promise<string>;

export type PasswordVerifyFunction = (
  hash: string,
  password: string,
  options?: Argon2Options,
) => Promise<boolean>;

export const PASSWORD_HASH_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} satisfies Argon2Options;

export async function hashPassword(password: string) {
  const { hash } = await import("@node-rs/argon2");
  return hash(password, PASSWORD_HASH_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  const { verify } = await import("@node-rs/argon2");
  return verify(passwordHash, password, PASSWORD_HASH_OPTIONS);
}
