import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

/** Token used to inject a StoragePort */
export const STORAGE_PORT = 'StoragePort';

export interface StoragePort {
  /**
   * Upload a file buffer and return the public URL.
   */
  upload(buffer: Buffer, filename: string, mimeType: string): Promise<string>;

  /**
   * Delete a file by its public URL.
   */
  delete(url: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// S3 / GCS (S3-compatible) Mock Adapter
// ---------------------------------------------------------------------------

/**
 * Mock adapter for AWS S3 and GCS, implemented using local filesystem simulation
 * to avoid dependencies on `@aws-sdk/client-s3` which cannot be installed.
 */
@Injectable()
export class S3StorageAdapter implements StoragePort {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly uploadDir: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('STORAGE_BUCKET', 'futurefarm-proofs');
    this.region = config.get<string>('STORAGE_REGION', 'eu-west-1');
    this.uploadDir = path.resolve(process.cwd(), 'uploads', 's3-mock');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(buffer: Buffer, filename: string, _mimeType: string): Promise<string> {
    const key = `proofs/${Date.now()}-${filename}`;
    const dest = path.join(this.uploadDir, key.replace(/\//g, '_'));
    this.logger.log(`[MockS3] Uploading ${key} to bucket ${this.bucket}`);
    fs.writeFileSync(dest, buffer);
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async delete(url: string): Promise<void> {
    const key = this.keyFromUrl(url);
    if (!key) return;
    const dest = path.join(this.uploadDir, key.replace(/\//g, '_'));
    this.logger.log(`[MockS3] Deleting ${key} from bucket ${this.bucket}`);
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
  }

  private keyFromUrl(url: string): string | null {
    try {
      const u = new URL(url);
      return u.pathname.replace(/^\//, '');
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Local filesystem adapter
// ---------------------------------------------------------------------------

@Injectable()
export class LocalStorageAdapter implements StoragePort {
  private readonly logger = new Logger(LocalStorageAdapter.name);
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), 'uploads', 'proofs');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(buffer: Buffer, filename: string, _mimeType: string): Promise<string> {
    const uniqueName = `${Date.now()}-${filename}`;
    const dest = path.join(this.uploadDir, uniqueName);
    this.logger.log(`[LocalStorage] Saving file to ${dest}`);
    fs.writeFileSync(dest, buffer);
    return `/uploads/proofs/${uniqueName}`;
  }

  async delete(url: string): Promise<void> {
    const filename = path.basename(url);
    const filepath = path.join(this.uploadDir, filename);
    if (fs.existsSync(filepath)) {
      this.logger.log(`[LocalStorage] Deleting ${filepath}`);
      fs.unlinkSync(filepath);
    }
  }
}
