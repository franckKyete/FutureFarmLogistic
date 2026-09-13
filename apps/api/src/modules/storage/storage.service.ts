import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

export interface StorageUploadResult {
  key: string;
  url: string;
  signedUrl: string;
  bucket: string;
}

export interface StoragePortInterface {
  upload(buffer: Buffer, filename: string, mimeType: string): Promise<string>;
  delete(url: string): Promise<void>;
  getSignedUrl?(keyOrUrl: string, expiresIn?: number): Promise<string>;
}

@Injectable()
export class StorageService implements OnModuleInit, StoragePortInterface {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string | undefined;
  private readonly publicEndpoint: string | undefined;
  private readonly isS3Configured: boolean;
  private readonly defaultExpirySeconds: number;
  private readonly localStorageDir: string;

  constructor(private readonly config: ConfigService) {
    this.bucket =
      this.config.get<string>('S3_BUCKET') ||
      this.config.get<string>('AWS_S3_BUCKET') ||
      this.config.get<string>('STORAGE_BUCKET') ||
      'futurefarm-storage';

    this.region =
      this.config.get<string>('S3_REGION') ||
      this.config.get<string>('AWS_REGION') ||
      this.config.get<string>('STORAGE_REGION') ||
      'eu-west-1';

    this.endpoint =
      this.config.get<string>('S3_ENDPOINT') ||
      this.config.get<string>('AWS_ENDPOINT') ||
      this.config.get<string>('AWS_S3_ENDPOINT') ||
      undefined;

    this.publicEndpoint =
      this.config.get<string>('S3_PUBLIC_ENDPOINT') ||
      this.config.get<string>('AWS_S3_PUBLIC_ENDPOINT') ||
      this.config.get<string>('STORAGE_PUBLIC_ENDPOINT') ||
      this.endpoint;

    this.defaultExpirySeconds = Number(
      this.config.get<string>('S3_SIGNED_URL_EXPIRES_IN') || '86400', // 24 hours default
    );

    const accessKeyId =
      this.config.get<string>('S3_ACCESS_KEY_ID') ||
      this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey =
      this.config.get<string>('S3_SECRET_ACCESS_KEY') ||
      this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const forcePathStyle =
      this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true' ||
      Boolean(this.endpoint);

    if (accessKeyId && secretAccessKey) {
      this.isS3Configured = true;
      const clientConfig: Record<string, any> = {
        region: this.region,
        forcePathStyle,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      };
      if (this.endpoint) {
        clientConfig.endpoint = this.endpoint;
      }
      this.s3Client = new S3Client(clientConfig);
      this.logger.log(
        `[StorageService] S3 Client initialized with bucket: ${this.bucket}, region: ${this.region}, endpoint: ${this.endpoint || 'AWS standard'}, publicEndpoint: ${this.publicEndpoint || 'auto'}`,
      );
    } else {
      // In development or when credentials are not yet set in .env, initialize local fallback
      this.isS3Configured = false;
      this.logger.warn(
        `[StorageService] AWS/S3 credentials not fully provided. Falling back to local storage with mock secured URLs. Set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY to use live S3 bucket.`,
      );
    }

    this.localStorageDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(this.localStorageDir)) {
      fs.mkdirSync(this.localStorageDir, { recursive: true });
    }
  }

  onModuleInit() {
    this.logger.log(`[StorageService] Storage module initialized.`);
  }

  /**
   * Uploads a file buffer to S3 (or local fallback) and returns the S3 key, direct URL, and signed URL.
   */
  async uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    folder = 'uploads',
  ): Promise<StorageUploadResult> {
    const cleanFilename = filename
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${cleanFilename}`;

    if (this.isS3Configured && this.s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        });

        await this.s3Client.send(command);
        const signedUrl = await this.getSignedUrl(key);

        this.logger.log(`[StorageService] File uploaded successfully to S3: ${key}`);
        return {
          key,
          url: signedUrl,
          signedUrl,
          bucket: this.bucket,
        };
      } catch (err: any) {
        this.logger.error(`[StorageService] Failed uploading to S3: ${err.message}`, err.stack);
        throw err;
      }
    }

    // Local file fallback for local development
    const destFolder = path.join(this.localStorageDir, folder);
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }
    const destPath = path.join(this.localStorageDir, key);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    await fs.promises.writeFile(destPath, buffer);

    const localUrl = `/uploads/${key}`;
    return {
      key,
      url: localUrl,
      signedUrl: localUrl,
      bucket: this.bucket,
    };
  }

  /**
   * Implements StoragePortInterface.upload for backwards compatibility.
   */
  async upload(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const result = await this.uploadFile(buffer, filename, mimeType, 'proofs');
    return result.signedUrl || result.url;
  }

  /**
   * Generates a secured presigned GET URL for an S3 object key or full S3 URL.
   */
  async getSignedUrl(keyOrUrl: string, expiresInSeconds = this.defaultExpirySeconds): Promise<string> {
    if (!keyOrUrl) return '';

    // If it's a data URI or external third-party avatar (e.g. ui-avatars, unsplash), return as is
    if (
      keyOrUrl.startsWith('data:') ||
      (keyOrUrl.startsWith('http') &&
        !keyOrUrl.includes(this.bucket) &&
        (keyOrUrl.includes('ui-avatars.com') || keyOrUrl.includes('images.unsplash.com')))
    ) {
      return keyOrUrl;
    }

    const key = this.extractKeyFromUrl(keyOrUrl);
    if (!key) return keyOrUrl;

    if (this.isS3Configured && this.s3Client) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });

        let signedUrl = await getSignedUrl(this.s3Client, command, {
          expiresIn: expiresInSeconds,
        });

        // Determine effective target endpoint to use in the public URL (LAN, domain, or configured endpoint)
        const targetEndpoint = this.publicEndpoint || this.endpoint;
        if (targetEndpoint) {
          try {
            const targetParsed = new URL(targetEndpoint);
            const signedParsed = new URL(signedUrl);
            signedUrl = `${targetParsed.origin}${signedParsed.pathname}${signedParsed.search}`;
          } catch {
            // fallback
          }
        }

        return signedUrl;
      } catch (err: any) {
        this.logger.warn(`[StorageService] Failed to generate signed URL for key: ${key}. Error: ${err.message}`);
        return keyOrUrl;
      }
    }

    // Local file fallback
    if (keyOrUrl.startsWith('/uploads/') || keyOrUrl.startsWith('uploads/')) {
      return keyOrUrl.startsWith('/') ? keyOrUrl : `/${keyOrUrl}`;
    }

    return `/uploads/${key}`;
  }

  /**
   * Retrieves a readable stream for a stored file (from S3 or local disk).
   */
  async getFileStream(
    keyOrUrl: string,
  ): Promise<{ stream: NodeJS.ReadableStream; contentType: string; contentLength?: number }> {
    const key = this.extractKeyFromUrl(keyOrUrl);

    if (this.isS3Configured && this.s3Client) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
        const response = await this.s3Client.send(command);
        const result: { stream: NodeJS.ReadableStream; contentType: string; contentLength?: number } = {
          stream: response.Body as NodeJS.ReadableStream,
          contentType: response.ContentType || 'application/octet-stream',
        };
        if (typeof response.ContentLength === 'number') {
          result.contentLength = response.ContentLength;
        }
        return result;
      } catch (err: any) {
        this.logger.warn(`[StorageService] S3 getObject failed for key ${key}: ${err.message}`);
      }
    }

    const localPath = path.join(this.localStorageDir, key);
    if (fs.existsSync(localPath)) {
      const stat = fs.statSync(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
      };
      return {
        stream: fs.createReadStream(localPath),
        contentType: mimeMap[ext] || 'application/octet-stream',
        contentLength: stat.size,
      };
    }

    throw new NotFoundException(`File not found: ${key}`);
  }

  /**
   * Deletes an object from S3 (or local fallback).
   */
  async delete(urlOrKey: string): Promise<void> {
    const key = this.extractKeyFromUrl(urlOrKey);

    if (this.isS3Configured && this.s3Client) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
        await this.s3Client.send(command);
        this.logger.log(`[StorageService] Deleted S3 object: ${key}`);
      } catch (err: any) {
        this.logger.warn(`[StorageService] Error deleting S3 object ${key}: ${err.message}`);
      }
      return;
    }

    const localPath = path.join(this.localStorageDir, key);
    if (fs.existsSync(localPath)) {
      try {
        await fs.promises.unlink(localPath);
      } catch (err: any) {
        this.logger.warn(`[StorageService] Error deleting local file ${localPath}: ${err.message}`);
      }
    }
  }

  /**
   * Extracts S3 key from a full URL or returns the key if it's already a relative path.
   */
  extractKeyFromUrl(urlOrKey: string): string {
    if (!urlOrKey) return '';
    if (urlOrKey.startsWith('data:')) return '';

    const knownFolders = ['media', 'avatars', 'proofs', 'receipts', 'documents', 'uploads', 'photos'];

    if (!urlOrKey.startsWith('http://') && !urlOrKey.startsWith('https://')) {
      let cleaned = urlOrKey.replace(/^\//, '');
      for (const folder of knownFolders) {
        const folderIndex = cleaned.indexOf(`${folder}/`);
        if (folderIndex !== -1) {
          return cleaned.substring(folderIndex);
        }
      }
      if (this.bucket && cleaned.startsWith(`${this.bucket}/`)) {
        cleaned = cleaned.substring(this.bucket.length + 1);
      }
      return cleaned;
    }

    try {
      const parsed = new URL(urlOrKey);
      let pathname = decodeURIComponent(parsed.pathname).replace(/^\//, '');
      for (const folder of knownFolders) {
        const folderIndex = pathname.indexOf(`${folder}/`);
        if (folderIndex !== -1) {
          return pathname.substring(folderIndex);
        }
      }
      if (this.bucket && pathname.startsWith(`${this.bucket}/`)) {
        pathname = pathname.substring(this.bucket.length + 1);
      }
      return pathname;
    } catch {
      return urlOrKey;
    }
  }
}
