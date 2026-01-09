declare module 'bcryptjs' {
  export function genSaltSync(rounds?: number): string;
  export function hashSync(s: string, salt: string | number): string;
  export function compareSync(s: string, hash: string): boolean;

  // Async variants: support callback-style and Promise-style usage
  export function genSalt(rounds?: number): Promise<string>;
  export function genSalt(rounds: number, cb: (err: Error | null, salt: string) => void): void;

  export function hash(s: string, salt: string | number): Promise<string>;
  export function hash(s: string, salt: string | number, cb: (err: Error | null, hash: string) => void): void;

  export function compare(s: string, hash: string): Promise<boolean>;
  export function compare(s: string, hash: string, cb: (err: Error | null, same: boolean) => void): void;

  const bcrypt: {
    genSaltSync: typeof genSaltSync;
    hashSync: typeof hashSync;
    compareSync: typeof compareSync;
    genSalt: typeof genSalt;
    hash: typeof hash;
    compare: typeof compare;
  };
  export default bcrypt;
}
