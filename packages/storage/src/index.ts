// Storage abstraction layer for HydroFoil

import * as Minio from 'minio';
import type { BucketItem } from 'minio';
import type { Readable } from 'node:stream';

export { resolveMinioObject } from './paths';
export { decryptStorageSecret, encryptStorageSecret } from './secrets';

export interface StorageConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  useSSL?: boolean;
  region?: string;
  pathStyle?: boolean;
  /** Host:port substituted in presigned URLs for browser access (e.g. localhost:9000). */
  publicEndpoint?: string;
}

export interface ObjectMetadata {
  key: string;
  type: 'object' | 'prefix';
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
}

export interface ListObjectsOptions {
  prefix?: string;
  recursive?: boolean;
  limit?: number;
}

export class StorageClient {
  private client: Minio.Client;
  private readonly internalEndpoint: string;
  private readonly publicEndpoint?: string;
  private readonly useSSL: boolean;

  private static parseEndpoint(endpoint: string, useSSL: boolean): {
    endPoint: string;
    port?: number;
    normalized: string;
  } {
    const trimmed = endpoint.trim();
    if (!trimmed) {
      throw new Error('Storage endpoint cannot be empty');
    }

    const withScheme = /^[a-z]+:\/\//i.test(trimmed)
      ? trimmed
      : `${useSSL ? 'https' : 'http'}://${trimmed}`;
    const url = new URL(withScheme);
    const port = url.port ? Number(url.port) : undefined;

    if (Number.isNaN(port)) {
      throw new Error(`Invalid storage endpoint port in "${endpoint}"`);
    }

    return {
      endPoint: url.hostname,
      port,
      normalized: port ? `${url.hostname}:${port}` : url.hostname,
    };
  }

  constructor(config: StorageConfig) {
    const parsedEndpoint = StorageClient.parseEndpoint(config.endpoint, config.useSSL ?? false);
    this.publicEndpoint = config.publicEndpoint;
    this.useSSL = config.useSSL ?? false;
    this.internalEndpoint = parsedEndpoint.normalized;
    this.client = new Minio.Client({
      endPoint: parsedEndpoint.endPoint,
      port: parsedEndpoint.port,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      useSSL: this.useSSL,
      region: config.region,
      pathStyle: config.pathStyle,
    });
  }

  private toPublicUrl(url: string): string {
    if (!this.publicEndpoint || this.publicEndpoint === this.internalEndpoint) {
      return url;
    }
    const scheme = this.useSSL ? 'https' : 'http';
    const internal = `${scheme}://${this.internalEndpoint}`;
    const external = `${scheme}://${this.publicEndpoint}`;
    return url.replace(internal, external);
  }

  async ensureBucket(bucketName: string): Promise<void> {
    const exists = await this.client.bucketExists(bucketName);
    if (!exists) {
      await this.client.makeBucket(bucketName, 'us-east-1');
    }
  }

  async uploadFile(
    bucketName: string,
    objectName: string,
    filePath: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    await this.client.fPutObject(bucketName, objectName, filePath, {
      'Content-Type': 'application/octet-stream',
      ...metadata,
    });
  }

  async downloadFile(
    bucketName: string,
    objectName: string,
    filePath: string
  ): Promise<void> {
    await this.client.fGetObject(bucketName, objectName, filePath);
  }

  async getObjectStream(bucketName: string, objectName: string) {
    return this.client.getObject(bucketName, objectName);
  }

  async listObjects(
    bucketName: string,
    optionsOrPrefix?: string | ListObjectsOptions
  ): Promise<ObjectMetadata[]> {
    const options =
      typeof optionsOrPrefix === 'string'
        ? { prefix: optionsOrPrefix }
        : optionsOrPrefix ?? {};
    const limit = options.limit && options.limit > 0 ? options.limit : undefined;

    return new Promise((resolve, reject) => {
      const objects: ObjectMetadata[] = [];
      const stream = this.client.listObjectsV2(bucketName, options.prefix, options.recursive ?? false);

      stream.on('data', (obj: BucketItem) => {
        if (limit && objects.length >= limit) {
          stream.destroy();
          return;
        }

        if ('prefix' in obj && obj.prefix) {
          objects.push({
            key: obj.prefix,
            type: 'prefix',
            size: 0,
            lastModified: new Date(0),
            etag: '',
          });
          return;
        }

        if (!obj.name || obj.name.endsWith('/')) return;
        objects.push({
          key: obj.name,
          type: 'object',
          size: obj.size ?? 0,
          lastModified: obj.lastModified ?? new Date(0),
          etag: obj.etag ?? '',
        });
      });

      stream.on('error', reject);
      stream.on('close', () => resolve(objects));
      stream.on('end', () => resolve(objects));
    });
  }

  async deleteObject(bucketName: string, objectName: string): Promise<void> {
    await this.client.removeObject(bucketName, objectName);
  }

  async deleteObjects(bucketName: string, objectNames: string[]): Promise<void> {
    for (const objectName of objectNames) {
      await this.deleteObject(bucketName, objectName);
    }
  }

  async deletePrefix(bucketName: string, prefix: string): Promise<number> {
    const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const objects = await this.listObjects(bucketName, { prefix: normalized, recursive: true });
    const objectNames = objects
      .filter((object) => object.type === 'object')
      .map((object) => object.key);
    await this.deleteObjects(bucketName, objectNames);

    let deleted = objectNames.length;
    try {
      await this.deleteObject(bucketName, normalized);
      deleted += 1;
    } catch {
      // Folder marker may not exist when only child objects were removed.
    }
    return deleted;
  }

  async getObjectStat(bucketName: string, objectName: string): Promise<ObjectMetadata> {
    const stat = await this.client.statObject(bucketName, objectName);
    return {
      key: objectName,
      type: 'object',
      size: stat.size,
      lastModified: stat.lastModified,
      etag: stat.etag,
      contentType: stat.metaData?.['content-type'] as string | undefined,
    };
  }

  async getSignedUrl(
    bucketName: string,
    objectName: string,
    expirySeconds: number = 7 * 24 * 60 * 60 // 7 days
  ): Promise<string> {
    const url = await this.client.presignedGetObject(bucketName, objectName, expirySeconds);
    return this.toPublicUrl(url);
  }

  async getSignedUploadUrl(
    bucketName: string,
    objectName: string,
    expirySeconds: number = 15 * 60
  ): Promise<string> {
    await this.ensureBucket(bucketName);
    const url = await this.client.presignedPutObject(bucketName, objectName, expirySeconds);
    return this.toPublicUrl(url);
  }

  async putObject(
    bucketName: string,
    objectName: string,
    stream: NodeJS.ReadableStream,
    size: number,
    metadata?: Record<string, string>
  ): Promise<void> {
    await this.client.putObject(bucketName, objectName, stream as Readable, size, {
      'Content-Type': 'application/octet-stream',
      ...metadata,
    });
  }

  async createFolder(bucketName: string, prefix: string): Promise<void> {
    const folderObject = prefix.endsWith('/') ? prefix : `${prefix}/`;
    await this.ensureBucket(bucketName);
    await this.client.putObject(bucketName, folderObject, Buffer.from(''), 0, {
      'Content-Type': 'application/x-directory',
    });
  }

  async copyObject(
    sourceBucket: string,
    sourceObject: string,
    destBucket: string,
    destObject: string
  ): Promise<void> {
    await this.client.copyObject(
      destBucket,
      destObject,
      `/${sourceBucket}/${sourceObject}`,
      new Minio.CopyConditions()
    );
  }

  async moveObject(
    sourceBucket: string,
    sourceObject: string,
    destBucket: string,
    destObject: string
  ): Promise<ObjectMetadata> {
    await this.getObjectStat(sourceBucket, sourceObject);
    await this.ensureBucket(destBucket);
    await this.copyObject(sourceBucket, sourceObject, destBucket, destObject);
    await this.deleteObject(sourceBucket, sourceObject);
    return this.getObjectStat(destBucket, destObject);
  }

  async movePrefix(
    sourceBucket: string,
    sourcePrefix: string,
    destBucket: string,
    destPrefix: string
  ): Promise<{ moved: number }> {
    const source = sourcePrefix.endsWith('/') ? sourcePrefix : `${sourcePrefix}/`;
    const destination = destPrefix.endsWith('/') ? destPrefix : `${destPrefix}/`;
    const objects = await this.listObjects(sourceBucket, { prefix: source, recursive: true });
    const objectNames = objects
      .filter((object) => object.type === 'object')
      .map((object) => object.key);

    await this.ensureBucket(destBucket);
    for (const objectName of objectNames) {
      const destinationObject = `${destination}${objectName.slice(source.length)}`;
      await this.copyObject(sourceBucket, objectName, destBucket, destinationObject);
    }
    await this.deleteObjects(sourceBucket, objectNames);
    return { moved: objectNames.length };
  }
}

export class LocalStorageClient {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  // Stub implementation for local storage
  async ensureBucket(_bucketName: string): Promise<void> {
    // Would implement filesystem operations
  }

  async getSignedUrl(bucketName: string, objectName: string): Promise<string> {
    return `file://${this.basePath}/${bucketName}/${objectName}`;
  }
}
