// Déclarations TypeScript globales pour éviter les erreurs avant l'installation

declare module 'express' {
  export interface Request {
    body: any;
    params: any;
    query: any;
    headers: any;
  }
  export interface Response {
    status: (code: number) => Response;
    json: (data: any) => Response;
    send: (data: any) => Response;
    setHeader: (name: string, value: string) => void;
  }
  export interface NextFunction {
    (err?: any): void;
  }
  export interface Router {}
  export function Router(): Router;
}

declare module 'multer' {
  export interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
  }
  export interface FileFilterCallback {
    (error: Error | null, acceptFile?: boolean): void;
  }
  export function diskStorage(options: any): any;
  export default function multer(options: any): any;
}

declare namespace Express {
  export interface Multer {
    File: any;
  }
}

declare module 'path' {
  export function extname(path: string): string;
}

declare module 'bcrypt' {
  export function hash(data: string, saltOrRounds: number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}

declare module 'jsonwebtoken' {
  export function sign(payload: any, secret: string, options?: any): string;
  export function verify(token: string, secret: string): any;
}

declare module 'cors' {
  export default function cors(options?: any): any;
}

declare module 'helmet' {
  export default function helmet(): any;
}

declare module 'express-rate-limit' {
  export default function rateLimit(options: any): any;
}

declare module 'swagger-jsdoc' {
  export interface Options {
    definition: any;
    apis: string[];
  }
  export default function swaggerJsdoc(options: Options): any;
}

declare module 'swagger-ui-express' {
  export const serve: any;
  export function setup(spec: any, options?: any): any;
}

declare module 'puppeteer' {
  export function launch(options?: any): Promise<Browser>;
  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }
  export interface Page {
    setContent(html: string, options?: any): Promise<void>;
    pdf(options?: any): Promise<Uint8Array>;
  }
}

declare module 'dotenv' {
  export function config(): void;
}

declare module '@prisma/client' {
  export class PrismaClient {
    constructor(options?: any);
    $disconnect(): Promise<void>;
    user: any;
    sousLocalite: any;
    section: any;
    rencontreType: any;
    rencontre: any;
  }
}

declare var console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
};

declare var process: {
  env: { [key: string]: string | undefined };
};

declare class Buffer {
  static from(data: any): Buffer;
}
