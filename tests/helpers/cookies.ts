// Stand-in for next/headers so services that set session cookies run under Vitest.
const jar = new Map<string, string>();
export const cookieJar = jar;

export const fakeCookies = {
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  set: (name: string, value: string) => {
    jar.set(name, value);
  },
  delete: (name: string) => {
    jar.delete(name);
  },
};
