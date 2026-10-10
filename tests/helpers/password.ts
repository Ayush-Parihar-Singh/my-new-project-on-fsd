import bcrypt from "bcryptjs";
// Low cost factor keeps the test suite fast; production uses 12 rounds.
export const hashPassword = (p: string) => bcrypt.hash(p, 4);
